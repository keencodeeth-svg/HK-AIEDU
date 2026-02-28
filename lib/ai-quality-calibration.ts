import { readJson, writeJson } from "./storage";

export type AiQualityKind = "assist" | "coach" | "explanation" | "writing" | "assignment_review";

export type AiQualityCalibrationConfig = {
  globalBias: number;
  providerAdjustments: Record<string, number>;
  kindAdjustments: Record<AiQualityKind, number>;
  updatedAt: string;
};

export type AiQualityCalibrationPatch = {
  globalBias?: number;
  providerAdjustments?: Record<string, number>;
  kindAdjustments?: Partial<Record<AiQualityKind, number>>;
};

const CALIBRATION_FILE = "ai-quality-calibration.json";

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
  updatedAt: new Date(0).toISOString()
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

  return {
    globalBias,
    providerAdjustments,
    kindAdjustments,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString()
  };
}

export function getAiQualityCalibration() {
  const raw = readJson<AiQualityCalibrationConfig>(CALIBRATION_FILE, DEFAULT_CALIBRATION);
  return normalizeCalibration(raw);
}

export function upsertAiQualityCalibration(patch: AiQualityCalibrationPatch) {
  const current = getAiQualityCalibration();
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
    updatedAt: new Date().toISOString()
  };
  writeJson(CALIBRATION_FILE, next);
  return next;
}

export function applyAiQualityCalibration(params: {
  score: number;
  provider?: string | null;
  kind: AiQualityKind;
}) {
  const calibration = getAiQualityCalibration();
  const providerKey = (params.provider ?? "").trim().toLowerCase();
  const providerAdjustment = providerKey ? calibration.providerAdjustments[providerKey] ?? 0 : 0;
  const kindAdjustment = calibration.kindAdjustments[params.kind] ?? 0;
  const calibratedScore = clamp(params.score + calibration.globalBias + providerAdjustment + kindAdjustment, 0, 100);

  return {
    score: calibratedScore,
    calibration,
    adjustments: {
      globalBias: calibration.globalBias,
      providerAdjustment,
      kindAdjustment
    }
  };
}

