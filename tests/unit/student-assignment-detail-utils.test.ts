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
  buildStudentAssignmentSnapshotNotice,
  deriveStudentAssignmentPageState,
  getStudentAssignmentDetailRequestMessage,
  getStudentAssignmentDeleteUploadSuccessMessage,
  getStudentAssignmentReviewRequestMessage,
  getStudentAssignmentSubmitSuccessMessage,
  getStudentAssignmentUploadRequestMessage,
  getStudentAssignmentUploadSuccessMessage,
  isMissingStudentAssignmentDetailError,
  mergeStudentAssignmentSubmitResult,
  shouldLoadStudentAssignmentReview,
  shouldLoadStudentAssignmentUploads
} = require("../../app/student/assignments/[id]/utils") as typeof import("../../app/student/assignments/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student assignment detail helpers map auth, missing resource, and submit validation errors", () => {
  assert.equal(
    getStudentAssignmentDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看作业。"
  );
  assert.equal(
    getStudentAssignmentDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "作业不存在，或你当前账号无权查看这份作业。"
  );
  assert.equal(
    getStudentAssignmentDetailRequestMessage(createRequestError(400, "请填写作文内容或上传作业图片"), "fallback"),
    "请先填写作文内容，或至少上传 1 份作业图片后再提交。"
  );
  assert.equal(isMissingStudentAssignmentDetailError(createRequestError(404, "not found")), true);
});

test("student assignment detail helpers map review and upload request errors", () => {
  assert.equal(
    getStudentAssignmentReviewRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看老师反馈。"
  );
  assert.equal(
    getStudentAssignmentUploadRequestMessage(createRequestError(400, "单个文件不能超过 3MB"), "fallback"),
    "单个文件大小不能超过 3MB。"
  );
  assert.equal(
    getStudentAssignmentUploadRequestMessage(createRequestError(400, "missing uploadId"), "fallback"),
    "未找到要删除的上传文件，请刷新列表后重试。"
  );
});

test("student assignment detail helpers derive refresh requirements and snapshot notices", () => {
  const quizDetail = {
    assignment: {
      id: "assignment-1",
      title: "作业 1",
      dueDate: "2026-03-19T08:00:00.000Z",
      createdAt: "2026-03-18T08:00:00.000Z",
      submissionType: "quiz" as const
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "7"
    },
    questions: [
      { id: "question-1", stem: "1+1=?", options: ["1", "2"] }
    ],
    progress: {
      status: "completed"
    }
  };

  const essayDetail = {
    ...quizDetail,
    assignment: {
      ...quizDetail.assignment,
      submissionType: "essay" as const
    },
    progress: {
      status: "in_progress"
    }
  };

  assert.equal(shouldLoadStudentAssignmentReview(quizDetail), true);
  assert.equal(shouldLoadStudentAssignmentReview(essayDetail), false);
  assert.equal(shouldLoadStudentAssignmentUploads(essayDetail), true);
  assert.equal(shouldLoadStudentAssignmentUploads(quizDetail), false);
  assert.equal(
    buildStudentAssignmentSnapshotNotice("老师反馈", "网络异常", true),
    "老师反馈刷新失败，已展示最近一次成功数据：网络异常"
  );
  assert.equal(
    buildStudentAssignmentSnapshotNotice("上传记录", "网络异常", false),
    "上传记录加载失败：网络异常"
  );
});

test("student assignment detail helpers derive page state for quiz and essay flows", () => {
  const quizDetail = {
    assignment: {
      id: "assignment-2",
      title: "作业 2",
      dueDate: "2026-03-20T08:00:00.000Z",
      createdAt: "2026-03-18T08:00:00.000Z",
      submissionType: "quiz" as const
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "7"
    },
    questions: [
      { id: "question-1", stem: "1+1=?", options: ["1", "2"] },
      { id: "question-2", stem: "2+2=?", options: ["3", "4"] }
    ],
    progress: {
      status: "in_progress"
    }
  };
  const essayDetail = {
    ...quizDetail,
    assignment: {
      ...quizDetail.assignment,
      submissionType: "essay" as const,
      maxUploads: 2
    },
    questions: []
  };

  const quizState = deriveStudentAssignmentPageState({
    data: quizDetail,
    answers: { "question-1": "B" },
    result: null,
    review: null,
    uploads: [],
    submissionText: ""
  });
  const essayState = deriveStudentAssignmentPageState({
    data: essayDetail,
    answers: {},
    result: null,
    review: null,
    uploads: [],
    submissionText: "作文正文"
  });

  assert.equal(quizState.answeredCount, 1);
  assert.equal(quizState.canSubmit, false);
  assert.equal(quizState.statusLabel, "进行中");
  assert.equal(quizState.stageCopy.title, "已完成 1/2 题");

  assert.equal(essayState.isEssay, true);
  assert.equal(essayState.hasText, true);
  assert.equal(essayState.canSubmit, true);
  assert.equal(essayState.stageCopy.title, "内容已准备好，可以提交");
});

test("student assignment detail helpers merge submit results and build success messages", () => {
  const detail = {
    assignment: {
      id: "assignment-3",
      title: "作业 3",
      dueDate: "2026-03-20T08:00:00.000Z",
      createdAt: "2026-03-18T08:00:00.000Z",
      submissionType: "quiz" as const
    },
    class: {
      id: "class-1",
      name: "一班",
      subject: "math",
      grade: "7"
    },
    questions: [
      { id: "question-1", stem: "1+1=?", options: ["1", "2"] }
    ],
    progress: {
      status: "in_progress",
      score: 0,
      total: 1
    }
  };
  const result = {
    score: 1,
    total: 1,
    details: [
      {
        questionId: "question-1",
        correct: true,
        answer: "B",
        correctAnswer: "B",
        explanation: "因为 1+1=2"
      }
    ]
  };

  assert.deepEqual(mergeStudentAssignmentSubmitResult(detail, result)?.progress, {
    status: "completed",
    score: 1,
    total: 1
  });
  assert.equal(
    getStudentAssignmentUploadSuccessMessage(2, "stale"),
    "已上传 2 份文件，系统正在同步最新上传列表。"
  );
  assert.equal(
    getStudentAssignmentDeleteUploadSuccessMessage("failed"),
    "文件已删除，但上传列表刷新失败，请稍后重试。"
  );
  assert.equal(
    getStudentAssignmentSubmitSuccessMessage("ok"),
    "提交成功，已为你定位到下方结果与反馈区。"
  );
});
