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
  if (request === "@/lib/constants") {
    return path.resolve(__dirname, "../../lib/constants.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getTeacherNotificationRulesRequestMessage,
  isMissingTeacherNotificationClassError
} = require("../../app/teacher/notifications/utils") as typeof import("../../app/teacher/notifications/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher notification rules helpers map auth and validation errors", () => {
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续配置通知规则。"
  );
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(400, "body.classId must be at least 1 chars"), "fallback"),
    "请先选择班级后再操作。"
  );
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(400, "body.dueDays must be >= 0"), "fallback"),
    "截止前提醒天数不能小于 0。"
  );
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(400, "body.overdueDays must be >= 0"), "fallback"),
    "逾期提醒天数不能小于 0。"
  );
});

test("teacher notification rules helpers detect stale class context", () => {
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的配置权限。"
  );
  assert.equal(isMissingTeacherNotificationClassError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherNotificationClassError(createRequestError(400, "bad request")), false);
});
