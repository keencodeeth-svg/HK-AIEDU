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
  getFocusSessionSaveRequestMessage,
  getFocusSummaryRequestMessage
} = require("../../app/focus/utils") as typeof import("../../app/focus/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("focus helpers map auth expiry and invalid duration errors", () => {
  assert.equal(
    getFocusSummaryRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续使用专注计时。"
  );
  assert.equal(
    getFocusSessionSaveRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续记录专注时长。"
  );
  assert.equal(
    getFocusSessionSaveRequestMessage(createRequestError(400, "invalid duration"), "fallback"),
    "专注时长无效，请重新选择时长后再试。"
  );
});
