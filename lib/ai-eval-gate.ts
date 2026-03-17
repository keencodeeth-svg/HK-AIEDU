import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { runAiOfflineEval, type AiEvalDatasetName } from "./ai-evals";
import {
  listAiQualityCalibrationSnapshots,
  rollbackAiQualityCalibration,
  type AiQualityCalibrationSnapshot
} from "./ai-quality-calibration";
import { shouldAllowDbBootstrapFromJsonFallback } from "./runtime-guardrails";
import { readJson, writeJson } from "./storage";

export type AiEvalGateConfig = {
  enabled: boolean;
  datasets: AiEvalDatasetName[];
  minPassRate: number;
  minAverageScore: number;
  maxHighRiskCount: number;
  autoRollbackOnFail: boolean;
  updatedAt: string;
  updatedBy?: string;
};

export type AiEvalGateRun = {
  id: string;
  executedAt: string;
  config: AiEvalGateConfig;
  reportSummary: {
    totalCases: number;
    passRate: number;
    averageScore: number;
    highRiskCount: number;
  };
  passed: boolean;
  failedRules: string[];
  rollback: {
    attempted: boolean;
    snapshotId: string | null;
    success: boolean;
    message: string;
  };
};

type DbAiEvalGateRuntimeRow = {
  id: string;
  config: string | Partial<AiEvalGateConfig>;
  updated_at: string;
  updated_by: string | null;
};

type DbAiEvalGateRunRow = {
  id: string;
  executed_at: string;
  config: string | Partial<AiEvalGateConfig>;
  report_summary: string | Partial<AiEvalGateRun["reportSummary"]>;
  passed: boolean;
  failed_rules: string[] | null;
  rollback: string | Partial<AiEvalGateRun["rollback"]>;
};

const CONFIG_FILE = "ai-eval-gate-config.json";
const HISTORY_FILE = "ai-eval-gate-history.json";
const HISTORY_LIMIT = 120;
const RUNTIME_ROW_ID = "runtime";
const STATE_CACHE_TTL_MS = 8_000;
const DEFAULT_DATASETS: AiEvalDatasetName[] = [
  "explanation",
  "homework_review",
  "knowledge_points_generate",
  "writing_feedback",
  "lesson_outline",
  "question_check"
];

const DEFAULT_CONFIG: AiEvalGateConfig = {
  enabled: true,
  datasets: DEFAULT_DATASETS,
  minPassRate: 75,
  minAverageScore: 68,
  maxHighRiskCount: 6,
  autoRollbackOnFail: false,
  updatedAt: new Date(0).toISOString(),
  updatedBy: undefined
};

let configCache = isDbEnabled() ? normalizeConfig(DEFAULT_CONFIG) : readConfigFromFile();
let runHistoryCache = isDbEnabled() ? [] : readRunHistoryFromFile();
let stateSyncedAt = 0;
let stateSyncing: Promise<void> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value * 100) / 100));
}

function normalizeDatasets(input: unknown) {
  if (!Array.isArray(input)) return DEFAULT_DATASETS;
  const allowed = new Set<AiEvalDatasetName>(DEFAULT_DATASETS);
  const datasets = Array.from(
    new Set(
      input
        .map((item) => String(item).trim())
        .filter(Boolean)
        .filter((item): item is AiEvalDatasetName => allowed.has(item as AiEvalDatasetName))
    )
  );
  return datasets.length ? datasets : DEFAULT_DATASETS;
}

function normalizeConfig(input: Partial<AiEvalGateConfig> | null | undefined): AiEvalGateConfig {
  if (!input) return { ...DEFAULT_CONFIG };
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_CONFIG.enabled,
    datasets: normalizeDatasets(input.datasets),
    minPassRate: Number.isFinite(input.minPassRate) ? clamp(input.minPassRate as number, 0, 100) : DEFAULT_CONFIG.minPassRate,
    minAverageScore: Number.isFinite(input.minAverageScore)
      ? clamp(input.minAverageScore as number, 0, 100)
      : DEFAULT_CONFIG.minAverageScore,
    maxHighRiskCount: Number.isFinite(input.maxHighRiskCount)
      ? Math.max(0, Math.min(9999, Math.round(input.maxHighRiskCount as number)))
      : DEFAULT_CONFIG.maxHighRiskCount,
    autoRollbackOnFail:
      typeof input.autoRollbackOnFail === "boolean" ? input.autoRollbackOnFail : DEFAULT_CONFIG.autoRollbackOnFail,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    updatedBy: typeof input.updatedBy === "string" && input.updatedBy.trim() ? input.updatedBy.trim() : undefined
  };
}

function normalizeRunReportSummary(
  input: Partial<AiEvalGateRun["reportSummary"]> | null | undefined
): AiEvalGateRun["reportSummary"] {
  return {
    totalCases: Number(input?.totalCases ?? 0),
    passRate: Number(input?.passRate ?? 0),
    averageScore: Number(input?.averageScore ?? 0),
    highRiskCount: Number(input?.highRiskCount ?? 0)
  };
}

