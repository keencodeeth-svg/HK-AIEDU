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
  getStudentExamDetailRequestMessage,
  getStudentExamReviewPackRequestMessage,
  isMissingStudentExamDetailError
} = require("../../app/student/exams/[id]/utils") as typeof import("../../app/student/exams/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student exam detail helpers map auth and stale exam errors", () => {
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看考试。"
  );
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "考试不存在，或你当前账号无权查看这场考试。"
  );
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(400, "考试作答时间已结束"), "fallback"),
    "考试作答时间已结束，当前无法继续保存或提交。"
  );
  assert.equal(isMissingStudentExamDetailError(createRequestError(404, "not found")), true);
});

test("student exam detail helpers map review-pack and payload validation errors", () => {
  assert.equal(
    getStudentExamReviewPackRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看考试复盘。"
  );
  assert.equal(
    getStudentExamReviewPackRequestMessage(createRequestError(404, "not found"), "fallback"),
    "考试复盘暂不可用，请稍后重试。"
  );
  assert.equal(
    getStudentExamDetailRequestMessage(createRequestError(400, "answers.q1 must be a string"), "fallback"),
    "答题内容格式无效，请刷新页面后重试。"
  );
});
