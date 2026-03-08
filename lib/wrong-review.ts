import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";
import {
  getReviewTasksByUser,
  isUnifiedReviewTaskStoreEnabled,
  type ReviewTask,
  upsertReviewTask
} from "./review-tasks";

export type ReviewIntervalLevel = 1 | 2 | 3;
export type ReviewResult = "correct" | "wrong" | null;
export type WrongReviewStatus = "active" | "completed";
export type WrongReviewOriginType = "practice" | "diagnostic" | "assignment" | "exam" | "wrong_book_review";

type WrongReviewReadOptions = {
  preferUnifiedStore?: boolean;
};

export type WrongReviewOriginMeta = {
  sourceType?: WrongReviewOriginType;
  sourcePaperId?: string | null;
  sourceSubmittedAt?: string | null;
};

export type WrongReviewItem = {
  id: string;
  userId: string;
  questionId: string;
  subject: string;
  knowledgePointId: string;
  intervalLevel: ReviewIntervalLevel;
  nextReviewAt: string | null;
  lastReviewResult: ReviewResult;
  lastReviewAt: string | null;
  reviewCount: number;
  status: WrongReviewStatus;
  firstWrongAt: string;
  createdAt: string;
  updatedAt: string;
  sourceType: WrongReviewOriginType;
  sourcePaperId: string | null;
  sourceSubmittedAt: string | null;
};

const WRONG_REVIEW_FILE = "wrong-review-items.json";
const INTERVAL_HOURS: Record<ReviewIntervalLevel, number> = {
  1: 24,
  2: 72,
  3: 7 * 24
};

type DbWrongReviewItem = {
  id: string;
  user_id: string;
  question_id: string;
  subject: string;
  knowledge_point_id: string;
  interval_level: number;
  next_review_at: string | null;
  last_review_result: string | null;
  last_review_at: string | null;
  review_count: number;
  status: string;
  first_wrong_at: string;
  created_at: string;
  updated_at: string;
  source_type: string | null;
  source_paper_id: string | null;
  source_submitted_at: string | null;
};

function toIntervalLevel(input: number): ReviewIntervalLevel {
  if (input <= 1) return 1;
  if (input >= 3) return 3;
  return 2;
}

function toSourceType(input?: string | null): WrongReviewOriginType {
  if (input === "diagnostic") return "diagnostic";
  if (input === "assignment") return "assignment";
  if (input === "exam") return "exam";
  if (input === "wrong_book_review") return "wrong_book_review";
  return "practice";
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeWrongReviewItem(item: WrongReviewItem) {
  const raw = item as WrongReviewItem & {
    sourceType?: string | null;
    sourcePaperId?: string | null;
    sourceSubmittedAt?: string | null;
  };

  return {
    ...item,
    sourceType: toSourceType(raw.sourceType),
    sourcePaperId: normalizeOptionalString(raw.sourcePaperId),
    sourceSubmittedAt: normalizeOptionalString(raw.sourceSubmittedAt)
  } satisfies WrongReviewItem;
}

function resolveOriginMeta(input?: WrongReviewOriginMeta) {
  const sourceType = input?.sourceType ?? "practice";
  return {
    sourceType,
    sourcePaperId: sourceType === "exam" ? normalizeOptionalString(input?.sourcePaperId) : null,
    sourceSubmittedAt: sourceType === "exam" ? normalizeOptionalString(input?.sourceSubmittedAt) : null
  } as const;
}

function mapDbItem(row: DbWrongReviewItem): WrongReviewItem {
  const lastResult = row.last_review_result === "correct" || row.last_review_result === "wrong"
    ? row.last_review_result
    : null;
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    subject: row.subject,
    knowledgePointId: row.knowledge_point_id,
    intervalLevel: toIntervalLevel(row.interval_level),
    nextReviewAt: row.next_review_at,
    lastReviewResult: lastResult,
    lastReviewAt: row.last_review_at,
    reviewCount: row.review_count,
    status: row.status === "completed" ? "completed" : "active",
    firstWrongAt: row.first_wrong_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceType: toSourceType(row.source_type),
    sourcePaperId: normalizeOptionalString(row.source_paper_id),
    sourceSubmittedAt: normalizeOptionalString(row.source_submitted_at)
  };
}

