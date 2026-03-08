import { getQuestions } from "./content";
import { getMemoryReviewsByUser, getMemoryStageLabel, updateMemorySchedule } from "./memory";
import {
  enqueueWrongReview,
  getIntervalLabel,
  getWrongReviewItemsByUser,
  getWrongReviewOriginLabel,
  type ReviewResult,
  type WrongReviewOriginMeta,
  type WrongReviewOriginType
} from "./wrong-review";
import {
  getReviewTasksByUser,
  isUnifiedReviewTaskStoreEnabled,
  type ReviewTask,
  type ReviewTaskSourceType
} from "./review-tasks";
import type { Question } from "./types";

export type UnifiedReviewSource = "wrong" | "memory";
export type UnifiedReviewDueStatus = "overdue" | "due_today" | "upcoming";

export type UnifiedReviewTask = {
  id: string;
  sourceType: UnifiedReviewSource;
  questionId: string;
  subject: string;
  grade: string;
  knowledgePointId: string;
  nextReviewAt: string | null;
  dueStatus: UnifiedReviewDueStatus;
  intervalLevel: number | null;
  intervalLabel: string;
  lastReviewResult: ReviewResult;
  lastReviewAt: string | null;
  reviewCount: number;
  status: "active" | "completed";
  originType: WrongReviewOriginType | null;
  originLabel: string | null;
  originPaperId: string | null;
  originSubmittedAt: string | null;
};

const SOURCE_PRIORITY: Record<UnifiedReviewSource, number> = {
  wrong: 0,
  memory: 1
};

function toTimestamp(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

function getTodayEndTimestamp() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.getTime();
}

function toDueStatus(nextReviewAt: string | null, nowTs: number, todayEndTs: number): UnifiedReviewDueStatus {
  const ts = toTimestamp(nextReviewAt);
  if (ts < nowTs) return "overdue";
  if (ts <= todayEndTs) return "due_today";
  return "upcoming";
}

function getDueStatusRank(value: UnifiedReviewDueStatus) {
  return value === "overdue" ? 0 : value === "due_today" ? 1 : 2;
}

function compareReviewTasks(a: UnifiedReviewTask, b: UnifiedReviewTask) {
  const dueDiff = getDueStatusRank(a.dueStatus) - getDueStatusRank(b.dueStatus);
  if (dueDiff !== 0) return dueDiff;
  const timeDiff = toTimestamp(a.nextReviewAt) - toTimestamp(b.nextReviewAt);
  if (timeDiff !== 0) return timeDiff;
  const sourceDiff = SOURCE_PRIORITY[a.sourceType] - SOURCE_PRIORITY[b.sourceType];
  if (sourceDiff !== 0) return sourceDiff;
  return a.questionId.localeCompare(b.questionId);
}

function compareSameQuestionReviewTasks(a: UnifiedReviewTask, b: UnifiedReviewTask) {
  const dueDiff = getDueStatusRank(a.dueStatus) - getDueStatusRank(b.dueStatus);
  if (dueDiff !== 0) return dueDiff;
  const sourceDiff = SOURCE_PRIORITY[a.sourceType] - SOURCE_PRIORITY[b.sourceType];
  if (sourceDiff !== 0) return sourceDiff;
  const timeDiff = toTimestamp(a.nextReviewAt) - toTimestamp(b.nextReviewAt);
  if (timeDiff !== 0) return timeDiff;
  return a.questionId.localeCompare(b.questionId);
}

function dedupeReviewTasks(tasks: UnifiedReviewTask[]) {
  const taskByQuestionId = new Map<string, UnifiedReviewTask>();
  tasks.forEach((task) => {
    const existing = taskByQuestionId.get(task.questionId);
    if (!existing || compareSameQuestionReviewTasks(task, existing) < 0) {
      taskByQuestionId.set(task.questionId, task);
    }
  });
  return Array.from(taskByQuestionId.values()).sort(compareReviewTasks);
}

