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

const { resolveRegisterFormError } = require("../../lib/auth-form-errors") as typeof import("../../lib/auth-form-errors");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, code: string, message = code) {
  const error = new Error(message) as Error & { status?: number; payload?: unknown };
  error.status = status;
  error.payload = { error: code };
  return error;
}

const REGISTER_OPTIONS = {
  fallback: "注册失败",
  invalidSchoolCodeMessage: "学校编码无效，请核对后重试；不填则会归入默认学校。",
  observerCodeInvalidMessage: "绑定码无效，请回到学生资料页重新获取后再试。"
};

test("resolveRegisterFormError maps school code invalid variants to school code copy", () => {
  const schoolCodeInvalid = resolveRegisterFormError(
    createRequestError(404, "school code invalid"),
    REGISTER_OPTIONS
  );
  const invalidSchoolCode = resolveRegisterFormError(
    createRequestError(400, "invalid school code"),
    REGISTER_OPTIONS
  );

  assert.equal(schoolCodeInvalid, REGISTER_OPTIONS.invalidSchoolCodeMessage);
  assert.equal(invalidSchoolCode, REGISTER_OPTIONS.invalidSchoolCodeMessage);
});

test("resolveRegisterFormError maps observer lookup failures to observer code copy", () => {
  const observerCodeInvalid = resolveRegisterFormError(
    createRequestError(404, "observer code invalid"),
    REGISTER_OPTIONS
  );
  const studentNotFound = resolveRegisterFormError(
    createRequestError(404, "student not found"),
    REGISTER_OPTIONS
  );

  assert.equal(observerCodeInvalid, REGISTER_OPTIONS.observerCodeInvalidMessage);
  assert.equal(studentNotFound, REGISTER_OPTIONS.observerCodeInvalidMessage);
});
