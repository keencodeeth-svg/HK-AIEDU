import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  buildWrongBookReviewFeedbackMessage,
  formatDateTime,
  getSelectedWrongBookQuestionIds,
  getWrongBookCompleteTaskRequestMessage,
  getWrongBookCreateTasksRequestMessage,
  getWrongBookDefaultDueDate,
  getWrongBookHistoryRequestMessage,
  getWrongBookReviewSubmitRequestMessage,
  getWrongBookTaskCompletionFeedback,
  getWrongBookTaskGenerationFeedback,
  hasWrongBookContent,
  isMissingWrongBookReviewQuestionError,
  isMissingWrongBookTaskError,
  isWrongBookActionBusy,
  normalizeWrongBookSkippedReason,
  pruneWrongBookReviewState,
  pruneWrongBookSelection
} = require("../../app/wrong-book/utils") as typeof import("../../app/wrong-book/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("wrong-book helpers map auth expiry and action validation errors", () => {
  assert.equal(
    getWrongBookHistoryRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看错题闭环。"
  );
  assert.equal(
    getWrongBookCreateTasksRequestMessage(createRequestError(400, "questionIds required"), "fallback"),
    "请先选择要订正的错题。"
  );
  assert.equal(
    getWrongBookCompleteTaskRequestMessage(createRequestError(404, "not found"), "fallback"),
    "这条订正任务已不存在，列表会在刷新后自动同步。"
  );
  assert.equal(
    getWrongBookReviewSubmitRequestMessage(createRequestError(404, "not found"), "fallback"),
    "这道复练题已不可用，复练队列会在刷新后自动同步。"
  );
  assert.equal(isMissingWrongBookTaskError(createRequestError(404, "not found")), true);
  assert.equal(isMissingWrongBookReviewQuestionError(createRequestError(404, "not found")), true);
});

test("wrong-book helpers normalize skipped reasons and prune stale local state", () => {
  const list = [
    { id: "question-1" },
    { id: "question-3" }
  ];
  const reviewQueue = {
    summary: {
      totalActive: 2,
      dueToday: 1,
      overdue: 0,
      upcoming: 1
    },
    today: [
      {
        id: "review-1",
        questionId: "question-1",
        intervalLevel: 1,
        intervalLabel: "明天",
        nextReviewAt: "2026-03-18T08:00:00.000Z",
        lastReviewResult: null,
        lastReviewAt: null,
        reviewCount: 0,
        status: "active" as const,
        originType: "wrong_book_review" as const,
        originLabel: "错题复练",
        originPaperId: null,
        originSubmittedAt: null,
        question: null
      }
    ],
    upcoming: []
  };

  assert.deepEqual(pruneWrongBookSelection(list, { "question-1": true, "question-2": true }), {
    "question-1": true
  });
  assert.deepEqual(getSelectedWrongBookQuestionIds(list, { "question-1": true, "question-2": true }), [
    "question-1"
  ]);
  assert.deepEqual(
    pruneWrongBookReviewState(reviewQueue, {
      "question-1": "A",
      "question-2": "B"
    }),
    { "question-1": "A" }
  );
  assert.equal(normalizeWrongBookSkippedReason("题目不存在"), "题目已不存在");
  assert.equal(normalizeWrongBookSkippedReason("已有未完成订正任务"), "已有未完成订正任务");
});

test("wrong-book helpers derive default due dates and page state flags", () => {
  const upcomingReviewItem = {
    id: "review-2",
    questionId: "question-3",
    intervalLevel: 2,
    intervalLabel: "三天后",
    nextReviewAt: "2026-03-21T08:00:00.000Z",
    lastReviewResult: "correct" as const,
    lastReviewAt: "2026-03-18T08:00:00.000Z",
    reviewCount: 1,
    status: "active" as const,
    originType: "wrong_book_review" as const,
    originLabel: "错题复练",
    originPaperId: null,
    originSubmittedAt: null,
    question: null
  };

  assert.equal(getWrongBookDefaultDueDate(new Date(2026, 2, 18, 9, 0, 0)), "2026-03-21");

  assert.equal(
    hasWrongBookContent({
      list: [],
      tasks: [],
      reviewQueue: null,
      summary: null
    }),
    false
  );
  assert.equal(
    hasWrongBookContent({
      list: [],
      tasks: [],
      reviewQueue: {
        summary: {
          totalActive: 1,
          dueToday: 1,
          overdue: 0,
          upcoming: 0
        },
        today: [],
        upcoming: [upcomingReviewItem]
      },
      summary: null
    }),
    true
  );

  assert.equal(
    isWrongBookActionBusy({
      creatingTasks: false,
      completingTaskIds: {},
      reviewSubmitting: {}
    }),
    false
  );
  assert.equal(
    isWrongBookActionBusy({
      creatingTasks: false,
      completingTaskIds: { "task-1": true },
      reviewSubmitting: {}
    }),
    true
  );
});

test("wrong-book helpers build refresh feedback messages for task and review flows", () => {
  const nextReviewAt = "2026-03-18T08:00:00.000Z";

  assert.equal(getWrongBookTaskGenerationFeedback(2, "loaded"), "已创建 2 个订正任务。");
  assert.equal(
    getWrongBookTaskGenerationFeedback(0, "stale"),
    "所选错题暂未创建新的订正任务 系统正在同步最新列表。"
  );
  assert.equal(
    getWrongBookTaskCompletionFeedback("partial"),
    "订正任务已标记完成，但部分列表刷新失败，请稍后重试。"
  );
  assert.equal(
    buildWrongBookReviewFeedbackMessage({
      correct: true,
      intervalLabel: "明天",
      nextReviewAt,
      refreshStatus: "loaded"
    }),
    `复练正确，下一轮：明天（${formatDateTime(nextReviewAt)}）`
  );
  assert.equal(
    buildWrongBookReviewFeedbackMessage({
      correct: false,
      intervalLabel: null,
      nextReviewAt: null,
      refreshStatus: "stale"
    }),
    "复练错误，系统正在同步最新列表。"
  );
});
