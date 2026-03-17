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
  getStudentDashboardJoinRequestMessage,
  getStudentDashboardRequestMessage,
  isMissingStudentDashboardClassError
} = require("../../app/student/dashboard-utils") as typeof import("../../app/student/dashboard-utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student dashboard helpers map auth and stale class errors", () => {
  assert.equal(
    getStudentDashboardRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看学习控制台。"
  );
  assert.equal(
    getStudentDashboardRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级信息已失效，课表与任务会在重新加入班级后恢复。"
  );
  assert.equal(isMissingStudentDashboardClassError(createRequestError(404, "not found")), true);
});

test("student dashboard join helpers map invite-code errors", () => {
  assert.equal(
    getStudentDashboardJoinRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续加入班级。"
  );
  assert.equal(
    getStudentDashboardJoinRequestMessage(createRequestError(404, "邀请码无效"), "fallback"),
    "邀请码无效，请检查老师提供的邀请码后重试。"
  );
  assert.equal(
    getStudentDashboardJoinRequestMessage(createRequestError(400, "班级与学生学校不匹配"), "fallback"),
    "该班级与当前学生账号不属于同一学校，暂时无法加入。"
  );
});