function normalizeRunRollback(input: Partial<AiEvalGateRun["rollback"]> | null | undefined): AiEvalGateRun["rollback"] {
  return {
    attempted: Boolean(input?.attempted),
    snapshotId: input?.snapshotId ? String(input.snapshotId) : null,
    success: Boolean(input?.success),
    message: String(input?.message ?? "")
  };
}

function normalizeRun(input: Partial<AiEvalGateRun> | null | undefined): AiEvalGateRun | null {
  if (!input || !input.id || !input.executedAt || !input.config) return null;
  return {
    id: String(input.id),
    executedAt: String(input.executedAt),
    config: normalizeConfig(input.config),
    reportSummary: normalizeRunReportSummary(input.reportSummary),
    passed: Boolean(input.passed),
    failedRules: Array.isArray(input.failedRules) ? input.failedRules.map((item) => String(item)) : [],
    rollback: normalizeRunRollback(input.rollback)
  };
}

function readConfigFromFile() {
  const raw = readJson<AiEvalGateConfig>(CONFIG_FILE, DEFAULT_CONFIG);
  return normalizeConfig(raw);
}

function sortRuns(items: AiEvalGateRun[]) {
  return items
    .slice()
    .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
    .slice(0, HISTORY_LIMIT);
}

function readRunHistoryFromFile() {
  const raw = readJson<Array<Partial<AiEvalGateRun>>>(HISTORY_FILE, []);
  if (!Array.isArray(raw)) return [];
  return sortRuns(raw.map((item) => normalizeRun(item)).filter((item): item is AiEvalGateRun => Boolean(item)));
}

function parseDbJson<T>(value: string | T | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
}

function mapDbRuntimeRow(row: DbAiEvalGateRuntimeRow | null) {
  if (!row) {
    return normalizeConfig(DEFAULT_CONFIG);
  }
  const config = normalizeConfig(parseDbJson<Partial<AiEvalGateConfig>>(row.config));
  return {
    ...config,
    updatedAt: row.updated_at || config.updatedAt,
    updatedBy: row.updated_by?.trim() || config.updatedBy
  };
}

function mapDbRunRows(rows: DbAiEvalGateRunRow[]) {
  return sortRuns(
    rows
      .map((row) =>
        normalizeRun({
          id: row.id,
          executedAt: row.executed_at,
          config: normalizeConfig(parseDbJson<Partial<AiEvalGateConfig>>(row.config)),
          reportSummary: normalizeRunReportSummary(
            parseDbJson<Partial<AiEvalGateRun["reportSummary"]>>(row.report_summary)
          ),
          passed: row.passed,
          failedRules: Array.isArray(row.failed_rules) ? row.failed_rules : [],
          rollback: normalizeRunRollback(parseDbJson<Partial<AiEvalGateRun["rollback"]>>(row.rollback))
        })
      )
      .filter((item): item is AiEvalGateRun => Boolean(item))
  );
}

async function persistConfigToDb(config: AiEvalGateConfig) {
  await query(
    `INSERT INTO ai_eval_gate_runtime (id, config, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET config = EXCLUDED.config,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
    [RUNTIME_ROW_ID, JSON.stringify(config), config.updatedAt, config.updatedBy ?? null]
  );
}

async function persistRunsToDb(items: AiEvalGateRun[]) {
  for (const item of items) {
    await query(
      `INSERT INTO ai_eval_gate_runs
        (id, executed_at, config, report_summary, passed, failed_rules, rollback)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.executedAt,
        JSON.stringify(item.config),
        JSON.stringify(item.reportSummary),
        item.passed,
        item.failedRules,
        JSON.stringify(item.rollback)
      ]
    );
  }
}

async function syncStateFromDb(force = false) {
  if (!isDbEnabled()) return;

  const now = Date.now();
  if (!force && stateSyncedAt && now - stateSyncedAt < STATE_CACHE_TTL_MS) {
    return;
  }
  if (stateSyncing) {
    return stateSyncing;
  }

  stateSyncing = (async () => {
    try {
      const [runtimeRow, runRows] = await Promise.all([
        queryOne<DbAiEvalGateRuntimeRow>(
          "SELECT id, config, updated_at, updated_by FROM ai_eval_gate_runtime WHERE id = $1",
          [RUNTIME_ROW_ID]
        ),
        query<DbAiEvalGateRunRow>(
          `SELECT id, executed_at, config, report_summary, passed, failed_rules, rollback
           FROM ai_eval_gate_runs
           ORDER BY executed_at DESC
           LIMIT $1`,
          [HISTORY_LIMIT]
        )
      ]);

      if (!runtimeRow) {
        const fallbackConfig = shouldAllowDbBootstrapFromJsonFallback()
          ? readConfigFromFile()
          : normalizeConfig(DEFAULT_CONFIG);
        const fallbackRuns = shouldAllowDbBootstrapFromJsonFallback() ? readRunHistoryFromFile() : [];
        await persistConfigToDb(fallbackConfig);
        if (fallbackRuns.length) {
          await persistRunsToDb(fallbackRuns);
        }
        configCache = fallbackConfig;
        runHistoryCache = fallbackRuns;
      } else {
        configCache = mapDbRuntimeRow(runtimeRow);
        runHistoryCache = mapDbRunRows(runRows);
      }

      stateSyncedAt = Date.now();
    } catch {
      // Keep the last known in-memory snapshot when DB reads fail.
    } finally {
      stateSyncing = null;
    }
  })();

  return stateSyncing;
}

