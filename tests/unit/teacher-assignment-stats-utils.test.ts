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
  getTeacherAssignmentStatsRequestMessage,
  isMissingTeacherAssignmentStatsError
} = require("../../app/teacher/assignments/[id]/stats/utils") as typeof import("../../app/teacher/assignments/[id]/stats/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher assignment stats helpers map auth expiry and missing assignment", () => {
  assert.equal(
    getTeacherAssignmentStatsRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看作业统计。"
  );
  assert.equal(
    getTeacherAssignmentStatsRequestMessage(createRequestError(404, "not found"), "fallback"),
    "作业不存在，或当前教师账号无权查看这份作业统计。"
  );
});

test("teacher assignment stats helpers detect stale assignment context", () => {
  assert.equal(isMissingTeacherAssignmentStatsError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherAssignmentStatsError(createRequestError(400, "bad request")), false);
});
