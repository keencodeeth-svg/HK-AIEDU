import { isDbEnabled, query, queryOne } from "./db";
import { getQuestions } from "./content";
import { type QuestionAttempt, getAttemptsByUser } from "./progress";
import { readJson, writeJson } from "./storage";

export type MasteryLevel = "weak" | "developing" | "strong";

export type MasterySnapshot = {
  knowledgePointId: string;
  subject: string;
  correct: number;
  total: number;
  masteryScore: number;
  confidenceScore: number;
  recencyWeight: number;
  masteryTrend7d: number;
  masteryLevel: MasteryLevel;
  lastAttemptAt: string | null;
};

export type MasteryRecord = MasterySnapshot & {
  id: string;
  userId: string;
  updatedAt: string;
};

type DbMasteryRecord = {
  id: string;
  user_id: string;
  subject: string;
  knowledge_point_id: string;
  correct_count: number;
  total_count: number;
  mastery_score: number;
  confidence_score: number;
  recency_weight: number;
  mastery_trend_7d: number;
  last_attempt_at: string | null;
  updated_at: string;
};

type MasteryAggregateStat = {
  subject: string;
  correct: number;
  total: number;
  weightedCorrect: number;
  weightedTotal: number;
  recencySum: number;
  recentCorrect: number;
  recentTotal: number;
  previousCorrect: number;
  previousTotal: number;
  lastAttemptAt: string | null;
};

const MASTERY_FILE = "mastery-records.json";
const WEAK_THRESHOLD = 60;
const STRONG_THRESHOLD = 85;
const RECENCY_HALF_LIFE_DAYS = 35;
const MIN_RECENCY_RATIO = 0.25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DIFFICULTY_WEIGHT: Record<string, number> = {
  easy: 0.85,
  medium: 1,
  hard: 1.2
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toDifficultyWeight(difficulty: string | undefined) {
  if (!difficulty) return DIFFICULTY_WEIGHT.medium;
  return DIFFICULTY_WEIGHT[difficulty] ?? DIFFICULTY_WEIGHT.medium;
}

function recencyRatioFromAgeDays(ageDays: number) {
  if (!Number.isFinite(ageDays) || ageDays <= 0) {
    return 1;
  }
  return Math.max(MIN_RECENCY_RATIO, Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS));
}

function toRatio(correct: number, total: number) {
  if (total <= 0) return 0;
  return correct / total;
}

function calculateConfidenceScore(total: number) {
  if (total <= 0) return 0;
  const normalized = 1 - Math.exp(-total / 8);
  return clampScore(normalized * 100);
}

function calculateRecencyWeight(recencySum: number, total: number) {
  if (total <= 0) return 0;
  return clampScore((recencySum / total) * 100);
}

function calculateTrend7d(
  recentCorrect: number,
  recentTotal: number,
  previousCorrect: number,
  previousTotal: number
) {
  if (recentTotal <= 0 && previousTotal <= 0) return 0;
  const recentRatio = toRatio(recentCorrect, recentTotal);
  const previousRatio = previousTotal > 0 ? toRatio(previousCorrect, previousTotal) : recentRatio;
  return Math.round((recentRatio - previousRatio) * 100);
}

function normalizeMasteryRecord(record: MasteryRecord): MasteryRecord {
  return {
    ...record,
    masteryScore: clampScore(record.masteryScore),
    confidenceScore: clampScore(record.confidenceScore ?? 0),
    recencyWeight: clampScore(record.recencyWeight ?? 0),
    masteryTrend7d: Number.isFinite(record.masteryTrend7d) ? Math.round(record.masteryTrend7d) : 0,
    masteryLevel: getMasteryLevel(record.masteryScore)
  };
}

export function calculateMasteryScore(
  correct: number,
  total: number,
  weightedCorrect?: number,
  weightedTotal?: number
) {
  if (weightedTotal !== undefined && weightedTotal > 0 && weightedCorrect !== undefined) {
    const smoothed = ((weightedCorrect + 0.8) / (weightedTotal + 1.6)) * 100;
    return clampScore(smoothed);
  }
  if (total <= 0) return 0;
  const smoothed = ((correct + 1) / (total + 2)) * 100;
  return clampScore(smoothed);
}

export function getMasteryLevel(score: number): MasteryLevel {
  if (score >= STRONG_THRESHOLD) return "strong";
  if (score >= WEAK_THRESHOLD) return "developing";
  return "weak";
}