function mapPersistedReviewTask(task: ReviewTask): WrongReviewItem {
  return normalizeWrongReviewItem({
    id: task.id,
    userId: task.userId,
    questionId: task.questionId,
    subject: task.subject ?? "",
    knowledgePointId: task.knowledgePointId ?? "",
    intervalLevel: toIntervalLevel(task.intervalLevel),
    nextReviewAt: task.nextReviewAt ?? task.completedAt ?? task.lastReviewAt,
    lastReviewResult: task.lastReviewResult,
    lastReviewAt: task.lastReviewAt,
    reviewCount: task.reviewCount,
    status: task.status,
    firstWrongAt: task.createdAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    sourceType: toSourceType(task.originType),
    sourcePaperId: normalizeOptionalString(task.originPaperId),
    sourceSubmittedAt: normalizeOptionalString(task.originSubmittedAt)
  });
}

function compareWrongReviewItems(a: WrongReviewItem, b: WrongReviewItem) {
  const aTs = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTs = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTs !== bTs) return aTs - bTs;
  return b.updatedAt.localeCompare(a.updatedAt);
}

function calcNextReviewAt(level: ReviewIntervalLevel, baseTime = Date.now()) {
  return new Date(baseTime + INTERVAL_HOURS[level] * 60 * 60 * 1000).toISOString();
}

function isSameItem(item: WrongReviewItem, userId: string, questionId: string) {
  return item.userId === userId && item.questionId === questionId;
}

function endOfToday() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

function isPersistedTaskOutdated(task: WrongReviewItem | null | undefined, legacy: WrongReviewItem) {
  if (!task) return true;
  return (
    task.subject !== legacy.subject ||
    task.knowledgePointId !== legacy.knowledgePointId ||
    task.intervalLevel !== legacy.intervalLevel ||
    (task.nextReviewAt ?? null) !== (legacy.nextReviewAt ?? null) ||
    task.lastReviewResult !== legacy.lastReviewResult ||
    (task.lastReviewAt ?? null) !== (legacy.lastReviewAt ?? null) ||
    task.reviewCount !== legacy.reviewCount ||
    task.status !== legacy.status ||
    task.sourceType !== legacy.sourceType ||
    (task.sourcePaperId ?? null) !== (legacy.sourcePaperId ?? null) ||
    (task.sourceSubmittedAt ?? null) !== (legacy.sourceSubmittedAt ?? null) ||
    task.updatedAt < legacy.updatedAt
  );
}

async function syncWrongReviewTask(item: WrongReviewItem | null) {
  if (!item) return null;
  return upsertReviewTask({
    userId: item.userId,
    questionId: item.questionId,
    sourceType: "wrong",
    subject: item.subject,
    knowledgePointId: item.knowledgePointId,
    status: item.status,
    intervalLevel: item.intervalLevel,
    nextReviewAt: item.nextReviewAt ?? item.lastReviewAt ?? new Date().toISOString(),
    completedAt: item.status === "completed" ? item.lastReviewAt : null,
    lastReviewResult: item.lastReviewResult,
    lastReviewAt: item.lastReviewAt,
    reviewCount: item.reviewCount,
    originType: item.sourceType,
    originPaperId: item.sourcePaperId,
    originSubmittedAt: item.sourceSubmittedAt,
    payload: null
  });
}

async function getPersistedWrongReviewItemsByUser(userId: string, includeCompleted = false) {
  const tasks = await getReviewTasksByUser(userId, {
    includeCompleted,
    sourceTypes: ["wrong"]
  });
  return tasks.map(mapPersistedReviewTask).sort(compareWrongReviewItems);
}

async function getLegacyWrongReviewItemsByUser(userId: string, includeCompleted = false) {
  if (!isDbEnabled()) {
    const list = readJson<WrongReviewItem[]>(WRONG_REVIEW_FILE, []).map(normalizeWrongReviewItem);
    return list
      .filter((item) => item.userId === userId && (includeCompleted || item.status === "active"))
      .sort(compareWrongReviewItems);
  }

  const rows = includeCompleted
    ? await query<DbWrongReviewItem>(
        "SELECT * FROM wrong_review_items WHERE user_id = $1 ORDER BY next_review_at ASC NULLS LAST, updated_at DESC",
        [userId]
      )
    : await query<DbWrongReviewItem>(
        "SELECT * FROM wrong_review_items WHERE user_id = $1 AND status = 'active' ORDER BY next_review_at ASC NULLS LAST, updated_at DESC",
        [userId]
      );
  return rows.map(mapDbItem);
}

