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
  getStudentExamListRequestMessage,
  getStudentSelfAssessmentRequestMessage
} = require("../../app/student/exams/utils") as typeof import("../../app/student/exams/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student exams helpers map auth and stale class errors", () => {
  assert.equal(
    getStudentExamListRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看在线考试。"
  );
  assert.equal(
    getStudentExamListRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级信息已失效，考试列表会在重新加入班级后恢复。"
  );
});

test("student exams helpers map self-assessment auth and stale class errors", () => {
  assert.equal(
    getStudentSelfAssessmentRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看自主测评任务。"
  );
  assert.equal(
    getStudentSelfAssessmentRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级信息已失效，自主测评任务会在重新加入班级后恢复。"
  );
});
