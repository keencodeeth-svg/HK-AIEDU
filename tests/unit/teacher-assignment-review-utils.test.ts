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
  buildReviewItemState,
  buildReviewRubricState,
  buildTeacherAssignmentReviewSubmitPayload,
  getTeacherAssignmentReviewRequestMessage,
  getTeacherAssignmentReviewDerivedState,
  isMissingTeacherAssignmentReviewError
} = require("../../app/teacher/assignments/[id]/reviews/[studentId]/utils") as typeof import("../../app/teacher/assignments/[id]/reviews/[studentId]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher assignment review helpers map auth and ai review validation errors", () => {
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续批改。"
  );
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(400, "该作业为在线题目，不支持 AI 批改"), "fallback"),
    "该作业为在线题目，不能走 AI 作文/附件批改流程。"
  );
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(400, "学生未上传作业"), "fallback"),
    "学生尚未上传作业附件，暂时无法发起 AI 批改。"
  );
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(400, "学生未提交作文内容或附件"), "fallback"),
    "学生尚未提交作文内容或附件，暂时无法发起 AI 批改。"
  );
});

test("teacher assignment review helpers detect stale assignment or student access", () => {
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(404, "not found"), "fallback"),
    "作业不存在，或当前教师账号无权查看这份批改记录。"
  );
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(400, "student not in class"), "fallback"),
    "该学生已不在当前班级中，无法查看或批改这份作业。"
  );
  assert.equal(
    getTeacherAssignmentReviewRequestMessage(createRequestError(404, "student not found"), "fallback"),
    "学生不存在，可能已被移出当前班级。"
  );
  assert.equal(isMissingTeacherAssignmentReviewError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherAssignmentReviewError(createRequestError(400, "student not in class")), true);
  assert.equal(isMissingTeacherAssignmentReviewError(createRequestError(404, "student not found")), true);
  assert.equal(isMissingTeacherAssignmentReviewError(createRequestError(400, "bad request")), false);
});

test("teacher assignment review helpers derive review mode and hydrate persisted review state", () => {
  const derivedState = getTeacherAssignmentReviewDerivedState({
    assignment: { id: "assignment-1", title: "作文", dueDate: "2026-03-20T00:00:00.000Z", submissionType: "essay" },
    class: { id: "class-1", name: "四年级一班", subject: "math", grade: "4" },
    student: { id: "student-1", name: "学生甲", email: "student@example.com" },
    submission: { answers: {}, score: 0, total: 0, submissionText: "作文内容" },
    uploads: [{ id: "upload-1", fileName: "essay.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024, contentBase64: "ZmFrZQ==", createdAt: "2026-03-20T01:00:00.000Z" }],
    aiReview: { result: null },
    questions: [
      { id: "question-1", stem: "题目 1", options: [], answer: "A", correctAnswer: "B", explanation: "解析", correct: false },
      { id: "question-2", stem: "题目 2", options: [], answer: "A", correctAnswer: "A", explanation: "解析", correct: true }
    ],
    review: { overallComment: "继续努力" },
    reviewItems: [{ questionId: "question-1", wrongTag: "审题错误", comment: "漏看条件" }],
    rubrics: [{ id: "rubric-1", title: "内容", maxScore: 10, weight: 1 }],
    reviewRubrics: [{ rubricId: "rubric-1", score: 8, comment: "内容完整" }]
  });

  assert.equal(derivedState.canAiReview, true);
  assert.equal(derivedState.isEssay, true);
  assert.equal(derivedState.isUpload, false);
  assert.equal(derivedState.isQuiz, false);
  assert.deepEqual(
    derivedState.wrongQuestions.map((question) => question.id),
    ["question-1"]
  );

  assert.deepEqual(buildReviewItemState([{ questionId: "question-1", wrongTag: "审题错误", comment: "漏看条件" }]), {
    "question-1": { wrongTag: "审题错误", comment: "漏看条件" }
  });
  assert.deepEqual(
    buildReviewRubricState([{ rubricId: "rubric-1", score: 8, comment: "内容完整" }], [{ id: "rubric-1", title: "内容", maxScore: 10, weight: 1 }]),
    { "rubric-1": { score: 8, comment: "内容完整" } }
  );
});

test("teacher assignment review helpers build stable submit payloads from local review state", () => {
  assert.deepEqual(
    buildTeacherAssignmentReviewSubmitPayload({
      data: {
        assignment: { id: "assignment-1", title: "练习", dueDate: "2026-03-20T00:00:00.000Z", submissionType: "quiz" },
        class: { id: "class-1", name: "四年级一班", subject: "math", grade: "4" },
        student: { id: "student-1", name: "学生甲", email: "student@example.com" },
        submission: { answers: { "question-1": "A" }, score: 0, total: 1 },
        uploads: [],
        aiReview: null,
        questions: [{ id: "question-1", stem: "题目 1", options: [], answer: "A", correctAnswer: "B", explanation: "解析", correct: false }],
        review: null,
        reviewItems: [],
        rubrics: [
          { id: "rubric-1", title: "知识点", maxScore: 5, weight: 1 },
          { id: "rubric-2", title: "表达", maxScore: 5, weight: 1 }
        ],
        reviewRubrics: []
      },
      overallComment: "请复习基础概念",
      wrongQuestions: [{ id: "question-1", stem: "题目 1", options: [], answer: "A", correctAnswer: "B", explanation: "解析", correct: false }],
      itemState: {
        "question-1": { wrongTag: "概念混淆", comment: "单位换算错误" }
      },
      rubricState: {
        "rubric-1": { score: 4, comment: "知识点基本掌握" }
      }
    }),
    {
      overallComment: "请复习基础概念",
      items: [{ questionId: "question-1", wrongTag: "概念混淆", comment: "单位换算错误" }],
      rubrics: [
        { rubricId: "rubric-1", score: 4, comment: "知识点基本掌握" },
        { rubricId: "rubric-2", score: 0, comment: "" }
      ]
    }
  );
});
