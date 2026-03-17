import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { shouldAllowDbBootstrapFromJsonFallback } from "./runtime-guardrails";
import { readJson, writeJson } from "./storage";

export type AiQualityKind = "assist" | "coach" | "explanation" | "writing" | "assignment_review";

export type AiQualityCalibrationConfig = {
  globalBias: number;
  providerAdjustments: Record<string, number>;
  kindAdjustments: Record<AiQualityKind, number>;
  enabled: boolean;
  rolloutPercent: number;
  rolloutSalt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type AiQualityCalibrationPatch = {
  globalBias?: number;
  providerAdjustments?: Record<string, number>;
  kindAdjustments?: Partial<Record<AiQualityKind, number>>;
  enabled?: boolean;
  rolloutPercent?: number;
  rolloutSalt?: string;
};

export type AiQualityCalibrationSnapshot = {
  id: string;
  reason: string;
  createdAt: string;
  createdBy?: string;
  config: AiQualityCalibrationConfig;
};

type DbCalibrationRuntimeRow = {
  id: string;
  config: string | Partial<AiQualityCalibrationConfig>;
  updated_at: string;
  updated_by: string | null;
};

type DbCalibrationHistoryRow = {
  id: string;
  reason: string;
  created_at: string;
  created_by: string | null;
  config: string | Partial<AiQualityCalibrationConfig>;
};

const CALIBRATION_FILE = "ai-quality-calibration.json";
const CALIBRATION_HISTORY_FILE = "ai-quality-calibration-history.json";
const CALIBRATION_HISTORY_LIMIT = 60;
const CALIBRATION_RUNTIME_ROW_ID = "runtime";
const CALIBRATION_CACHE_TTL_MS = 8_000;

const DEFAULT_CALIBRATION: AiQualityCalibrationConfig = {
  globalBias: 0,
  providerAdjustments: {},
  kindAdjustments: {
    assist: 0,
    coach: 0,
    explanation: 0,
    writing: 0,
    assignment_review: 0
  },
  enabled: true,
  rolloutPercent: 100,
  rolloutSalt: "default",
  updatedAt: new Date(0).toISOString(),
  updatedBy: undefined
};

let calibrationCache = isDbEnabled() ? normalizeCalibration(DEFAULT_CALIBRATION) : readCalibrationFromFile();
let calibrationHistoryCache = isDbEnabled() ? [] : readCalibrationHistoryFromFile();
let calibrationStateSyncedAt = 0;
let calibrationStateSyncing: Promise<void> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value * 100) / 100));
}

function normalizeMap(input: Record<string, number> | undefined) {
  if (!input) return {};
  const next: Record<string, number> = {};
  Object.entries(input).forEach(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) return;
    if (!Number.isFinite(value)) return;
    next[normalizedKey] = clamp(value, -30, 30);
  });
  return next;
}

function normalizeKindAdjustments(input: Partial<Record<AiQualityKind, number>> | undefined) {
  const base = { ...DEFAULT_CALIBRATION.kindAdjustments };
  if (!input) return base;
  (Object.keys(base) as AiQualityKind[]).forEach((kind) => {
    const value = input[kind];
    if (!Number.isFinite(value)) return;
    base[kind] = clamp(value as number, -30, 30);
  });
  return base;
}

function normalizeCalibration(input: Partial<AiQualityCalibrationConfig> | null | undefined): AiQualityCalibrationConfig {
  if (!input) return { ...DEFAULT_CALIBRATION };
  const globalBias = Number.isFinite(input.globalBias) ? clamp(input.globalBias as number, -30, 30) : 0;
  const providerAdjustments = normalizeMap(input.providerAdjustments);
  const kindAdjustments = normalizeKindAdjustments(input.kindAdjustments);
  const enabled = typeof input.enabled === "boolean" ? input.enabled : DEFAULT_CALIBRATION.enabled;
  const rolloutPercent = Number.isFinite(input.rolloutPercent)
    ? clamp(input.rolloutPercent as number, 0, 100)
    : DEFAULT_CALIBRATION.rolloutPercent;
  const rolloutSalt =
    typeof input.rolloutSalt === "string" && input.rolloutSalt.trim()
      ? input.rolloutSalt.trim().toLowerCase()
      : DEFAULT_CALIBRATION.rolloutSalt;
  const updatedBy = typeof input.updatedBy === "string" && input.updatedBy.trim() ? input.updatedBy.trim() : undefined;

  return {
    globalBias,
    providerAdjustments,
    kindAdjustments,
    enabled,
    rolloutPercent,
    rolloutSalt,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    updatedBy
  };
}

