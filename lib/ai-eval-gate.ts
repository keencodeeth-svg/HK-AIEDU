import crypto from "crypto";
import { runAiOfflineEval, type AiEvalDatasetName } from "./ai-evals";
import {
  listAiQualityCalibrationSnapshots,
  rollbackAiQualityCalibration,
  type AiQualityCalibrationSnapshot
} from "./ai-quality-calibration";
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

const CONFIG_FILE = "ai-eval-gate-config.json";
const HISTORY_FILE = "ai-eval-gate-history.json";
const HISTORY_LIMIT = 120;
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

function normalizeRun(input: Partial<AiEvalGateRun> | null | undefined): AiEvalGateRun | null {
  if (!input || !input.id || !input.executedAt || !input.config) return null;
  return {
    id: String(input.id),
    executedAt: String(input.executedAt),
    config: normalizeConfig(input.config),
    reportSummary: {
      totalCases: Number(input.reportSummary?.totalCases ?? 0),
      passRate: Number(input.reportSummary?.passRate ?? 0),
      averageScore: Number(input.reportSummary?.averageScore ?? 0),
      highRiskCount: Number(input.reportSummary?.highRiskCount ?? 0)
    },
    passed: Boolean(input.passed),
    failedRules: Array.isArray(input.failedRules) ? input.failedRules.map((item) => String(item)) : [],
    rollback: {
      attempted: Boolean(input.rollback?.attempted),
      snapshotId: input.rollback?.snapshotId ? String(input.rollback.snapshotId) : null,
      success: Boolean(input.rollback?.success),
      message: String(input.rollback?.message ?? "")
    }
  };
}

export function getAiEvalGateConfig() {
  const raw = readJson<AiEvalGateConfig>(CONFIG_FILE, DEFAULT_CONFIG);
  return normalizeConfig(raw);
}

export function updateAiEvalGateConfig(
  patch: Partial<Pick<AiEvalGateConfig, "enabled" | "datasets" | "minPassRate" | "minAverageScore" | "maxHighRiskCount" | "autoRollbackOnFail">>,
  options?: { updatedBy?: string }
) {
  const current = getAiEvalGateConfig();
  const next = normalizeConfig({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: options?.updatedBy?.trim() || current.updatedBy
  });
  writeJson(CONFIG_FILE, next);
  return next;
}

export function listAiEvalGateRuns(limit = 20) {
  const capped = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.round(limit))) : 20;
  const raw = readJson<Array<Partial<AiEvalGateRun>>>(HISTORY_FILE, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeRun(item))
    .filter((item): item is AiEvalGateRun => Boolean(item))
    .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
    .slice(0, capped);
}

function appendAiEvalGateRun(run: AiEvalGateRun) {
  const history = listAiEvalGateRuns(HISTORY_LIMIT);
  history.unshift(run);
  writeJson(HISTORY_FILE, history.slice(0, HISTORY_LIMIT));
}

function pickRollbackSnapshot(snapshots: AiQualityCalibrationSnapshot[]) {
  return snapshots.find((item) => item.reason !== "manual_rollback") ?? snapshots[0] ?? null;
}

export function runAiEvalGate(input: {
  configOverride?: Partial<AiEvalGateConfig>;
  force?: boolean;
  runBy?: string;
} = {}) {
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
      const next = rollbackAiQualityCalibration(target.id, {
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

  appendAiEvalGateRun(run);
  return {
    run,
    report
  };
}