function buildSourceQuestionKey(sourceType: ReviewTaskSourceType | UnifiedReviewSource, questionId: string) {
  return `${sourceType}:${questionId}`;
}

function mapPersistedTask(task: ReviewTask, questionMap: Map<string, Question>, nowTs: number, todayEndTs: number) {
  const question = questionMap.get(task.questionId);
  const subject = task.subject ?? question?.subject ?? "";
  const payloadGrade = task.payload && typeof task.payload.grade === "string" ? task.payload.grade : null;
  const grade = payloadGrade ?? question?.grade ?? "";
  const knowledgePointId = task.knowledgePointId ?? question?.knowledgePointId ?? "";
  const nextReviewAt = task.nextReviewAt ?? null;

  return {
    id: task.id,
    sourceType: task.sourceType,
    questionId: task.questionId,
    subject,
    grade,
    knowledgePointId,
    nextReviewAt,
    dueStatus: toDueStatus(nextReviewAt, nowTs, todayEndTs),
    intervalLevel: task.intervalLevel,
    intervalLabel: task.sourceType === "memory" ? getMemoryStageLabel(task.intervalLevel) : getIntervalLabel(task.intervalLevel as 1 | 2 | 3),
    lastReviewResult: task.lastReviewResult,
    lastReviewAt: task.lastReviewAt,
    reviewCount: task.reviewCount,
    status: task.status,
    originType: task.originType,
    originLabel: task.originType ? getWrongReviewOriginLabel(task.originType) : null,
    originPaperId: task.originPaperId,
    originSubmittedAt: task.originSubmittedAt
  } satisfies UnifiedReviewTask;
}

export function isUnifiedReviewEngineEnabled() {
  return isUnifiedReviewTaskStoreEnabled();
}

export async function scheduleReviewTasksAfterAttempt(
  params: {
    userId: string;
    questionId: string;
    subject: string;
    knowledgePointId: string;
    correct: boolean;
  } & { reviewOrigin?: WrongReviewOriginMeta }
) {
  const memoryReview = await updateMemorySchedule({
    userId: params.userId,
    questionId: params.questionId,
    correct: params.correct
  });

  const wrongReview = params.correct
    ? null
    : await enqueueUnifiedWrongReview({
        userId: params.userId,
        questionId: params.questionId,
        subject: params.subject,
        knowledgePointId: params.knowledgePointId,
        ...(params.reviewOrigin ?? {})
      });

  return {
    mode: isUnifiedReviewEngineEnabled() ? "unified" : "legacy",
    memoryReview,
    wrongReview
  };
}

export async function enqueueUnifiedWrongReview(
  params: {
    userId: string;
    questionId: string;
    subject: string;
    knowledgePointId: string;
  } & WrongReviewOriginMeta
) {
  return enqueueWrongReview(params);
}

