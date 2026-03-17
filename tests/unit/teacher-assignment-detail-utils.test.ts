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
  getTeacherAssignmentDetailRequestMessage,
  isMissingTeacherAssignmentDetailError
} = require("../../app/teacher/assignments/[id]/utils") as typeof import("../../app/teacher/assignments/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher assignment detail helpers map auth and rubric validation errors", () => {
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看作业。"
  );
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(400, "missing items"), "fallback"),
    "请至少保留一个评分维度后再保存评分细则。"
  );
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(400, "body.items[0].title cannot be empty"), "fallback"),
    "评分维度标题不能为空。"
  );
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(400, "body.items[0].levels[0].score must be a number"), "fallback"),
    "评分档位分值格式不正确，请重新填写。"
  );
});

test("teacher assignment detail helpers detect stale assignment access", () => {
  const missingError = createRequestError(404, "not found");

  assert.equal(
    getTeacherAssignmentDetailRequestMessage(missingError, "fallback"),
    "作业不存在，或当前教师账号无权查看该作业。"
  );
  assert.equal(isMissingTeacherAssignmentDetailError(missingError), true);
  assert.equal(isMissingTeacherAssignmentDetailError(createRequestError(400, "missing items")), false);
});