function normalizeSnapshot(
  input: Partial<AiQualityCalibrationSnapshot> | null | undefined
): AiQualityCalibrationSnapshot | null {
  if (!input || typeof input !== "object") return null;
  if (!input.id || !input.createdAt || !input.reason) return null;
  const createdBy = typeof input.createdBy === "string" && input.createdBy.trim() ? input.createdBy.trim() : undefined;
  const next: AiQualityCalibrationSnapshot = {
    id: String(input.id),
    reason: String(input.reason),
    createdAt: String(input.createdAt),
    config: normalizeCalibration(input.config)
  };
  if (createdBy) {
    next.createdBy = createdBy;
  }
  return next;
}

function readCalibrationFromFile() {
  const raw = readJson<AiQualityCalibrationConfig>(CALIBRATION_FILE, DEFAULT_CALIBRATION);
  return normalizeCalibration(raw);
}

function sortSnapshots(items: AiQualityCalibrationSnapshot[]) {
  return items
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, CALIBRATION_HISTORY_LIMIT);
}

function readCalibrationHistoryFromFile() {
  const raw = readJson<Array<Partial<AiQualityCalibrationSnapshot>>>(CALIBRATION_HISTORY_FILE, []);
  if (!Array.isArray(raw)) return [];
  return sortSnapshots(
    raw
      .map((item) => normalizeSnapshot(item))
      .filter((item): item is AiQualityCalibrationSnapshot => Boolean(item))
  );
}

function writeCalibrationHistory(items: AiQualityCalibrationSnapshot[]) {
  writeJson(CALIBRATION_HISTORY_FILE, items.slice(0, CALIBRATION_HISTORY_LIMIT));
}

function parseDbConfig(value: string | Partial<AiQualityCalibrationConfig> | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Partial<AiQualityCalibrationConfig>;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value;
  }
  return null;
}

function mapDbCalibrationRow(row: DbCalibrationRuntimeRow | null) {
  if (!row) {
    return normalizeCalibration(DEFAULT_CALIBRATION);
  }

  const config = normalizeCalibration(parseDbConfig(row.config));
  return {
    ...config,
    updatedAt: row.updated_at || config.updatedAt,
    updatedBy: row.updated_by?.trim() || config.updatedBy
  };
}

function mapDbHistoryRows(rows: DbCalibrationHistoryRow[]) {
  return sortSnapshots(
    rows
      .map((row) =>
        normalizeSnapshot({
          id: row.id,
          reason: row.reason,
          createdAt: row.created_at,
          createdBy: row.created_by ?? undefined,
          config: normalizeCalibration(parseDbConfig(row.config))
        })
      )
      .filter((item): item is AiQualityCalibrationSnapshot => Boolean(item))
  );
}

async function persistCalibrationConfigToDb(config: AiQualityCalibrationConfig) {
  await query(
    `INSERT INTO ai_quality_calibration_runtime (id, config, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET config = EXCLUDED.config,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
    [CALIBRATION_RUNTIME_ROW_ID, JSON.stringify(config), config.updatedAt, config.updatedBy ?? null]
  );
}

async function persistCalibrationSnapshotsToDb(items: AiQualityCalibrationSnapshot[]) {
  for (const item of items) {
    await query(
      `INSERT INTO ai_quality_calibration_history (id, reason, created_at, created_by, config)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.reason, item.createdAt, item.createdBy ?? null, JSON.stringify(item.config)]
    );
  }
}

