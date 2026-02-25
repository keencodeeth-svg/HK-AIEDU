import { isDbEnabled, query, queryOne } from "./db";
import { type QuestionAttempt, getAttemptsByUser } from "./progress";
import { readJson, writeJson } from "./storage";

export type MasteryLevel = "weak" | "developing" | "strong";

export type MasterySnapshot = {
  knowledgePointId: string;
  subject: string;
  correct: number;
  total: number;
  masteryScore: number;
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
  last_attempt_at: string | null;
  updated_at: string;
};

const MASTERY_FILE = "mastery-records.json";
const WEAK_THRESHOLD = 60;
const STRONG_THRESHOLD = 85;

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateMasteryScore(correct: number, total: number) {
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
  lastAttemptAt?: string | null;
}): MasterySnapshot {
  const masteryScore = calculateMasteryScore(input.correct, input.total);
  return {
    knowledgePointId: input.knowledgePointId,
    subject: input.subject,
    correct: input.correct,
    total: input.total,
    masteryScore,
    masteryLevel: getMasteryLevel(masteryScore),
    lastAttemptAt: input.lastAttemptAt ?? null
  };
}

function mapDbRecord(row: DbMasteryRecord): MasteryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    knowledgePointId: row.knowledge_point_id,
    correct: row.correct_count,
    total: row.total_count,
    masteryScore: row.mastery_score,
    masteryLevel: getMasteryLevel(row.mastery_score),
    lastAttemptAt: row.last_attempt_at,
    updatedAt: row.updated_at
  };
}

function buildRecordsFromAttempts(userId: string, attempts: QuestionAttempt[], subject?: string) {
  const stats = new Map<
    string,
    { subject: string; correct: number; total: number; lastAttemptAt: string | null }
  >();

  attempts.forEach((attempt) => {
    if (subject && attempt.subject !== subject) return;
    const current = stats.get(attempt.knowledgePointId) ?? {
      subject: attempt.subject,
      correct: 0,
      total: 0,
      lastAttemptAt: null
    };
    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    if (!current.lastAttemptAt || new Date(attempt.createdAt).getTime() > new Date(current.lastAttemptAt).getTime()) {
      current.lastAttemptAt = attempt.createdAt;
    }
    stats.set(attempt.knowledgePointId, current);
  });

  const now = new Date().toISOString();
  const records = Array.from(stats.entries()).map(([knowledgePointId, stat]) => {
    const snapshot = buildMasterySnapshot({
      knowledgePointId,
      subject: stat.subject,
      correct: stat.correct,
      total: stat.total,
      lastAttemptAt: stat.lastAttemptAt
    });
    return {
      id: `mastery-${userId}-${knowledgePointId}`,
      userId,
      ...snapshot,
      updatedAt: now
    } as MasteryRecord;
  });

  return records.sort((a, b) => a.knowledgePointId.localeCompare(b.knowledgePointId));
}

async function readMasteryRecords(userId: string, subject?: string) {
  if (!isDbEnabled()) {
    const records = readJson<MasteryRecord[]>(MASTERY_FILE, []);
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
       (id, user_id, subject, knowledge_point_id, correct_count, total_count, mastery_score, last_attempt_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        record.id,
        record.userId,
        record.subject,
        record.knowledgePointId,
        record.correct,
        record.total,
        record.masteryScore,
        record.lastAttemptAt,
        record.updatedAt
      ]
    );
  }
}

export async function syncMasteryFromAttempts(userId: string, subject?: string) {
  const attempts = await getAttemptsByUser(userId);
  const nextRecords = buildRecordsFromAttempts(userId, attempts, subject);
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
    const records = readJson<MasteryRecord[]>(MASTERY_FILE, []);
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

export function indexMasteryByKnowledgePoint(records: MasteryRecord[]) {
  return new Map(records.map((item) => [item.knowledgePointId, item]));
}
