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
  getSchoolAdminRequestMessage,
  isSchoolAdminAuthRequiredError
} = require("../../app/school/utils") as typeof import("../../app/school/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("getSchoolAdminRequestMessage maps school context errors to actionable copy", () => {
  assert.equal(
    getSchoolAdminRequestMessage(createRequestError(403, "school not bound"), "fallback"),
    "当前账号尚未绑定学校，暂时无法查看学校数据。"
  );
  assert.equal(
    getSchoolAdminRequestMessage(createRequestError(403, "cross school access denied"), "fallback"),
    "当前账号不能访问这所学校的数据，请切换到有权限的学校后再试。"
  );
  assert.equal(
    getSchoolAdminRequestMessage(createRequestError(400, "schoolId required for platform admin"), "fallback"),
    "当前页面需要明确学校上下文；请选择学校后再查看。"
  );
});

test("isSchoolAdminAuthRequiredError distinguishes session expiry from school context errors", () => {
  assert.equal(isSchoolAdminAuthRequiredError(createRequestError(401, "unauthorized")), true);
  assert.equal(isSchoolAdminAuthRequiredError(createRequestError(403, "forbidden")), true);
  assert.equal(isSchoolAdminAuthRequiredError(createRequestError(403, "school not bound")), false);
  assert.equal(isSchoolAdminAuthRequiredError(createRequestError(403, "cross school access denied")), false);
});
