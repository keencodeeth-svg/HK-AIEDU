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
  applyTeacherPaperQuickFix,
  buildTeacherAiToolsCheckPreviewOptions,
  buildTeacherReviewPackDispatchMessage,
  filterTeacherAiToolsKnowledgePoints,
  getTeacherAiToolsDerivedState,
  getTeacherAiToolsRequestMessage,
  hasTeacherAiToolsCheckPreview,
  hasTeacherAiToolsClassChanged,
  isMissingTeacherAiToolsClassError,
  isMissingTeacherAiToolsQuestionError,
  pruneTeacherAiToolsKnowledgePointIds,
  resetTeacherAiToolsOutlineFormScope,
  resetTeacherAiToolsPaperFormScope,
  resetTeacherAiToolsWrongFormScope,
  resolveTeacherAiToolsClassId,
  summarizeTeacherReviewPackFailedItems
} = require("../../app/teacher/ai-tools/utils") as typeof import("../../app/teacher/ai-tools/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher ai tools helpers map auth and business validation errors", () => {
  assert.equal(
    getTeacherAiToolsRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续使用 AI 工具。"
  );
  assert.equal(
    getTeacherAiToolsRequestMessage(createRequestError(400, "missing fields"), "fallback", "question_check"),
    "请先补全题干、选项和答案后再做纠错检查。"
  );
  assert.equal(
    getTeacherAiToolsRequestMessage(
      createRequestError(400, "body.items must contain at least 1 items"),
      "fallback",
      "review_pack_dispatch"
    ),
    "请至少选择 1 条复练单后再下发。"
  );
});

test("teacher ai tools helpers distinguish missing class from missing question", () => {
  const missingError = createRequestError(404, "not found");

  assert.equal(
    getTeacherAiToolsRequestMessage(missingError, "fallback", "paper"),
    "当前班级不存在，或你已失去该班级的操作权限。"
  );
  assert.equal(
    getTeacherAiToolsRequestMessage(missingError, "fallback", "question_check"),
    "当前题目不存在，请刷新题库后重试。"
  );
  assert.equal(isMissingTeacherAiToolsClassError(missingError), true);
  assert.equal(isMissingTeacherAiToolsQuestionError(missingError), true);
  assert.equal(isMissingTeacherAiToolsClassError(createRequestError(400, "missing fields")), false);
});

test("resolveTeacherAiToolsClassId falls back to the first available class", () => {
  const classes = [
    { id: "class-a" },
    { id: "class-b" }
  ];

  assert.equal(resolveTeacherAiToolsClassId("class-b", classes), "class-b");
  assert.equal(resolveTeacherAiToolsClassId("missing-class", classes), "class-a");
  assert.equal(resolveTeacherAiToolsClassId("", classes), "class-a");
  assert.equal(resolveTeacherAiToolsClassId("missing-class", []), "");
  assert.equal(hasTeacherAiToolsClassChanged("class-a", "class-b"), true);
  assert.equal(hasTeacherAiToolsClassChanged("", "class-b"), false);
});

test("teacher ai tools helpers derive paper quick-fix forms deterministically", () => {
  const baseForm = {
    classId: "class-a",
    knowledgePointIds: ["kp-1"],
    difficulty: "hard" as const,
    questionType: "choice" as const,
    durationMinutes: 24,
    questionCount: 0,
    mode: "bank" as const,
    includeIsolated: false
  };

  assert.deepEqual(applyTeacherPaperQuickFix(baseForm, "clear_filters"), {
    nextForm: {
      ...baseForm,
      knowledgePointIds: [],
      difficulty: "all",
      questionType: "all"
    },
    hint: "已清空知识点/难度/题型筛选，正在重试。"
  });
  assert.deepEqual(applyTeacherPaperQuickFix(baseForm, "switch_ai"), {
    nextForm: {
      ...baseForm,
      mode: "ai"
    },
    hint: "已切换为 AI 补题模式，正在重试。"
  });
  assert.deepEqual(applyTeacherPaperQuickFix(baseForm, "reduce_count"), {
    nextForm: {
      ...baseForm,
      questionCount: 8
    },
    hint: "已降低题量到 8 题，正在重试。"
  });
  assert.deepEqual(applyTeacherPaperQuickFix({ ...baseForm, questionCount: 9 }, "allow_isolated"), {
    nextForm: {
      ...baseForm,
      questionCount: 9,
      includeIsolated: true
    },
    hint: "已允许使用隔离池高风险题，正在重试（请人工复核）。"
  });
});

