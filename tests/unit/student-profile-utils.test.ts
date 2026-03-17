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
  getStudentObserverCodeRequestMessage,
  getStudentProfileRequestMessage
} = require("../../app/student/profile/utils") as typeof import("../../app/student/profile/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student profile helpers map auth and required-field errors", () => {
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续维护资料。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "missing fields"), "fallback"),
    "请先补全年级和关注学科后再保存。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "body.heightCm must be <= 220"), "fallback"),
    "身高需填写 100 到 220 厘米之间的整数。"
  );
});

test("student profile helpers map observer-code auth and enum errors", () => {
  assert.equal(
    getStudentObserverCodeRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看家长绑定码。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "body.seatPreference must be one of the allowed values"), "fallback"),
    "座位偏好选项无效，请重新选择。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "body.peerSupport must be one of the allowed values"), "fallback"),
    "同桌协作选项无效，请重新选择。"
  );
});
