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
  getTeacherExamsRequestMessage,
  resolveTeacherExamsClassFilter
} = require("../../app/teacher/exams/utils") as typeof import("../../app/teacher/exams/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher exams helpers map auth expiry to actionable copy", () => {
  assert.equal(
    getTeacherExamsRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看考试列表。"
  );
  assert.equal(
    getTeacherExamsRequestMessage(createRequestError(500, "server exploded"), "fallback"),
    "server exploded"
  );
});

test("resolveTeacherExamsClassFilter clears stale class filters after refresh", () => {
  const classOptions = [
    { id: "A班::math::4", name: "A班", subject: "math", grade: "4" },
    { id: "B班::english::5", name: "B班", subject: "english", grade: "5" }
  ];

  assert.equal(resolveTeacherExamsClassFilter("A班::math::4", classOptions), "A班::math::4");
  assert.equal(resolveTeacherExamsClassFilter("missing", classOptions), "");
  assert.equal(resolveTeacherExamsClassFilter("", classOptions), "");
});