test("teacher ai tools helpers filter and prune scoped knowledge points deterministically", () => {
  const points = [
    { id: "kp-1", subject: "math", grade: "4", title: "分数乘法", chapter: "第三章" },
    { id: "kp-2", subject: "english", grade: "4", title: "现在进行时", chapter: "第二章" },
    { id: "kp-3", subject: "math", grade: "5", title: "方程", chapter: "第一章" }
  ];

  assert.deepEqual(
    filterTeacherAiToolsKnowledgePoints(points, {
      id: "class-a",
      name: "四年级一班",
      subject: "math",
      grade: "4"
    }).map((item) => item.id),
    ["kp-1"]
  );
  assert.deepEqual(
    pruneTeacherAiToolsKnowledgePointIds(["kp-1", "kp-3"], new Set(["kp-1"])),
    ["kp-1"]
  );
  assert.deepEqual(
    resetTeacherAiToolsPaperFormScope(
      {
        classId: "class-a",
        knowledgePointIds: ["kp-1"],
        difficulty: "hard",
        questionType: "choice",
        durationMinutes: 40,
        questionCount: 8,
        mode: "bank",
        includeIsolated: false
      },
      "class-b"
    ),
    {
      classId: "class-b",
      knowledgePointIds: [],
      difficulty: "hard",
      questionType: "choice",
      durationMinutes: 40,
      questionCount: 8,
      mode: "bank",
      includeIsolated: false
    }
  );
  assert.deepEqual(
    resetTeacherAiToolsOutlineFormScope(
      {
        classId: "class-a",
        topic: "分数",
        knowledgePointIds: ["kp-1", "kp-2"]
      },
      "class-b"
    ),
    {
      classId: "class-b",
      topic: "分数",
      knowledgePointIds: []
    }
  );
  assert.deepEqual(
    resetTeacherAiToolsWrongFormScope(
      { classId: "class-a", rangeDays: 14 },
      "class-b"
    ),
    {
      classId: "class-b",
      rangeDays: 14
    }
  );
});

test("teacher ai tools helpers derive question-check preview state predictably", () => {
  const previewOptions = buildTeacherAiToolsCheckPreviewOptions([" A ", "", "B"]);
  assert.deepEqual(previewOptions, ["A", "B"]);
  assert.equal(
    hasTeacherAiToolsCheckPreview(
      {
        questionId: "",
        stem: "",
        options: [" A ", "", "B"],
        answer: "",
        explanation: ""
      },
      previewOptions
    ),
    true
  );
  assert.equal(
    hasTeacherAiToolsCheckPreview(
      {
        questionId: "",
        stem: "",
        options: ["", ""],
        answer: "",
        explanation: ""
      },
      []
    ),
    false
  );
  const derived = getTeacherAiToolsDerivedState({
    classes: [
      { id: "class-a", name: "四年级一班", subject: "math", grade: "4" },
      { id: "class-b", name: "五年级一班", subject: "english", grade: "5" }
    ],
    knowledgePoints: [
      { id: "kp-1", subject: "math", grade: "4", title: "分数", chapter: "第一章" },
      { id: "kp-2", subject: "english", grade: "5", title: "语法", chapter: "第二章" },
      { id: "kp-3", subject: "math", grade: "5", title: "方程", chapter: "第三章" }
    ],
    paperForm: {
      classId: "class-a",
      knowledgePointIds: [],
      difficulty: "all",
      questionType: "all",
      durationMinutes: 40,
      questionCount: 0,
      mode: "ai",
      includeIsolated: false
    },
    outlineForm: {
      classId: "class-b",
      topic: "语法复习",
      knowledgePointIds: []
    },
    checkForm: {
      questionId: "",
      stem: "",
      options: [" A ", "", "B"],
      answer: "",
      explanation: ""
    }
  });

  assert.deepEqual(derived.paperPoints.map((item) => item.id), ["kp-1"]);
  assert.deepEqual(derived.outlinePoints.map((item) => item.id), ["kp-2"]);
  assert.deepEqual(Array.from(derived.paperPointIdSet), ["kp-1"]);
  assert.deepEqual(Array.from(derived.outlinePointIdSet), ["kp-2"]);
  assert.deepEqual(derived.checkPreviewOptions, ["A", "B"]);
  assert.equal(derived.hasCheckPreview, true);
});

test("teacher ai tools helpers build review-pack dispatch summaries and failure copy", () => {
  const summary = {
    created: 4,
    requested: 6,
    studentsNotified: 4,
    parentsNotified: 2,
    relaxedCount: 1,
    qualityGovernance: {
      includeIsolated: false,
      isolatedPoolCount: 3,
      isolatedExcludedCount: 2,
      selectedIsolatedCount: 0
    }
  };

  assert.equal(
    buildTeacherReviewPackDispatchMessage(summary, "single"),
    "已下发 4/6 条，通知学生 4 人，家长 2 人。 已排除隔离池候选 2 次。 已自动放宽 1 条。"
  );
  assert.equal(
    buildTeacherReviewPackDispatchMessage(summary, "batch"),
    "已批量下发 4/6 条，通知学生 4 人，家长 2 人。 已排除隔离池候选 2 次。 已自动放宽 1 条。"
  );
  assert.equal(
    buildTeacherReviewPackDispatchMessage(summary, "retry"),
    "失败项重试完成：新增下发 4/6 条，自动放宽 1 条。"
  );
  assert.equal(
    summarizeTeacherReviewPackFailedItems(
      [
        { title: "复练 A", reason: "题库为空" },
        { title: "复练 B", reason: "质量门禁拦截" }
      ],
      "失败"
    ),
    "失败 2 条：复练 A：题库为空；复练 B：质量门禁拦截"
  );
  assert.equal(summarizeTeacherReviewPackFailedItems([], "失败"), null);
});
