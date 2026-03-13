import crypto from "crypto";
import type { AiLearningMode, AssistAnswerMode, AiQualityMeta } from "./ai-types";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export const AI_HISTORY_ORIGINS = ["text", "image", "refine"] as const;

export type AiHistoryOrigin = (typeof AI_HISTORY_ORIGINS)[number];

export type AiHistoryMeta = {
  origin?: AiHistoryOrigin;
  learningMode?: AiLearningMode;
  subject?: string;
  grade?: string;
  answerMode?: AssistAnswerMode;
  provider?: string;
  recognizedQuestion?: string;
  imageCount?: number;
  quality?: AiQualityMeta;
};

export type AiHistoryItem = {
  id: string;
  userId: string;
  question: string;
  answer: string;
  createdAt: string;
  favorite: boolean;
  tags: string[];
  meta?: AiHistoryMeta;
};

const HISTORY_FILE = "ai-history.json";
const AI_HISTORY_ANSWER_MODES = ["answer_only", "step_by_step", "hints_first"] as const;
const AI_HISTORY_LEARNING_MODES = ["direct", "study"] as const;
const AI_HISTORY_RISK_LEVELS = ["low", "medium", "high"] as const;

type DbHistory = {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  created_at: string;
  favorite: boolean;
  tags: string[];
  meta?: unknown;
};

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.filter(isNonEmptyString).map((item) => String(item).trim());
}

function normalizeHistoryMeta(input: unknown): AiHistoryMeta | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const value = input as Record<string, unknown>;
  const origin =
    typeof value.origin === "string" && AI_HISTORY_ORIGINS.includes(value.origin as AiHistoryOrigin)
      ? (value.origin as AiHistoryOrigin)
      : undefined;
  const learningMode =
    typeof value.learningMode === "string" &&
    AI_HISTORY_LEARNING_MODES.includes(value.learningMode as (typeof AI_HISTORY_LEARNING_MODES)[number])
      ? (value.learningMode as AiLearningMode)
      : undefined;
  const answerMode =
    typeof value.answerMode === "string" &&
    AI_HISTORY_ANSWER_MODES.includes(value.answerMode as (typeof AI_HISTORY_ANSWER_MODES)[number])
      ? (value.answerMode as AssistAnswerMode)
      : undefined;

  let quality: AiQualityMeta | undefined;
  if (value.quality && typeof value.quality === "object" && !Array.isArray(value.quality)) {
    const qualityValue = value.quality as Record<string, unknown>;
    const riskLevel =
      typeof qualityValue.riskLevel === "string" &&
      AI_HISTORY_RISK_LEVELS.includes(qualityValue.riskLevel as (typeof AI_HISTORY_RISK_LEVELS)[number])
        ? (qualityValue.riskLevel as AiQualityMeta["riskLevel"])
        : undefined;
    const confidenceScore =
      typeof qualityValue.confidenceScore === "number" && Number.isFinite(qualityValue.confidenceScore)
        ? qualityValue.confidenceScore
        : undefined;

    if (typeof confidenceScore === "number" && riskLevel) {
      quality = {
        confidenceScore,
        riskLevel,
        needsHumanReview: Boolean(qualityValue.needsHumanReview),
        fallbackAction: isNonEmptyString(qualityValue.fallbackAction) ? String(qualityValue.fallbackAction).trim() : "",
        reasons: normalizeStringArray(qualityValue.reasons),
        minQualityScore:
          typeof qualityValue.minQualityScore === "number" && Number.isFinite(qualityValue.minQualityScore)
            ? qualityValue.minQualityScore
            : undefined,
        policyViolated: typeof qualityValue.policyViolated === "boolean" ? qualityValue.policyViolated : undefined
      };
    }
  }

  const next: AiHistoryMeta = {
    origin,
    learningMode,
    subject: isNonEmptyString(value.subject) ? String(value.subject).trim() : undefined,
    grade: isNonEmptyString(value.grade) ? String(value.grade).trim() : undefined,
    answerMode,
    provider: isNonEmptyString(value.provider) ? String(value.provider).trim() : undefined,
    recognizedQuestion: isNonEmptyString(value.recognizedQuestion) ? String(value.recognizedQuestion).trim() : undefined,
    imageCount:
      typeof value.imageCount === "number" && Number.isFinite(value.imageCount) && value.imageCount > 0
        ? Math.round(value.imageCount)
        : undefined,
    quality
  };

  if (Object.values(next).every((item) => item === undefined)) {
    return undefined;
  }

  return next;
}

function mapHistory(row: DbHistory): AiHistoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
    favorite: row.favorite,
    tags: row.tags ?? [],
    meta: normalizeHistoryMeta(row.meta)
  };
}

export async function getHistory(): Promise<AiHistoryItem[]> {
  if (!isDbEnabled()) {
    return readJson<AiHistoryItem[]>(HISTORY_FILE, []).map((item) => ({
      ...item,
      meta: normalizeHistoryMeta(item.meta)
    }));
  }
  const rows = await query<DbHistory>("SELECT * FROM ai_history");
  return rows.map(mapHistory);
}

export async function saveHistory(list: AiHistoryItem[]) {
  if (!isDbEnabled()) {
    writeJson(
      HISTORY_FILE,
      list.map((item) => ({
        ...item,
        meta: normalizeHistoryMeta(item.meta)
      }))
    );
  }
}

export async function getHistoryByUser(userId: string) {
  if (!isDbEnabled()) {
    const list = await getHistory();
    return list
      .filter((item) => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  const rows = await query<DbHistory>(
    "SELECT * FROM ai_history WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(mapHistory);
}

export async function addHistoryItem(input: Omit<AiHistoryItem, "id" | "createdAt">) {
  const meta = normalizeHistoryMeta(input.meta);

  if (!isDbEnabled()) {
    const list = await getHistory();
    const next: AiHistoryItem = {
      id: `ai-${crypto.randomBytes(6).toString("hex")}`,
      createdAt: new Date().toISOString(),
      userId: input.userId,
      question: input.question,
      answer: input.answer,
      favorite: input.favorite,
      tags: input.tags,
      meta
    };
    list.push(next);
    await saveHistory(list);
    return next;
  }

  const id = `ai-${crypto.randomBytes(6).toString("hex")}`;
  const createdAt = new Date().toISOString();
  const row = await queryOne<DbHistory>(
    `INSERT INTO ai_history (id, user_id, question, answer, favorite, tags, created_at, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING *`,
    [id, input.userId, input.question, input.answer, input.favorite, input.tags, createdAt, meta ?? {}]
  );
  return row ? mapHistory(row) : null;
}

export async function updateHistoryItem(id: string, patch: Partial<AiHistoryItem>) {
  if (!isDbEnabled()) {
    const list = await getHistory();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const next = {
      ...list[index],
      ...patch,
      id,
      meta: normalizeHistoryMeta(patch.meta ?? list[index].meta)
    } as AiHistoryItem;
    list[index] = next;
    await saveHistory(list);
    return next;
  }

  const row = await queryOne<DbHistory>(
    `UPDATE ai_history
     SET favorite = COALESCE($2, favorite),
         tags = COALESCE($3, tags)
     WHERE id = $1
     RETURNING *`,
    [id, patch.favorite ?? null, patch.tags ?? null]
  );
  return row ? mapHistory(row) : null;
}

export async function deleteHistoryItem(id: string) {
  if (!isDbEnabled()) {
    const list = await getHistory();
    const next = list.filter((item) => item.id !== id);
    await saveHistory(next);
    return list.length !== next.length;
  }
  const rows = await query<{ id: string }>("DELETE FROM ai_history WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}
