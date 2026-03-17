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
  getChallengeClaimRequestMessage,
  getChallengeLoadRequestMessage
} = require("../../app/challenge/utils") as typeof import("../../app/challenge/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("challenge helpers map auth expiry and missing task selection", () => {
  assert.equal(
    getChallengeLoadRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看挑战任务。"
  );
  assert.equal(
    getChallengeClaimRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续领取奖励。"
  );
  assert.equal(
    getChallengeClaimRequestMessage(createRequestError(400, "missing taskId"), "fallback"),
    "未找到要领取的挑战任务，请刷新列表后重试。"
  );
});
