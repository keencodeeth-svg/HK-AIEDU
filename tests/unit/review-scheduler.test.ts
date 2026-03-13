import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { MemoryReview } from "../../lib/memory";
import type { ReviewTask } from "../../lib/review-tasks";
import type { Question } from "../../lib/types";
import type { WrongReviewItem } from "../../lib/wrong-review";

type ReviewSchedulerModule = typeof import("../../lib/review-scheduler");

type ModuleStubs = {
  content?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  wrongReview?: Record<string, unknown>;
  reviewTasks?: Record<string, unknown>;
};

const MODULE_TARGETS = [
  "../../lib/review-scheduler",
  "../../lib/content",
  "../../lib/memory",
  "../../lib/wrong-review",
  "../../lib/review-tasks"
] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadReviewScheduler(stubs: ModuleStubs = {}) {
  resetModules();

  const content = require("../../lib/content") as Record<string, unknown>;
  const memory = require("../../lib/memory") as Record<string, unknown>;
  const wrongReview = require("../../lib/wrong-review") as Record<string, unknown>;
  const reviewTasks = require("../../lib/review-tasks") as Record<string, unknown>;

  Object.assign(content, {
    getQuestions: async () => []
  });

  Object.assign(memory, {
    getMemoryReviewsByUser: async () => [],
    getMemoryStageLabel: (stage: number | null) => `memory-stage-${stage ?? 0}`,
    updateMemorySchedule: async () => ({ id: "memory-review-stub" })
  });

  Object.assign(wrongReview, {
    enqueueWrongReview: async (params: Record<string, unknown>) => ({
      id: "wrong-review-stub",
      ...params
    }),
    getIntervalLabel: (level: number | null) => `wrong-stage-${level ?? 0}`,
    getWrongReviewItemsByUser: async () => [],
    getWrongReviewOriginLabel: (originType: string) => `origin-${originType}`
  });

  Object.assign(reviewTasks, {
    getReviewTasksByUser: async () => [],
    isUnifiedReviewTaskStoreEnabled: () => true
  });

  Object.assign(content, stubs.content);
  Object.assign(memory, stubs.memory);
  Object.assign(wrongReview, stubs.wrongReview);
  Object.assign(reviewTasks, stubs.reviewTasks);

  return require("../../lib/review-scheduler") as ReviewSchedulerModule;
}

function createQuestion(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    subject: "math",
    grade: "4",
    knowledgePointId: `kp-${id}`,
    stem: `Stem ${id}`,
    options: ["A", "B", "C", "D"],
    answer: "A",
    explanation: `Explanation ${id}`,
    ...overrides
  };
}

function createReviewTask(
  questionId: string,
  sourceType: ReviewTask["sourceType"],
  nextReviewAt: string,
  overrides: Partial<ReviewTask> = {}
): ReviewTask {
  return {
    id: `task-${sourceType}-${questionId}`,
    userId: "user-1",
    questionId,
    sourceType,
    subject: "math",
    knowledgePointId: `kp-${questionId}`,
    status: "active",
    intervalLevel: sourceType === "memory" ? 1 : 2,
    nextReviewAt,
    completedAt: null,
    lastReviewResult: sourceType === "wrong" ? "wrong" : null,
    lastReviewAt: "2026-03-11T08:00:00.000Z",
    reviewCount: sourceType === "memory" ? 1 : 2,
    originType: sourceType === "wrong" ? "practice" : null,
    originPaperId: null,
    originSubmittedAt: null,
    payload: sourceType === "memory" ? { grade: "4" } : null,
    createdAt: "2026-03-10T08:00:00.000Z",
    updatedAt: "2026-03-11T08:00:00.000Z",
    ...overrides
  };
}

function createWrongReviewItem(
  questionId: string,
  nextReviewAt: string,
  overrides: Partial<WrongReviewItem> = {}
): WrongReviewItem {
  return {
    id: `wrong-${questionId}`,
    userId: "user-1",
    questionId,
    subject: "math",
    knowledgePointId: `kp-${questionId}`,
    intervalLevel: 1,
    nextReviewAt,
    lastReviewResult: "wrong",
    lastReviewAt: "2026-03-11T08:00:00.000Z",
    reviewCount: 1,
    status: "active",
    firstWrongAt: "2026-03-10T08:00:00.000Z",
    createdAt: "2026-03-10T08:00:00.000Z",
    updatedAt: "2026-03-11T08:00:00.000Z",
    sourceType: "practice",
    sourcePaperId: null,
    sourceSubmittedAt: null,
    ...overrides
  };
}

