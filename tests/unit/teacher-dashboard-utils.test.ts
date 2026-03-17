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
  getTeacherDashboardAlertRequestMessage,
  getTeacherDashboardClassRequestMessage,
  getTeacherDashboardJoinRequestMessage,
  isMissingTeacherDashboardAlertError,
  isMissingTeacherDashboardClassError,
  isMissingTeacherDashboardJoinRequestError,
  isTeacherDashboardModuleMissingError
} = require("../../app/teacher/dashboard-utils") as typeof import("../../app/teacher/dashboard-utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher dashboard class helpers map business errors", () => {
  assert.equal(
    getTeacherDashboardClassRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的操作权限。"
  );
  assert.equal(
    getTeacherDashboardClassRequestMessage(createRequestError(404, "student not found"), "fallback"),
    "未找到该学生账号，请确认学生邮箱是否正确。"
  );
  assert.equal(
    getTeacherDashboardClassRequestMessage(createRequestError(400, "module not found"), "fallback"),
    "所选课程模块不存在，或已不属于当前班级。"
  );
  assert.equal(isMissingTeacherDashboardClassError(createRequestError(404, "not found")), true);
  assert.equal(isTeacherDashboardModuleMissingError(createRequestError(400, "module not found")), true);
});

test("teacher dashboard alert and join request helpers distinguish stale entities", () => {
  assert.equal(
    getTeacherDashboardAlertRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该预警已不存在，列表将按最新状态刷新。"
  );
  assert.equal(
    getTeacherDashboardJoinRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该加入班级申请已不存在，列表将按最新状态刷新。"
  );
  assert.equal(isMissingTeacherDashboardAlertError(createRequestError(400, "invalid alert id")), true);
  assert.equal(isMissingTeacherDashboardJoinRequestError(createRequestError(404, "not found")), true);
});
