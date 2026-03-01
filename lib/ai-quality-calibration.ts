import crypto from "crypto";
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

const CALIBRATION_FILE = "ai-quality-calibration.json";
const CALIBRATION_HISTORY_FILE = "ai-quality-calibration-history.json";
const CALIBRATION_HISTORY_LIMIT = 60;

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

function readCalibrationHistory() {
  const raw = readJson<Array<Partial<AiQualityCalibrationSnapshot>>>(CALIBRATION_HISTORY_FILE, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeSnapshot(item))
    .filter((item): item is AiQualityCalibrationSnapshot => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeCalibrationHistory(items: AiQualityCalibrationSnapshot[]) {
  writeJson(CALIBRATION_HISTORY_FILE, items.slice(0, CALIBRATION_HISTORY_LIMIT));
}

function snapshotCurrentCalibration(params: { reason: string; createdBy?: string; config?: AiQualityCalibrationConfig }) {
  const source = params.config ?? getAiQualityCalibration();
  const now = new Date().toISOString();
  const history = readCalibrationHistory();
  const next: AiQualityCalibrationSnapshot = {
    id: `cal-snap-${crypto.randomBytes(6).toString("hex")}`,
    reason: params.reason.trim() || "manual_update",
    createdAt: now,
    createdBy: params.createdBy?.trim() || undefined,
    config: normalizeCalibration(source)
  };
  history.unshift(next);
  writeCalibrationHistory(history);
  return next;
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
  const raw = readJson<AiQualityCalibrationConfig>(CALIBRATION_FILE, DEFAULT_CALIBRATION);
  return normalizeCalibration(raw);
}

export function listAiQualityCalibrationSnapshots(limit = 20) {
  const capped = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.round(limit))) : 20;
  return readCalibrationHistory().slice(0, capped);
}

export function upsertAiQualityCalibration(
  patch: AiQualityCalibrationPatch,
  options?: { updatedBy?: string; reason?: string }
) {
  const current = getAiQualityCalibration();
  snapshotCurrentCalibration({
    reason: options?.reason ?? "manual_update",
    createdBy: options?.updatedBy,
    config: current
  });

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
  writeJson(CALIBRATION_FILE, next);
  return next;
}

export function rollbackAiQualityCalibration(
  snapshotId: string,
  options?: { updatedBy?: string; reason?: string }
) {
  const target = readCalibrationHistory().find((item) => item.id === snapshotId);
  if (!target) return null;
  const current = getAiQualityCalibration();
  snapshotCurrentCalibration({
    reason: options?.reason ?? `rollback_before:${snapshotId}`,
    createdBy: options?.updatedBy,
    config: current
  });

  const next: AiQualityCalibrationConfig = {
    ...normalizeCalibration(target.config),
    updatedAt: new Date().toISOString(),
    updatedBy: options?.updatedBy?.trim() || target.createdBy
  };
  writeJson(CALIBRATION_FILE, next);
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