export function getAiEvalGateConfig() {
  if (isDbEnabled()) {
    void syncStateFromDb();
  }
  return configCache;
}

export async function refreshAiEvalGateState() {
  await syncStateFromDb(true);
  return {
    config: getAiEvalGateConfig(),
    recentRuns: listAiEvalGateRuns(HISTORY_LIMIT)
  };
}

export async function updateAiEvalGateConfig(
  patch: Partial<Pick<AiEvalGateConfig, "enabled" | "datasets" | "minPassRate" | "minAverageScore" | "maxHighRiskCount" | "autoRollbackOnFail">>,
  options?: { updatedBy?: string }
) {
  if (isDbEnabled()) {
    await syncStateFromDb(true);
  }

  const current = getAiEvalGateConfig();
  const next = normalizeConfig({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: options?.updatedBy?.trim() || current.updatedBy
  });

  if (!isDbEnabled()) {
    writeJson(CONFIG_FILE, next);
    configCache = next;
    return next;
  }

  await persistConfigToDb(next);
  configCache = next;
  stateSyncedAt = Date.now();
  return next;
}

export function listAiEvalGateRuns(limit = 20) {
  if (isDbEnabled()) {
    void syncStateFromDb();
  }
  const capped = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.round(limit))) : 20;
  return runHistoryCache.slice(0, capped);
}

function appendAiEvalGateRun(run: AiEvalGateRun) {
  const history = sortRuns([run, ...runHistoryCache.filter((item) => item.id !== run.id)]);
  runHistoryCache = history;
  writeJson(HISTORY_FILE, history);
}

function pickRollbackSnapshot(snapshots: AiQualityCalibrationSnapshot[]) {
  return snapshots.find((item) => item.reason !== "manual_rollback") ?? snapshots[0] ?? null;
}

export async function runAiEvalGate(input: {
  configOverride?: Partial<AiEvalGateConfig>;
  force?: boolean;
  runBy?: string;
} = {}) {
  if (isDbEnabled()) {
    await syncStateFromDb(true);
  }

  const config = normalizeConfig({
    ...getAiEvalGateConfig(),
    ...(input.configOverride ?? {})
  });
  const executedAt = new Date().toISOString();
  const report = runAiOfflineEval({ datasets: config.datasets });

  const failedRules: string[] = [];
  if (report.summary.passRate < config.minPassRate) {
    failedRules.push(`passRate ${report.summary.passRate} < ${config.minPassRate}`);
  }
  if (report.summary.averageScore < config.minAverageScore) {
    failedRules.push(`averageScore ${report.summary.averageScore} < ${config.minAverageScore}`);
  }
  if (report.summary.highRiskCount > config.maxHighRiskCount) {
    failedRules.push(`highRiskCount ${report.summary.highRiskCount} > ${config.maxHighRiskCount}`);
  }

  let rollback = {
    attempted: false,
    snapshotId: null as string | null,
    success: false,
    message: "not_triggered"
  };
  const shouldRunGate = input.force === true || config.enabled;
  const shouldRollback = shouldRunGate && failedRules.length > 0 && config.autoRollbackOnFail;
  if (shouldRollback) {
    rollback.attempted = true;
    const snapshots = listAiQualityCalibrationSnapshots(20);
    const target = pickRollbackSnapshot(snapshots);
    if (target) {
      rollback.snapshotId = target.id;
      const next = await rollbackAiQualityCalibration(target.id, {
        updatedBy: input.runBy,
        reason: "eval_gate_auto_rollback"
      });
      rollback.success = Boolean(next);
      rollback.message = next ? "rollback_success" : "rollback_failed";
    } else {
      rollback.message = "rollback_snapshot_missing";
    }
  }

  const run: AiEvalGateRun = {
    id: `eval-gate-${crypto.randomBytes(6).toString("hex")}`,
    executedAt,
    config,
    reportSummary: {
      totalCases: report.summary.totalCases,
      passRate: report.summary.passRate,
      averageScore: report.summary.averageScore,
      highRiskCount: report.summary.highRiskCount
    },
    passed: shouldRunGate ? failedRules.length === 0 : true,
    failedRules: shouldRunGate ? failedRules : [],
    rollback
  };

  if (!isDbEnabled()) {
    appendAiEvalGateRun(run);
  } else {
    await persistRunsToDb([run]);
    runHistoryCache = sortRuns([run, ...runHistoryCache.filter((item) => item.id !== run.id)]);
    stateSyncedAt = Date.now();
  }

  return {
    run,
    report
  };
}