function createMemoryReview(
  questionId: string,
  nextReviewAt: string,
  overrides: Partial<MemoryReview> = {}
): MemoryReview {
  return {
    id: `memory-${questionId}`,
    userId: "user-1",
    questionId,
    stage: 1,
    nextReviewAt,
    lastReviewedAt: "2026-03-11T08:00:00.000Z",
    createdAt: "2026-03-10T08:00:00.000Z",
    updatedAt: "2026-03-11T08:00:00.000Z",
    ...overrides
  };
}

function buildTimeline() {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  return {
    overdue: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    dueToday: todayEnd.toISOString(),
    upcoming: new Date(todayEnd.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    upcomingLater: new Date(todayEnd.getTime() + 4 * 60 * 60 * 1000).toISOString()
  };
}

afterEach(() => {
  resetModules();
});

test("scheduleReviewTasksAfterAttempt only schedules memory on correct attempts", async () => {
  const memoryCalls: Array<Record<string, unknown>> = [];
  const wrongCalls: Array<Record<string, unknown>> = [];
  const scheduler = loadReviewScheduler({
    memory: {
      updateMemorySchedule: async (params: Record<string, unknown>) => {
        memoryCalls.push(params);
        return { id: "memory-q-1", ...params } as never;
      }
    },
    wrongReview: {
      enqueueWrongReview: async (params: Record<string, unknown>) => {
        wrongCalls.push(params);
        return { id: "wrong-q-1", ...params } as never;
      }
    },
    reviewTasks: {
      isUnifiedReviewTaskStoreEnabled: () => false
    }
  });

  const result = await scheduler.scheduleReviewTasksAfterAttempt({
    userId: "user-1",
    questionId: "q-1",
    subject: "math",
    knowledgePointId: "kp-1",
    correct: true
  });

  assert.equal(result.mode, "legacy");
  assert.deepEqual(memoryCalls, [
    {
      userId: "user-1",
      questionId: "q-1",
      correct: true
    }
  ]);
  assert.equal(wrongCalls.length, 0);
  assert.equal(result.wrongReview, null);
});

test("scheduleReviewTasksAfterAttempt enqueues wrong review with origin metadata on incorrect attempts", async () => {
  const wrongCalls: Array<Record<string, unknown>> = [];
  const scheduler = loadReviewScheduler({
    memory: {
      updateMemorySchedule: async (params: Record<string, unknown>) => ({ id: "memory-q-2", ...params }) as never
    },
    wrongReview: {
      enqueueWrongReview: async (params: Record<string, unknown>) => {
        wrongCalls.push(params);
        return { id: "wrong-q-2", questionId: params.questionId } as never;
      }
    },
    reviewTasks: {
      isUnifiedReviewTaskStoreEnabled: () => true
    }
  });

  const result = await scheduler.scheduleReviewTasksAfterAttempt({
    userId: "user-1",
    questionId: "q-2",
    subject: "math",
    knowledgePointId: "kp-2",
    correct: false,
    reviewOrigin: {
      sourceType: "exam",
      sourcePaperId: "paper-1",
      sourceSubmittedAt: "2026-03-11T10:00:00.000Z"
    }
  });

  assert.equal(result.mode, "unified");
  assert.deepEqual(wrongCalls, [
    {
      userId: "user-1",
      questionId: "q-2",
      subject: "math",
      knowledgePointId: "kp-2",
      sourceType: "exam",
      sourcePaperId: "paper-1",
      sourceSubmittedAt: "2026-03-11T10:00:00.000Z"
    }
  ]);
  assert.deepEqual(result.wrongReview, {
    id: "wrong-q-2",
    questionId: "q-2"
  });
});

test("getUnifiedReviewQueue dedupes cross-source tasks and prefers persisted same-source tasks", async () => {
  const timeline = buildTimeline();
  const scheduler = loadReviewScheduler({
    content: {
      getQuestions: async () => [
        createQuestion("q1"),
        createQuestion("q2"),
        createQuestion("q3"),
        createQuestion("q4")
      ]
    },
    memory: {
      getMemoryReviewsByUser: async () => [
        createMemoryReview("q1", timeline.dueToday, { stage: 2 }),
        createMemoryReview("q3", timeline.dueToday, { stage: 1 })
      ],
      getMemoryStageLabel: (stage: number | null) => `memory-stage-${stage ?? 0}`
    },
    wrongReview: {
      getWrongReviewItemsByUser: async () => [
        createWrongReviewItem("q1", timeline.overdue, { intervalLevel: 1 }),
        createWrongReviewItem("q2", timeline.overdue, { intervalLevel: 3 }),
        createWrongReviewItem("q3", timeline.upcomingLater, {
          intervalLevel: 2,
          sourceType: "exam",
          sourcePaperId: "paper-3",
          sourceSubmittedAt: "2026-03-11T09:30:00.000Z"
        })
      ],
      getIntervalLabel: (level: number | null) => `wrong-stage-${level ?? 0}`,
      getWrongReviewOriginLabel: (originType: string) => `origin-${originType}`
    },
    reviewTasks: {
      isUnifiedReviewTaskStoreEnabled: () => true,
      getReviewTasksByUser: async () => [
        createReviewTask("q2", "wrong", timeline.dueToday, {
          intervalLevel: 2,
          lastReviewResult: "wrong",
          reviewCount: 2,
          payload: null
        }),
        createReviewTask("q4", "memory", timeline.upcoming, {
          subject: null,
          knowledgePointId: null,
          intervalLevel: 1,
          payload: { grade: "4" }
        }),
        createReviewTask("missing-question", "wrong", timeline.dueToday, {
          subject: null,
          knowledgePointId: null,
          payload: null
        })
      ]
    }
  });

  const queue = await scheduler.getUnifiedReviewQueue({
    userId: "user-1",
    subject: "math",
    grade: "4"
  });

  assert.deepEqual(queue.summary, {
    totalActive: 4,
    dueToday: 3,
    overdue: 1,
    upcoming: 1
  });
  assert.deepEqual(
    queue.dueToday.map((item) => `${item.sourceType}:${item.questionId}:${item.dueStatus}`),
    ["wrong:q1:overdue", "wrong:q2:due_today", "memory:q3:due_today"]
  );
  assert.deepEqual(queue.upcoming.map((item) => `${item.sourceType}:${item.questionId}`), ["memory:q4"]);
  assert.equal(queue.dueToday[0]?.originLabel, "origin-practice");
  assert.equal(queue.dueToday[1]?.grade, "4");
  assert.equal(queue.upcoming[0]?.subject, "math");
  assert.equal(queue.upcoming[0]?.knowledgePointId, "kp-q4");
  assert.equal(queue.upcoming[0]?.intervalLabel, "memory-stage-1");
  assert.equal(queue.questions.get("q3")?.id, "q3");
});

test("getUnifiedReviewQuestionCandidates prefers due-today tasks and filters missing questions", async () => {
  const timeline = buildTimeline();
  const scheduler = loadReviewScheduler({
    content: {
      getQuestions: async () => [createQuestion("q1"), createQuestion("q2")]
    },
    memory: {
      getMemoryReviewsByUser: async () => [createMemoryReview("q2", timeline.upcoming)],
      getMemoryStageLabel: (stage: number | null) => `memory-stage-${stage ?? 0}`
    },
    wrongReview: {
      getWrongReviewItemsByUser: async () => [
        createWrongReviewItem("q1", timeline.dueToday),
        createWrongReviewItem("z-missing", timeline.dueToday)
      ],
      getIntervalLabel: (level: number | null) => `wrong-stage-${level ?? 0}`,
      getWrongReviewOriginLabel: (originType: string) => `origin-${originType}`
    }
  });

  const candidates = await scheduler.getUnifiedReviewQuestionCandidates({
    userId: "user-1",
    subject: "math",
    grade: "4",
    limit: 2
  });

  assert.deepEqual(candidates.map((item) => item.question.id), ["q1"]);
  assert.deepEqual(candidates.map((item) => item.task.questionId), ["q1"]);
  assert.equal(candidates[0]?.task.dueStatus, "due_today");
});
