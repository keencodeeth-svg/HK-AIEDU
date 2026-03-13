import crypto from "crypto";

export const STUDY_VARIANT_ATTEMPT_REASON = "study-variant";

type StudyVariantAttemptLike = {
  reason?: string;
  createdAt: string;
  knowledgePointId: string;
  subject: string;
  correct: boolean;
};

export type StudyVariantActivitySummary = {
  recentAttemptCount: number;
  recentCorrectCount: number;
  latestAttemptAt: string;
  latestKnowledgePointId: string;
  latestSubject: string;
  latestCorrect: boolean;
};

function normalizeText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function toTimestamp(value: string | undefined) {
  const ts = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ts) ? ts : null;
}

export function isStudyVariantAttemptReason(reason?: string) {
  return normalizeText(reason).toLowerCase() === STUDY_VARIANT_ATTEMPT_REASON;
}

export function buildStudyVariantQuestionId(input: {
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  stem: string;
}) {
  const seed = [
    normalizeText(input.subject),
    normalizeText(input.grade),
    normalizeText(input.knowledgePointId),
    normalizeText(input.stem)
  ].join("|");
  const hash = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 20);
  return `study-variant:${hash}`;
}

export function buildStudyVariantProgressMessage(input: {
  persisted: boolean;
  knowledgePointTitle?: string;
  masteryScore?: number | null;
  masteryDelta?: number | null;
}) {
  if (!input.persisted) {
    return "当前练习未计入学生成长画像。";
  }

  const topic = normalizeText(input.knowledgePointTitle) || "该知识点";
  const score = typeof input.masteryScore === "number" ? input.masteryScore : 0;
  const delta = typeof input.masteryDelta === "number" ? input.masteryDelta : 0;
  return `${topic} 已计入学习成长，当前掌握 ${score} 分${delta !== 0 ? `（${delta > 0 ? "+" : ""}${delta}）` : ""}。`;
}

export function summarizeRecentStudyVariantAttempts(input: {
  attempts: StudyVariantAttemptLike[];
  now?: number;
  windowHours?: number;
}) {
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const windowHours = Math.max(1, input.windowHours ?? 24);
  const windowStart = now - windowHours * 60 * 60 * 1000;

  const studyVariantAttempts = input.attempts
    .filter((attempt) => isStudyVariantAttemptReason(attempt.reason))
    .map((attempt) => ({ ...attempt, ts: toTimestamp(attempt.createdAt) }))
    .filter((attempt): attempt is StudyVariantAttemptLike & { ts: number } => typeof attempt.ts === "number")
    .sort((left, right) => right.ts - left.ts);

  const recentAttempts = studyVariantAttempts.filter((attempt) => attempt.ts >= windowStart);
  const latestAttempt = recentAttempts[0] ?? studyVariantAttempts[0] ?? null;
  if (!latestAttempt) {
    return null;
  }

  return {
    recentAttemptCount: recentAttempts.length,
    recentCorrectCount: recentAttempts.filter((attempt) => attempt.correct).length,
    latestAttemptAt: latestAttempt.createdAt,
    latestKnowledgePointId: latestAttempt.knowledgePointId,
    latestSubject: latestAttempt.subject,
    latestCorrect: latestAttempt.correct
  } satisfies StudyVariantActivitySummary;
}