export function buildMasterySnapshot(input: {
  knowledgePointId: string;
  subject: string;
  correct: number;
  total: number;
  confidenceScore?: number;
  recencyWeight?: number;
  masteryTrend7d?: number;
  lastAttemptAt?: string | null;
}): MasterySnapshot {
  const masteryScore = calculateMasteryScore(input.correct, input.total);
  return {
    knowledgePointId: input.knowledgePointId,
    subject: input.subject,
    correct: input.correct,
    total: input.total,
    masteryScore,
    confidenceScore: clampScore(input.confidenceScore ?? calculateConfidenceScore(input.total)),
    recencyWeight: clampScore(input.recencyWeight ?? 0),
    masteryTrend7d: Number.isFinite(input.masteryTrend7d) ? Math.round(input.masteryTrend7d ?? 0) : 0,
    masteryLevel: getMasteryLevel(masteryScore),
    lastAttemptAt: input.lastAttemptAt ?? null
  };
}

function mapDbRecord(row: DbMasteryRecord): MasteryRecord {
  return normalizeMasteryRecord({
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    knowledgePointId: row.knowledge_point_id,
    correct: row.correct_count,
    total: row.total_count,
    masteryScore: row.mastery_score,
    confidenceScore: row.confidence_score ?? 0,
    recencyWeight: row.recency_weight ?? 0,
    masteryTrend7d: row.mastery_trend_7d ?? 0,
    masteryLevel: getMasteryLevel(row.mastery_score),
    lastAttemptAt: row.last_attempt_at,
    updatedAt: row.updated_at
  });
}

async function buildRecordsFromAttempts(userId: string, attempts: QuestionAttempt[], subject?: string) {
  const nowTs = Date.now();
  const recentWindowStart = nowTs - 7 * MS_PER_DAY;
  const previousWindowStart = nowTs - 14 * MS_PER_DAY;
  const questions = await getQuestions();
  const questionMap = new Map(questions.map((item) => [item.id, item]));

  const stats = new Map<string, MasteryAggregateStat>();

  attempts.forEach((attempt) => {
    if (subject && attempt.subject !== subject) return;

    const current =
      stats.get(attempt.knowledgePointId) ??
      ({
        subject: attempt.subject,
        correct: 0,
        total: 0,
        weightedCorrect: 0,
        weightedTotal: 0,
        recencySum: 0,
        recentCorrect: 0,
        recentTotal: 0,
        previousCorrect: 0,
        previousTotal: 0,
        lastAttemptAt: null
      } satisfies MasteryAggregateStat);

    const attemptTs = new Date(attempt.createdAt).getTime();
    const ageDays = Number.isFinite(attemptTs) ? Math.max(0, (nowTs - attemptTs) / MS_PER_DAY) : 0;
    const recencyRatio = recencyRatioFromAgeDays(ageDays);
    const difficulty = questionMap.get(attempt.questionId)?.difficulty;
    const weight = recencyRatio * toDifficultyWeight(difficulty);

    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    current.weightedTotal += weight;
    current.weightedCorrect += attempt.correct ? weight : 0;
    current.recencySum += recencyRatio;

    if (attemptTs >= recentWindowStart) {
      current.recentTotal += 1;
      current.recentCorrect += attempt.correct ? 1 : 0;
    } else if (attemptTs >= previousWindowStart) {
      current.previousTotal += 1;
      current.previousCorrect += attempt.correct ? 1 : 0;
    }

    if (!current.lastAttemptAt || new Date(current.lastAttemptAt).getTime() < attemptTs) {
      current.lastAttemptAt = attempt.createdAt;
    }

    stats.set(attempt.knowledgePointId, current);
  });

  const now = new Date().toISOString();
  const records = Array.from(stats.entries()).map(([knowledgePointId, stat]) => {
    const masteryScore = calculateMasteryScore(
      stat.correct,
      stat.total,
      stat.weightedCorrect,
      stat.weightedTotal
    );
    const snapshot = buildMasterySnapshot({
      knowledgePointId,
      subject: stat.subject,
      correct: stat.correct,
      total: stat.total,
      confidenceScore: calculateConfidenceScore(stat.total),
      recencyWeight: calculateRecencyWeight(stat.recencySum, stat.total),
      masteryTrend7d: calculateTrend7d(
        stat.recentCorrect,
        stat.recentTotal,
        stat.previousCorrect,
        stat.previousTotal
      ),
      lastAttemptAt: stat.lastAttemptAt
    });

    return normalizeMasteryRecord({
      id: `mastery-${userId}-${knowledgePointId}`,
      userId,
      ...snapshot,
      masteryScore,
      masteryLevel: getMasteryLevel(masteryScore),
      updatedAt: now
    });
  });

  return records.sort((a, b) => a.knowledgePointId.localeCompare(b.knowledgePointId));
}

