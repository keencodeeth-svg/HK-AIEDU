import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";
import { getQuestions } from "./content";
import type { Question } from "./types";
import {
  getReviewTasksByUser,
  isUnifiedReviewTaskStoreEnabled,
  type ReviewTask,
  upsertReviewTask
} from "./review-tasks";

export type MemoryReview = {
  id: string;
  userId: string;
  questionId: string;
  stage: number;
  nextReviewAt: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryReviewReadOptions = {
  preferUnifiedStore?: boolean;
};

const REVIEW_FILE = "memory-reviews.json";
const STAGES = [1, 3, 7, 14, 30];

function canUseApiTestMemoryFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireMemoryReviewsDatabase() {
  requireDatabaseEnabled("memory_reviews");
}

type DbMemoryReview = {
  id: string;
  user_id: string;
  question_id: string;
  stage: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapReview(row: DbMemoryReview): MemoryReview {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    stage: row.stage,
    nextReviewAt: row.next_review_at,
    lastReviewedAt: row.last_reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPersistedReviewTask(task: ReviewTask): MemoryReview {
  return {
    id: task.id,
    userId: task.userId,
    questionId: task.questionId,
    stage: Math.max(0, Number(task.intervalLevel) || 0),
    nextReviewAt: task.nextReviewAt,
    lastReviewedAt: task.lastReviewAt ?? undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function compareMemoryReviews(a: MemoryReview, b: MemoryReview) {
  return new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime();
}

function nextStage(current: number, correct: boolean) {
  if (!correct) return 0;
  return Math.min(current + 1, STAGES.length - 1);
}

function calcNextReviewAt(stage: number) {
  const days = STAGES[Math.max(0, Math.min(stage, STAGES.length - 1))];
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isPersistedMemoryReviewOutdated(task: MemoryReview | null | undefined, legacy: MemoryReview) {
  if (!task) return true;
  return (
    task.stage !== legacy.stage ||
    task.nextReviewAt !== legacy.nextReviewAt ||
    (task.lastReviewedAt ?? null) !== (legacy.lastReviewedAt ?? null) ||
    task.updatedAt < legacy.updatedAt
  );
}

async function syncMemoryReviewTask(review: MemoryReview | null) {
  if (!review) return null;
  const question = (await getQuestions()).find((item) => item.id === review.questionId);
  return upsertReviewTask({
    userId: review.userId,
    questionId: review.questionId,
    sourceType: "memory",
    subject: question?.subject ?? null,
    knowledgePointId: question?.knowledgePointId ?? null,
    status: "active",
    intervalLevel: review.stage,
    nextReviewAt: review.nextReviewAt,
    completedAt: null,
    lastReviewResult: null,
    lastReviewAt: review.lastReviewedAt ?? null,
    reviewCount: review.stage,
    originType: null,
    originPaperId: null,
    originSubmittedAt: null,
    payload: {
      grade: question?.grade ?? null
    }
  });
}

async function getPersistedMemoryReviewsByUser(userId: string) {
  const tasks = await getReviewTasksByUser(userId, {
    includeCompleted: true,
    sourceTypes: ["memory"]
  });
  return tasks.map(mapPersistedReviewTask).sort(compareMemoryReviews);
}

async function getLegacyMemoryReviewsByUser(userId: string) {
  if (canUseApiTestMemoryFallback()) {
    const list = readJson<MemoryReview[]>(REVIEW_FILE, []);
    return list.filter((item) => item.userId === userId).sort(compareMemoryReviews);
  }
  requireMemoryReviewsDatabase();

  const rows = await query<DbMemoryReview>(
    "SELECT * FROM memory_reviews WHERE user_id = $1 ORDER BY next_review_at ASC",
    [userId]
  );
  return rows.map(mapReview);
}

export async function ensureMemoryReviewTasksBackfilled(userId: string) {
  if (!isUnifiedReviewTaskStoreEnabled()) return;
  const [legacyReviews, persistedReviews] = await Promise.all([
    getLegacyMemoryReviewsByUser(userId),
    getPersistedMemoryReviewsByUser(userId)
  ]);
  if (!legacyReviews.length) return;

  const persistedByQuestionId = new Map(persistedReviews.map((item) => [item.questionId, item]));
  const reviewsToSync = legacyReviews.filter((item) =>
    isPersistedMemoryReviewOutdated(persistedByQuestionId.get(item.questionId), item)
  );
  if (!reviewsToSync.length) return;

  await Promise.all(reviewsToSync.map((item) => syncMemoryReviewTask(item)));
}

export async function updateMemorySchedule(params: {
  userId: string;
  questionId: string;
  correct: boolean;
}) {
  const now = new Date().toISOString();
  if (canUseApiTestMemoryFallback()) {
    const list = readJson<MemoryReview[]>(REVIEW_FILE, []);
    const index = list.findIndex(
      (item) => item.userId === params.userId && item.questionId === params.questionId
    );
    const current = index >= 0 ? list[index] : null;
    const stage = nextStage(current?.stage ?? 0, params.correct);
    const nextReviewAt = calcNextReviewAt(stage);
    const record: MemoryReview = {
      id: current?.id ?? `mem-${crypto.randomBytes(6).toString("hex")}`,
      userId: params.userId,
      questionId: params.questionId,
      stage,
      nextReviewAt,
      lastReviewedAt: now,
      createdAt: current?.createdAt ?? now,
      updatedAt: now
    };
    if (index >= 0) {
      list[index] = record;
    } else {
      list.push(record);
    }
    writeJson(REVIEW_FILE, list);
    await syncMemoryReviewTask(record);
    return record;
  }
  requireMemoryReviewsDatabase();

  const existing = await queryOne<DbMemoryReview>(
    "SELECT * FROM memory_reviews WHERE user_id = $1 AND question_id = $2",
    [params.userId, params.questionId]
  );
  const stage = nextStage(existing?.stage ?? 0, params.correct);
  const nextReviewAt = calcNextReviewAt(stage);
  const record = await queryOne<DbMemoryReview>(
    `INSERT INTO memory_reviews
     (id, user_id, question_id, stage, next_review_at, last_reviewed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       stage = EXCLUDED.stage,
       next_review_at = EXCLUDED.next_review_at,
       last_reviewed_at = EXCLUDED.last_reviewed_at,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      existing?.id ?? `mem-${crypto.randomBytes(6).toString("hex")}`,
      params.userId,
      params.questionId,
      stage,
      nextReviewAt,
      now,
      existing?.created_at ?? now,
      now
    ]
  );
  const mapped = record ? mapReview(record) : null;
  await syncMemoryReviewTask(mapped);
  return mapped;
}

export function getMemoryStageLabel(stage: number) {
  const days = STAGES[Math.max(0, Math.min(stage, STAGES.length - 1))];
  return `${days}d`;
}

export async function getMemoryReviewsByUser(userId: string, options?: MemoryReviewReadOptions) {
  if (!canUseApiTestMemoryFallback() && !isDbEnabled()) {
    requireMemoryReviewsDatabase();
  }
  const preferUnifiedStore = options?.preferUnifiedStore ?? true;
  if (preferUnifiedStore && isUnifiedReviewTaskStoreEnabled()) {
    await ensureMemoryReviewTasksBackfilled(userId);
    const persistedReviews = await getPersistedMemoryReviewsByUser(userId);
    if (persistedReviews.length) {
      return persistedReviews;
    }
  }

  return getLegacyMemoryReviewsByUser(userId);
}

export async function getDueReviewQuestionIds(userId: string) {
  const reviews = await getMemoryReviewsByUser(userId);
  const now = Date.now();
  return reviews
    .filter((item) => new Date(item.nextReviewAt).getTime() <= now)
    .map((item) => item.questionId);
}

export async function getDueReviewQuestions(params: {
  userId: string;
  subject: string;
  grade: string;
  limit?: number;
}): Promise<Question[]> {
  const dueIds = await getDueReviewQuestionIds(params.userId);
  if (!dueIds.length) return [];
  const all = await getQuestions();
  const set = new Set(dueIds);
  const filtered = all.filter(
    (q) => set.has(q.id) && q.subject === params.subject && q.grade === params.grade
  );
  return filtered.slice(0, params.limit ?? 10);
}