export async function ensureWrongReviewTasksBackfilled(userId: string) {
  if (!isUnifiedReviewTaskStoreEnabled()) return;
  const [legacyItems, persistedItems] = await Promise.all([
    getLegacyWrongReviewItemsByUser(userId, true),
    getPersistedWrongReviewItemsByUser(userId, true)
  ]);
  if (!legacyItems.length) return;

  const persistedByQuestionId = new Map(persistedItems.map((item) => [item.questionId, item]));
  const itemsToSync = legacyItems.filter((item) =>
    isPersistedTaskOutdated(persistedByQuestionId.get(item.questionId), item)
  );
  if (!itemsToSync.length) return;

  await Promise.all(itemsToSync.map((item) => syncWrongReviewTask(item)));
}

export function getWrongReviewOriginLabel(type: WrongReviewOriginType) {
  if (type === "exam") return "考试错题";
  if (type === "assignment") return "作业错题";
  if (type === "diagnostic") return "诊断错题";
  if (type === "wrong_book_review") return "复练回流";
  return "课堂练习";
}

export async function getWrongReviewItemsByUser(
  userId: string,
  includeCompleted = false,
  options?: WrongReviewReadOptions
) {
  const preferUnifiedStore = options?.preferUnifiedStore ?? true;
  if (preferUnifiedStore && isUnifiedReviewTaskStoreEnabled()) {
    await ensureWrongReviewTasksBackfilled(userId);
    const persistedItems = await getPersistedWrongReviewItemsByUser(userId, includeCompleted);
    if (persistedItems.length) {
      return persistedItems;
    }
  }

  return getLegacyWrongReviewItemsByUser(userId, includeCompleted);
}

export async function getWrongReviewItem(
  userId: string,
  questionId: string,
  options?: WrongReviewReadOptions
) {
  const items = await getWrongReviewItemsByUser(userId, true, options);
  return items.find((item) => isSameItem(item, userId, questionId)) ?? null;
}

export async function enqueueWrongReview(
  params: {
    userId: string;
    questionId: string;
    subject: string;
    knowledgePointId: string;
  } & WrongReviewOriginMeta
) {
  const now = new Date().toISOString();
  const nextReviewAt = calcNextReviewAt(1);
  const originMeta = resolveOriginMeta(params);

  if (!isDbEnabled()) {
    const list = readJson<WrongReviewItem[]>(WRONG_REVIEW_FILE, []).map(normalizeWrongReviewItem);
    const index = list.findIndex((item) => isSameItem(item, params.userId, params.questionId));
    const current = index >= 0 ? list[index] : null;

    const next: WrongReviewItem = {
      id: current?.id ?? `wr-${crypto.randomBytes(6).toString("hex")}`,
      userId: params.userId,
      questionId: params.questionId,
      subject: params.subject,
      knowledgePointId: params.knowledgePointId,
      intervalLevel: 1,
      nextReviewAt,
      lastReviewResult: "wrong",
      lastReviewAt: now,
      reviewCount: current?.reviewCount ?? 0,
      status: "active",
      firstWrongAt: current?.firstWrongAt ?? now,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      sourceType: originMeta.sourceType,
      sourcePaperId: originMeta.sourcePaperId,
      sourceSubmittedAt: originMeta.sourceSubmittedAt
    };

    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(WRONG_REVIEW_FILE, list);
    await syncWrongReviewTask(next);
    return next;
  }

  const existing = await queryOne<DbWrongReviewItem>(
    "SELECT * FROM wrong_review_items WHERE user_id = $1 AND question_id = $2",
    [params.userId, params.questionId]
  );
  const row = await queryOne<DbWrongReviewItem>(
    `INSERT INTO wrong_review_items
     (id, user_id, question_id, subject, knowledge_point_id, interval_level, next_review_at, last_review_result, last_review_at, review_count, status, first_wrong_at, created_at, updated_at, source_type, source_paper_id, source_submitted_at)
     VALUES ($1, $2, $3, $4, $5, 1, $6, 'wrong', $7, $8, 'active', $9, $10, $11, $12, $13, $14)
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       subject = EXCLUDED.subject,
       knowledge_point_id = EXCLUDED.knowledge_point_id,
       interval_level = 1,
       next_review_at = EXCLUDED.next_review_at,
       last_review_result = 'wrong',
       last_review_at = EXCLUDED.last_review_at,
       status = 'active',
       updated_at = EXCLUDED.updated_at,
       source_type = EXCLUDED.source_type,
       source_paper_id = EXCLUDED.source_paper_id,
       source_submitted_at = EXCLUDED.source_submitted_at
     RETURNING *`,
    [
      existing?.id ?? `wr-${crypto.randomBytes(6).toString("hex")}`,
      params.userId,
      params.questionId,
      params.subject,
      params.knowledgePointId,
      nextReviewAt,
      now,
      existing?.review_count ?? 0,
      existing?.first_wrong_at ?? now,
      existing?.created_at ?? now,
      now,
      originMeta.sourceType,
      originMeta.sourcePaperId,
      originMeta.sourceSubmittedAt
    ]
  );
  const mapped = row ? mapDbItem(row) : null;
  await syncWrongReviewTask(mapped);
  return mapped;
}