async function readMasteryRecords(userId: string, subject?: string) {
  if (!isDbEnabled()) {
    const records = readJson<MasteryRecord[]>(MASTERY_FILE, []).map(normalizeMasteryRecord);
    return records.filter((item) => item.userId === userId && (!subject || item.subject === subject));
  }

  const rows = subject
    ? await query<DbMasteryRecord>(
        "SELECT * FROM mastery_records WHERE user_id = $1 AND subject = $2",
        [userId, subject]
      )
    : await query<DbMasteryRecord>("SELECT * FROM mastery_records WHERE user_id = $1", [userId]);
  return rows.map(mapDbRecord);
}

async function replaceMasteryRecords(userId: string, subject: string | undefined, records: MasteryRecord[]) {
  if (!isDbEnabled()) {
    const all = readJson<MasteryRecord[]>(MASTERY_FILE, []);
    const remained = all.filter((item) => {
      if (item.userId !== userId) return true;
      if (!subject) return false;
      return item.subject !== subject;
    });
    writeJson(MASTERY_FILE, [...remained, ...records]);
    return;
  }

  if (subject) {
    await query("DELETE FROM mastery_records WHERE user_id = $1 AND subject = $2", [userId, subject]);
  } else {
    await query("DELETE FROM mastery_records WHERE user_id = $1", [userId]);
  }

  for (const record of records) {
    await query(
      `INSERT INTO mastery_records
       (id, user_id, subject, knowledge_point_id, correct_count, total_count, mastery_score, confidence_score, recency_weight, mastery_trend_7d, last_attempt_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        record.id,
        record.userId,
        record.subject,
        record.knowledgePointId,
        record.correct,
        record.total,
        record.masteryScore,
        record.confidenceScore,
        record.recencyWeight,
        record.masteryTrend7d,
        record.lastAttemptAt,
        record.updatedAt
      ]
    );
  }
}

export async function syncMasteryFromAttempts(userId: string, subject?: string) {
  const attempts = await getAttemptsByUser(userId);
  const nextRecords = await buildRecordsFromAttempts(userId, attempts, subject);
  await replaceMasteryRecords(userId, subject, nextRecords);
  return nextRecords;
}

export async function getMasteryRecordsByUser(userId: string, subject?: string) {
  const records = await readMasteryRecords(userId, subject);
  if (records.length) {
    return records;
  }
  return syncMasteryFromAttempts(userId, subject);
}

export async function getMasteryRecord(userId: string, knowledgePointId: string, subject?: string) {
  if (!isDbEnabled()) {
    const records = readJson<MasteryRecord[]>(MASTERY_FILE, []).map(normalizeMasteryRecord);
    const found = records.find(
      (item) =>
        item.userId === userId &&
        item.knowledgePointId === knowledgePointId &&
        (!subject || item.subject === subject)
    );
    if (found) return found;
    const synced = await syncMasteryFromAttempts(userId, subject);
    return synced.find((item) => item.knowledgePointId === knowledgePointId) ?? null;
  }

  const row = subject
    ? await queryOne<DbMasteryRecord>(
        "SELECT * FROM mastery_records WHERE user_id = $1 AND knowledge_point_id = $2 AND subject = $3",
        [userId, knowledgePointId, subject]
      )
    : await queryOne<DbMasteryRecord>(
        "SELECT * FROM mastery_records WHERE user_id = $1 AND knowledge_point_id = $2",
        [userId, knowledgePointId]
      );

  if (row) {
    return mapDbRecord(row);
  }

  const synced = await syncMasteryFromAttempts(userId, subject);
  return synced.find((item) => item.knowledgePointId === knowledgePointId) ?? null;
}

export function getWeaknessRankMap(records: MasteryRecord[], subject?: string) {
  const filtered = subject ? records.filter((item) => item.subject === subject) : records;
  const ranked = filtered
    .slice()
    .sort((a, b) => {
      if (a.masteryScore !== b.masteryScore) return a.masteryScore - b.masteryScore;
      if (a.masteryTrend7d !== b.masteryTrend7d) return a.masteryTrend7d - b.masteryTrend7d;
      if (a.confidenceScore !== b.confidenceScore) return a.confidenceScore - b.confidenceScore;
      if (a.total !== b.total) return b.total - a.total;
      return a.knowledgePointId.localeCompare(b.knowledgePointId);
    })
    .map((item, index) => [item.knowledgePointId, index + 1] as const);

  return new Map(ranked);
}

export function indexMasteryByKnowledgePoint(records: MasteryRecord[]) {
  return new Map(records.map((item) => [item.knowledgePointId, item]));
}
