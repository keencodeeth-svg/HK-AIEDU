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
  getTeacherSubmissionsRequestMessage,
  resolveTeacherSubmissionsClassId
} = require("../../app/teacher/submissions/utils") as typeof import("../../app/teacher/submissions/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher submissions helpers map request errors", () => {
  assert.equal(
    getTeacherSubmissionsRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看提交箱。"
  );
  assert.equal(
    getTeacherSubmissionsRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你没有查看这批提交的权限。"
  );
});

test("resolveTeacherSubmissionsClassId clears stale class filters", () => {
  const classes = [
    { id: "class-a", name: "A班", subject: "math", grade: "4" },
    { id: "class-b", name: "B班", subject: "english", grade: "5" }
  ];

  assert.equal(resolveTeacherSubmissionsClassId(classes, "class-a"), "class-a");
  assert.equal(resolveTeacherSubmissionsClassId(classes, "missing-class"), "");
  assert.equal(resolveTeacherSubmissionsClassId(classes, ""), "");
});
