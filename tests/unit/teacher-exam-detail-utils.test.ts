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
  getTeacherExamDetailRequestMessage,
  isMissingTeacherExamDetailError
} = require("../../app/teacher/exams/[id]/utils") as typeof import("../../app/teacher/exams/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher exam detail helpers map auth and business errors", () => {
  assert.equal(
    getTeacherExamDetailRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看考试详情。"
  );
  assert.equal(
    getTeacherExamDetailRequestMessage(createRequestError(400, "考试已关闭"), "fallback"),
    "考试已经处于关闭状态，无需重复操作。"
  );
  assert.equal(
    getTeacherExamDetailRequestMessage(createRequestError(400, "考试题目为空"), "fallback"),
    "当前考试没有题目，暂时无法发布复盘任务。"
  );
});

test("teacher exam detail helpers detect stale exam resources", () => {
  const missingError = createRequestError(404, "not found");

  assert.equal(
    getTeacherExamDetailRequestMessage(missingError, "fallback"),
    "考试不存在，或当前教师账号无权查看该考试。"
  );
  assert.equal(isMissingTeacherExamDetailError(missingError), true);
  assert.equal(isMissingTeacherExamDetailError(createRequestError(400, "考试已开放")), false);
});
