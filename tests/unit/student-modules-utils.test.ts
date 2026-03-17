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
  getStudentModulesRequestMessage,
  resolveStudentModulesSubjectFilter
} = require("../../app/student/modules/utils") as typeof import("../../app/student/modules/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student modules helpers map auth expiry and stale class copy", () => {
  assert.equal(
    getStudentModulesRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看课程模块。"
  );
  assert.equal(
    getStudentModulesRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不存在，模块列表已按最新状态刷新。"
  );
});

test("student modules helpers clear stale subject filter after refresh", () => {
  const nextData = [{ subject: "math" }, { subject: "english" }];

  assert.equal(resolveStudentModulesSubjectFilter(nextData, "math"), "math");
  assert.equal(resolveStudentModulesSubjectFilter(nextData, "physics"), "all");
  assert.equal(resolveStudentModulesSubjectFilter(nextData, "all"), "all");
});