async function syncCalibrationStateFromDb(force = false) {
  if (!isDbEnabled()) return;

  const now = Date.now();
  if (!force && calibrationStateSyncedAt && now - calibrationStateSyncedAt < CALIBRATION_CACHE_TTL_MS) {
    return;
  }
  if (calibrationStateSyncing) {
    return calibrationStateSyncing;
  }

  calibrationStateSyncing = (async () => {
    try {
      const [runtimeRow, historyRows] = await Promise.all([
        queryOne<DbCalibrationRuntimeRow>(
          "SELECT id, config, updated_at, updated_by FROM ai_quality_calibration_runtime WHERE id = $1",
          [CALIBRATION_RUNTIME_ROW_ID]
        ),
        query<DbCalibrationHistoryRow>(
          `SELECT id, reason, created_at, created_by, config
           FROM ai_quality_calibration_history
           ORDER BY created_at DESC
           LIMIT $1`,
          [CALIBRATION_HISTORY_LIMIT]
        )
      ]);

      if (!runtimeRow) {
        const fallbackConfig = shouldAllowDbBootstrapFromJsonFallback()
          ? readCalibrationFromFile()
          : normalizeCalibration(DEFAULT_CALIBRATION);
        const fallbackHistory = shouldAllowDbBootstrapFromJsonFallback() ? readCalibrationHistoryFromFile() : [];
        await persistCalibrationConfigToDb(fallbackConfig);
        if (fallbackHistory.length) {
          await persistCalibrationSnapshotsToDb(fallbackHistory);
        }
        calibrationCache = fallbackConfig;
        calibrationHistoryCache = fallbackHistory;
      } else {
        calibrationCache = mapDbCalibrationRow(runtimeRow);
        calibrationHistoryCache = mapDbHistoryRows(historyRows);
      }
      calibrationStateSyncedAt = Date.now();
    } catch {
      // Keep last known cache when DB reads fail.
    } finally {
      calibrationStateSyncing = null;
    }
  })();

  return calibrationStateSyncing;
}

function createCalibrationSnapshot(params: { reason: string; createdBy?: string; config?: AiQualityCalibrationConfig }) {
  const source = params.config ?? getAiQualityCalibration();
  return {
    id: `cal-snap-${crypto.randomBytes(6).toString("hex")}`,
    reason: params.reason.trim() || "manual_update",
    createdAt: new Date().toISOString(),
    createdBy: params.createdBy?.trim() || undefined,
    config: normalizeCalibration(source)
  };
}

function hashToPercent(input: string) {
  const digest = crypto.createHash("sha256").update(input).digest();
  const value = digest.readUInt32BE(0);
  return (value / 0xffffffff) * 100;
}

function isCalibrationApplied(params: {
  calibration: AiQualityCalibrationConfig;
  kind: AiQualityKind;
  provider?: string | null;
  scopeKey?: string;
}) {
  const { calibration } = params;
  if (!calibration.enabled) return false;
  if (calibration.rolloutPercent <= 0) return false;
  if (calibration.rolloutPercent >= 100) return true;

  const providerKey = (params.provider ?? "").trim().toLowerCase() || "unknown";
  const baseScope = params.scopeKey?.trim() || `${params.kind}|${providerKey}`;
  const bucket = hashToPercent(`${baseScope}|${calibration.rolloutSalt}`);
  return bucket < calibration.rolloutPercent;
}

export function getAiQualityCalibration() {
  if (isDbEnabled()) {
    void syncCalibrationStateFromDb();
  }
  return calibrationCache;
}

export function listAiQualityCalibrationSnapshots(limit = 20) {
  if (isDbEnabled()) {
    void syncCalibrationStateFromDb();
  }
  const capped = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.round(limit))) : 20;
  return calibrationHistoryCache.slice(0, capped);
}

export async function refreshAiQualityCalibrationState() {
  await syncCalibrationStateFromDb(true);
  return {
    calibration: getAiQualityCalibration(),
    snapshots: listAiQualityCalibrationSnapshots(CALIBRATION_HISTORY_LIMIT)
  };
}

