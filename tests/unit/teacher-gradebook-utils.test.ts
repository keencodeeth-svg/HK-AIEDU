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
  getTeacherGradebookRequestMessage,
  resolveTeacherGradebookClassId
} = require("../../app/teacher/gradebook/utils") as typeof import("../../app/teacher/gradebook/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher gradebook helpers map request errors", () => {
  assert.equal(
    getTeacherGradebookRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看成绩册。"
  );
  assert.equal(
    getTeacherGradebookRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不存在，或你没有查看这份成绩册的权限。"
  );
});

test("resolveTeacherGradebookClassId always uses actual payload scope", () => {
  assert.equal(
    resolveTeacherGradebookClassId({
      class: { id: "class-b", name: "B班", subject: "math", grade: "4" },
      classes: [
        { id: "class-a", name: "A班", subject: "math", grade: "4" },
        { id: "class-b", name: "B班", subject: "math", grade: "4" }
      ]
    }),
    "class-b"
  );
  assert.equal(resolveTeacherGradebookClassId({ class: null, classes: [] }), "");
});