export async function getUnifiedReviewQueue(input: {
  userId: string;
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  sources?: UnifiedReviewSource[];
}) {
  const sources = input.sources?.length ? Array.from(new Set(input.sources)) : (["wrong", "memory"] as UnifiedReviewSource[]);
  const [questions, persistedTasks, wrongItems, memoryReviews] = await Promise.all([
    getQuestions(),
    isUnifiedReviewEngineEnabled()
      ? getReviewTasksByUser(input.userId, { includeCompleted: false, sourceTypes: sources })
      : Promise.resolve([]),
    sources.includes("wrong") ? getWrongReviewItemsByUser(input.userId, false, { preferUnifiedStore: false }) : Promise.resolve([]),
    sources.includes("memory") ? getMemoryReviewsByUser(input.userId, { preferUnifiedStore: false }) : Promise.resolve([])
  ]);

  const questionMap = new Map(questions.map((item) => [item.id, item]));
  const nowTs = Date.now();
  const todayEndTs = getTodayEndTimestamp();
  const tasks: UnifiedReviewTask[] = [];
  const persistedKeySet = new Set<string>();

  persistedTasks.forEach((task) => {
    const mapped = mapPersistedTask(task, questionMap, nowTs, todayEndTs);
    if (!mapped.subject || !mapped.grade || !mapped.knowledgePointId) return;
    tasks.push(mapped);
    persistedKeySet.add(buildSourceQuestionKey(task.sourceType, task.questionId));
  });

  wrongItems.forEach((item) => {
    const key = buildSourceQuestionKey("wrong", item.questionId);
    if (persistedKeySet.has(key)) return;
    const question = questionMap.get(item.questionId);
    if (!question) return;
    tasks.push({
      id: item.id,
      sourceType: "wrong",
      questionId: item.questionId,
      subject: item.subject,
      grade: question.grade,
      knowledgePointId: item.knowledgePointId,
      nextReviewAt: item.nextReviewAt,
      dueStatus: toDueStatus(item.nextReviewAt, nowTs, todayEndTs),
      intervalLevel: item.intervalLevel,
      intervalLabel: getIntervalLabel(item.intervalLevel),
      lastReviewResult: item.lastReviewResult,
      lastReviewAt: item.lastReviewAt,
      reviewCount: item.reviewCount,
      status: item.status,
      originType: item.sourceType,
      originLabel: getWrongReviewOriginLabel(item.sourceType),
      originPaperId: item.sourcePaperId,
      originSubmittedAt: item.sourceSubmittedAt
    });
  });

  memoryReviews.forEach((item) => {
    const key = buildSourceQuestionKey("memory", item.questionId);
    if (persistedKeySet.has(key)) return;
    const question = questionMap.get(item.questionId);
    if (!question) return;
    tasks.push({
      id: item.id,
      sourceType: "memory",
      questionId: item.questionId,
      subject: question.subject,
      grade: question.grade,
      knowledgePointId: question.knowledgePointId,
      nextReviewAt: item.nextReviewAt,
      dueStatus: toDueStatus(item.nextReviewAt, nowTs, todayEndTs),
      intervalLevel: item.stage,
      intervalLabel: getMemoryStageLabel(item.stage),
      lastReviewResult: null,
      lastReviewAt: item.lastReviewedAt ?? null,
      reviewCount: item.stage,
      status: "active",
      originType: null,
      originLabel: null,
      originPaperId: null,
      originSubmittedAt: null
    });
  });

  const filtered = dedupeReviewTasks(
    tasks
      .filter((item) => (input.subject ? item.subject === input.subject : true))
      .filter((item) => (input.grade ? item.grade === input.grade : true))
      .filter((item) => (input.knowledgePointId ? item.knowledgePointId === input.knowledgePointId : true))
  );

  const dueToday = filtered.filter((item) => item.dueStatus === "overdue" || item.dueStatus === "due_today");
  const upcoming = filtered.filter((item) => item.dueStatus === "upcoming");

  return {
    summary: {
      totalActive: filtered.length,
      dueToday: dueToday.length,
      overdue: dueToday.filter((item) => item.dueStatus === "overdue").length,
      upcoming: upcoming.length
    },
    dueToday,
    upcoming,
    questions: questionMap
  };
}

export async function getUnifiedReviewQuestionCandidates(input: {
  userId: string;
  subject: string;
  grade: string;
  knowledgePointId?: string;
  limit?: number;
}) {
  const queue = await getUnifiedReviewQueue({
    userId: input.userId,
    subject: input.subject,
    grade: input.grade,
    knowledgePointId: input.knowledgePointId,
    sources: ["wrong", "memory"]
  });

  const selectedTasks = (queue.dueToday.length ? queue.dueToday : queue.upcoming).slice(0, input.limit ?? 10);

  return selectedTasks
    .map((task) => ({
      task,
      question: queue.questions.get(task.questionId) as Question | undefined
    }))
    .filter((item): item is { task: UnifiedReviewTask; question: Question } => Boolean(item.question));
}