export async function submitWrongReviewResult(params: {
  userId: string;
  questionId: string;
  correct: boolean;
}) {
  const now = new Date().toISOString();

  if (!isDbEnabled()) {
    const list = readJson<WrongReviewItem[]>(WRONG_REVIEW_FILE, []).map(normalizeWrongReviewItem);
    const index = list.findIndex((item) => isSameItem(item, params.userId, params.questionId));
    if (index === -1) return null;
    const current = list[index];

    let nextLevel: ReviewIntervalLevel = current.intervalLevel;
    let status: WrongReviewStatus = "active";
    let nextReviewAt: string | null = current.nextReviewAt;

    if (params.correct) {
      if (current.intervalLevel === 3) {
        nextLevel = 3;
        status = "completed";
        nextReviewAt = null;
      } else {
        nextLevel = toIntervalLevel(current.intervalLevel + 1);
        nextReviewAt = calcNextReviewAt(nextLevel);
      }
    } else {
      nextLevel = 1;
      status = "active";
      nextReviewAt = calcNextReviewAt(1);
    }

    const next: WrongReviewItem = {
      ...current,
      intervalLevel: nextLevel,
      nextReviewAt,
      lastReviewResult: params.correct ? "correct" : "wrong",
      lastReviewAt: now,
      reviewCount: current.reviewCount + 1,
      status,
      updatedAt: now
    };
    list[index] = next;
    writeJson(WRONG_REVIEW_FILE, list);
    await syncWrongReviewTask(next);
    return next;
  }

  const existing = await queryOne<DbWrongReviewItem>(
    "SELECT * FROM wrong_review_items WHERE user_id = $1 AND question_id = $2",
    [params.userId, params.questionId]
  );
  if (!existing) return null;

  const current = mapDbItem(existing);
  let nextLevel: ReviewIntervalLevel = current.intervalLevel;
  let status: WrongReviewStatus = "active";
  let nextReviewAt: string | null = current.nextReviewAt;

  if (params.correct) {
    if (current.intervalLevel === 3) {
      nextLevel = 3;
      status = "completed";
      nextReviewAt = null;
    } else {
      nextLevel = toIntervalLevel(current.intervalLevel + 1);
      nextReviewAt = calcNextReviewAt(nextLevel);
    }
  } else {
    nextLevel = 1;
    status = "active";
    nextReviewAt = calcNextReviewAt(1);
  }

  const row = await queryOne<DbWrongReviewItem>(
    `UPDATE wrong_review_items
     SET interval_level = $3,
         next_review_at = $4,
         last_review_result = $5,
         last_review_at = $6,
         review_count = review_count + 1,
         status = $7,
         updated_at = $8
     WHERE user_id = $1 AND question_id = $2
     RETURNING *`,
    [
      params.userId,
      params.questionId,
      nextLevel,
      nextReviewAt,
      params.correct ? "correct" : "wrong",
      now,
      status,
      now
    ]
  );
  const mapped = row ? mapDbItem(row) : null;
  await syncWrongReviewTask(mapped);
  return mapped;
}

export async function getWrongReviewQueue(userId: string) {
  const activeItems = await getWrongReviewItemsByUser(userId, false);
  const now = Date.now();
  const todayEndTs = endOfToday();

  const dueToday = activeItems.filter((item) => {
    if (!item.nextReviewAt) return false;
    return new Date(item.nextReviewAt).getTime() <= todayEndTs;
  });
  const overdue = dueToday.filter((item) => {
    if (!item.nextReviewAt) return false;
    return new Date(item.nextReviewAt).getTime() < now;
  });
  const upcoming = activeItems.filter((item) => {
    if (!item.nextReviewAt) return false;
    return new Date(item.nextReviewAt).getTime() > todayEndTs;
  });

  return {
    summary: {
      totalActive: activeItems.length,
      dueToday: dueToday.length,
      overdue: overdue.length,
      upcoming: upcoming.length
    },
    dueToday,
    upcoming
  };
}

export function getIntervalLabel(level: ReviewIntervalLevel) {
  if (level === 1) return "24h";
  if (level === 2) return "72h";
  return "7d";
}