export async function upsertAiQualityCalibration(
  patch: AiQualityCalibrationPatch,
  options?: { updatedBy?: string; reason?: string }
) {
  if (isDbEnabled()) {
    await syncCalibrationStateFromDb(true);
  }

  const current = getAiQualityCalibration();
  const snapshot = createCalibrationSnapshot({
    reason: options?.reason ?? "manual_update",
    createdBy: options?.updatedBy,
    config: current
  });
  const nextHistory = sortSnapshots([snapshot, ...calibrationHistoryCache.filter((item) => item.id !== snapshot.id)]);

  const next: AiQualityCalibrationConfig = {
    globalBias: Number.isFinite(patch.globalBias)
      ? clamp(patch.globalBias as number, -30, 30)
      : current.globalBias,
    providerAdjustments: {
      ...current.providerAdjustments,
      ...normalizeMap(patch.providerAdjustments)
    },
    kindAdjustments: {
      ...current.kindAdjustments,
      ...normalizeKindAdjustments(patch.kindAdjustments)
    },
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    rolloutPercent: Number.isFinite(patch.rolloutPercent)
      ? clamp(patch.rolloutPercent as number, 0, 100)
      : current.rolloutPercent,
    rolloutSalt:
      typeof patch.rolloutSalt === "string" && patch.rolloutSalt.trim()
        ? patch.rolloutSalt.trim().toLowerCase()
        : current.rolloutSalt,
    updatedAt: new Date().toISOString(),
    updatedBy: options?.updatedBy?.trim() || current.updatedBy
  };

  if (!isDbEnabled()) {
    writeCalibrationHistory(nextHistory);
    writeJson(CALIBRATION_FILE, next);
    calibrationHistoryCache = nextHistory;
    calibrationCache = next;
    return next;
  }

  await persistCalibrationSnapshotsToDb([snapshot]);
  await persistCalibrationConfigToDb(next);
  calibrationHistoryCache = nextHistory;
  calibrationCache = next;
  calibrationStateSyncedAt = Date.now();
  return next;
}

export async function rollbackAiQualityCalibration(
  snapshotId: string,
  options?: { updatedBy?: string; reason?: string }
) {
  if (isDbEnabled()) {
    await syncCalibrationStateFromDb(true);
  }

  const target = calibrationHistoryCache.find((item) => item.id === snapshotId);
  if (!target) return null;
  const current = getAiQualityCalibration();
  const snapshot = createCalibrationSnapshot({
    reason: options?.reason ?? `rollback_before:${snapshotId}`,
    createdBy: options?.updatedBy,
    config: current
  });
  const nextHistory = sortSnapshots([snapshot, ...calibrationHistoryCache.filter((item) => item.id !== snapshot.id)]);

  const next: AiQualityCalibrationConfig = {
    ...normalizeCalibration(target.config),
    updatedAt: new Date().toISOString(),
    updatedBy: options?.updatedBy?.trim() || target.createdBy
  };

  if (!isDbEnabled()) {
    writeCalibrationHistory(nextHistory);
    writeJson(CALIBRATION_FILE, next);
    calibrationHistoryCache = nextHistory;
    calibrationCache = next;
    return next;
  }

  await persistCalibrationSnapshotsToDb([snapshot]);
  await persistCalibrationConfigToDb(next);
  calibrationHistoryCache = nextHistory;
  calibrationCache = next;
  calibrationStateSyncedAt = Date.now();
  return next;
}

export function applyAiQualityCalibration(params: {
  score: number;
  provider?: string | null;
  kind: AiQualityKind;
  scopeKey?: string;
}) {
  const calibration = getAiQualityCalibration();
  const shouldApply = isCalibrationApplied({
    calibration,
    provider: params.provider,
    kind: params.kind,
    scopeKey: params.scopeKey
  });
  const providerKey = (params.provider ?? "").trim().toLowerCase();
  const providerAdjustment = shouldApply && providerKey ? calibration.providerAdjustments[providerKey] ?? 0 : 0;
  const kindAdjustment = shouldApply ? calibration.kindAdjustments[params.kind] ?? 0 : 0;
  const globalBias = shouldApply ? calibration.globalBias : 0;
  const calibratedScore = clamp(params.score + globalBias + providerAdjustment + kindAdjustment, 0, 100);

  return {
    score: calibratedScore,
    calibration,
    applied: shouldApply,
    adjustments: {
      globalBias,
      providerAdjustment,
      kindAdjustment
    }
  };
}
