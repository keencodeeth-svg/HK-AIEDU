import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";

export type ReviewTaskSourceType = "wrong" | "memory";
export type ReviewTaskResult = "correct" | "wrong" | null;
export type ReviewTaskStatus = "active" | "completed";
export type ReviewTaskOriginType = "practice" | "diagnostic" | "assignment" | "exam" | "wrong_book_review" | null;

export type ReviewTask = {
  id: string;
  userId: string;
  questionId: string;
  sourceType: ReviewTaskSourceType;
  subject: string | null;
  knowledgePointId: string | null;
  status: ReviewTaskStatus;
  intervalLevel: number;
  nextReviewAt: string;
  completedAt: string | null;
  lastReviewResult: ReviewTaskResult;
  lastReviewAt: string | null;
  reviewCount: number;
  originType: ReviewTaskOriginType;
  originPaperId: string | null;
  originSubmittedAt: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type DbReviewTask = {
  id: string;
  user_id: string;
  question_id: string;
  source_type: string | null;
  subject: string | null;
  knowledge_point_id: string | null;
  status: string;
  interval_level: number;
  due_at: string;
  completed_at: string | null;
  last_review_result: string | null;
  last_review_at: string | null;
  review_count: number;
  origin_type: string | null;
  origin_paper_id: string | null;
  origin_submitted_at: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const REVIEW_TASK_FILE = "review-tasks.json";

function canUseApiTestReviewTaskFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireReviewTasksDatabase() {
  requireDatabaseEnabled("review_tasks");
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeSourceType(value: unknown): ReviewTaskSourceType {
  return value === "memory" ? "memory" : "wrong";
}

function normalizeStatus(value: unknown): ReviewTaskStatus {
  return value === "completed" ? "completed" : "active";
}

function normalizeResult(value: unknown): ReviewTaskResult {
  if (value === "correct" || value === "wrong") return value;
  return null;
}

function normalizeOriginType(value: unknown): ReviewTaskOriginType {
  if (
    value === "practice" ||
    value === "diagnostic" ||
    value === "assignment" ||
    value === "exam" ||
    value === "wrong_book_review"
  ) {
    return value;
  }
  return null;
}

function normalizePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapRow(row: DbReviewTask): ReviewTask {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    sourceType: normalizeSourceType(row.source_type),
    subject: normalizeOptionalString(row.subject),
    knowledgePointId: normalizeOptionalString(row.knowledge_point_id),
    status: normalizeStatus(row.status),
    intervalLevel: Math.max(0, Number(row.interval_level) || 0),
    nextReviewAt: row.due_at,
    completedAt: normalizeOptionalString(row.completed_at),
    lastReviewResult: normalizeResult(row.last_review_result),
    lastReviewAt: normalizeOptionalString(row.last_review_at),
    reviewCount: Math.max(0, Number(row.review_count) || 0),
    originType: normalizeOriginType(row.origin_type),
    originPaperId: normalizeOptionalString(row.origin_paper_id),
    originSubmittedAt: normalizeOptionalString(row.origin_submitted_at),
    payload: normalizePayload(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJsonItem(item: ReviewTask): ReviewTask {
  return {
    ...item,
    sourceType: normalizeSourceType(item.sourceType),
    subject: normalizeOptionalString(item.subject),
    knowledgePointId: normalizeOptionalString(item.knowledgePointId),
    status: normalizeStatus(item.status),
    intervalLevel: Math.max(0, Number(item.intervalLevel) || 0),
    nextReviewAt: item.nextReviewAt,
    completedAt: normalizeOptionalString(item.completedAt),
    lastReviewResult: normalizeResult(item.lastReviewResult),
    lastReviewAt: normalizeOptionalString(item.lastReviewAt),
    reviewCount: Math.max(0, Number(item.reviewCount) || 0),
    originType: normalizeOriginType(item.originType),
    originPaperId: normalizeOptionalString(item.originPaperId),
    originSubmittedAt: normalizeOptionalString(item.originSubmittedAt),
    payload: normalizePayload(item.payload),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function compareReviewTasks(a: ReviewTask, b: ReviewTask) {
  const statusRank = (status: ReviewTaskStatus) => (status === "active" ? 0 : 1);
  if (statusRank(a.status) !== statusRank(b.status)) {
    return statusRank(a.status) - statusRank(b.status);
  }
  const dueDiff = new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime();
  if (dueDiff !== 0) return dueDiff;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function isUnifiedReviewTaskStoreEnabled() {
  if (process.env.UNIFIED_REVIEW_ENGINE === "false") return false;
  if (process.env.UNIFIED_REVIEW_ENGINE === "true") return true;
  return true;
}

function buildIdentity(userId: string, questionId: string, sourceType: ReviewTaskSourceType) {
  return `${userId}:${sourceType}:${questionId}`;
}

export async function getReviewTasksByUser(
  userId: string,
  options?: { includeCompleted?: boolean; sourceTypes?: ReviewTaskSourceType[] }
) {
  if (!isUnifiedReviewTaskStoreEnabled()) return [];
  const includeCompleted = options?.includeCompleted ?? false;
  const sourceTypes = options?.sourceTypes?.length ? Array.from(new Set(options.sourceTypes)) : null;

  if (canUseApiTestReviewTaskFallback()) {
    const list = readJson<ReviewTask[]>(REVIEW_TASK_FILE, []).map(mapJsonItem);
    return list
      .filter((item) => item.userId === userId)
      .filter((item) => (includeCompleted ? true : item.status === "active"))
      .filter((item) => (sourceTypes ? sourceTypes.includes(item.sourceType) : true))
      .sort(compareReviewTasks);
  }
  requireReviewTasksDatabase();

  const clauses = ["user_id = $1"];
  const params: Array<string | string[]> = [userId];

  if (!includeCompleted) {
    clauses.push("status = 'active'");
  }

  if (sourceTypes) {
    params.push(sourceTypes);
    clauses.push(`source_type = ANY($${params.length})`);
  }

  const rows = await query<DbReviewTask>(
    `SELECT * FROM review_tasks WHERE ${clauses.join(" AND ")} ORDER BY due_at ASC, updated_at DESC`,
    params
  );
  return rows.map(mapRow);
}

export async function upsertReviewTask(input: {
  userId: string;
  questionId: string;
  sourceType: ReviewTaskSourceType;
  subject?: string | null;
  knowledgePointId?: string | null;
  status: ReviewTaskStatus;
  intervalLevel?: number | null;
  nextReviewAt?: string | null;
  completedAt?: string | null;
  lastReviewResult?: ReviewTaskResult;
  lastReviewAt?: string | null;
  reviewCount?: number;
  originType?: ReviewTaskOriginType;
  originPaperId?: string | null;
  originSubmittedAt?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  if (!isUnifiedReviewTaskStoreEnabled()) return null;

  const now = new Date().toISOString();
  const dueAt = input.nextReviewAt ?? input.completedAt ?? input.lastReviewAt ?? now;
  const next: ReviewTask = {
    id: `review-task-${crypto.randomBytes(6).toString("hex")}`,
    userId: input.userId,
    questionId: input.questionId,
    sourceType: input.sourceType,
    subject: normalizeOptionalString(input.subject),
    knowledgePointId: normalizeOptionalString(input.knowledgePointId),
    status: input.status,
    intervalLevel: Math.max(0, Number(input.intervalLevel ?? 0) || 0),
    nextReviewAt: dueAt,
    completedAt: input.status === "completed" ? normalizeOptionalString(input.completedAt ?? input.lastReviewAt ?? dueAt) : null,
    lastReviewResult: normalizeResult(input.lastReviewResult),
    lastReviewAt: normalizeOptionalString(input.lastReviewAt),
    reviewCount: Math.max(0, Number(input.reviewCount ?? 0) || 0),
    originType: normalizeOriginType(input.originType),
    originPaperId: normalizeOptionalString(input.originPaperId),
    originSubmittedAt: normalizeOptionalString(input.originSubmittedAt),
    payload: normalizePayload(input.payload),
    createdAt: now,
    updatedAt: now
  };

  if (canUseApiTestReviewTaskFallback()) {
    const list = readJson<ReviewTask[]>(REVIEW_TASK_FILE, []).map(mapJsonItem);
    const identity = buildIdentity(input.userId, input.questionId, input.sourceType);
    const index = list.findIndex((item) => buildIdentity(item.userId, item.questionId, item.sourceType) === identity);
    const current = index >= 0 ? list[index] : null;
    const merged = {
      ...next,
      id: current?.id ?? next.id,
      createdAt: current?.createdAt ?? now
    } satisfies ReviewTask;
    if (index >= 0) {
      list[index] = merged;
    } else {
      list.push(merged);
    }
    writeJson(REVIEW_TASK_FILE, list);
    return merged;
  }
  requireReviewTasksDatabase();

  const existing = await queryOne<DbReviewTask>(
    "SELECT * FROM review_tasks WHERE user_id = $1 AND question_id = $2 AND source_type = $3 LIMIT 1",
    [input.userId, input.questionId, input.sourceType]
  );

  const row = await queryOne<DbReviewTask>(
    `INSERT INTO review_tasks (
       id, user_id, question_id, source_type, subject, knowledge_point_id, status, interval_level, due_at,
       completed_at, last_review_result, last_review_at, review_count, origin_type, origin_paper_id,
       origin_submitted_at, payload, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19)
     ON CONFLICT (user_id, question_id, source_type) DO UPDATE SET
       subject = EXCLUDED.subject,
       knowledge_point_id = EXCLUDED.knowledge_point_id,
       status = EXCLUDED.status,
       interval_level = EXCLUDED.interval_level,
       due_at = EXCLUDED.due_at,
       completed_at = EXCLUDED.completed_at,
       last_review_result = EXCLUDED.last_review_result,
       last_review_at = EXCLUDED.last_review_at,
       review_count = EXCLUDED.review_count,
       origin_type = EXCLUDED.origin_type,
       origin_paper_id = EXCLUDED.origin_paper_id,
       origin_submitted_at = EXCLUDED.origin_submitted_at,
       payload = EXCLUDED.payload,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      existing?.id ?? next.id,
      input.userId,
      input.questionId,
      input.sourceType,
      next.subject,
      next.knowledgePointId,
      next.status,
      next.intervalLevel,
      next.nextReviewAt,
      next.completedAt,
      next.lastReviewResult,
      next.lastReviewAt,
      next.reviewCount,
      next.originType,
      next.originPaperId,
      next.originSubmittedAt,
      next.payload ?? {},
      existing?.created_at ?? now,
      now
    ]
  );
  return row ? mapRow(row) : null;
}
