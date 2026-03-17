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

const { getStudentGrowthRequestMessage } = require("../../app/student/growth/utils") as typeof import("../../app/student/growth/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student growth helpers map auth expiry copy", () => {
  assert.equal(
    getStudentGrowthRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看成长档案。"
  );
  assert.equal(
    getStudentGrowthRequestMessage(createRequestError(500, "server exploded"), "fallback"),
    "server exploded"
  );
});
