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
  getTeacherAssignmentReviewRequestMessage,
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
