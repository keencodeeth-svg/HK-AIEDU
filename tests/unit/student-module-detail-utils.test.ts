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
  getStudentModuleDetailRequestMessage,
  isMissingStudentModuleDetailError
} = require("../../app/student/modules/[id]/utils") as typeof import("../../app/student/modules/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student module detail helpers map auth expiry and stale module access", () => {
  assert.equal(
    getStudentModuleDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看模块。"
  );
  assert.equal(
    getStudentModuleDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "模块不存在，或你已失去对应班级的访问权限。"
  );
});

test("student module detail helpers detect missing module context", () => {
  assert.equal(isMissingStudentModuleDetailError(createRequestError(404, "not found")), true);
  assert.equal(isMissingStudentModuleDetailError(createRequestError(400, "bad request")), false);
});
