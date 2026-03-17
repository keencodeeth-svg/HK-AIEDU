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
  getDiagnosticStartRequestMessage,
  getDiagnosticSubmitRequestMessage
} = require("../../app/diagnostic/utils") as typeof import("../../app/diagnostic/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("diagnostic helpers map auth expiry and submit validation copy", () => {
  assert.equal(
    getDiagnosticStartRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续开始诊断。"
  );
  assert.equal(
    getDiagnosticSubmitRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续提交诊断。"
  );
  assert.equal(
    getDiagnosticSubmitRequestMessage(createRequestError(400, "missing fields"), "fallback"),
    "请至少完成 1 题后再提交诊断。"
  );
});
