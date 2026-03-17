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
  if (request === "@/lib/constants") {
    return path.resolve(__dirname, "../../lib/constants.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getStudentAssignmentsRequestMessage,
  isMissingStudentAssignmentsClassError,
  resolveStudentAssignmentsSubjectFilter
} = require("../../app/student/assignments/utils") as typeof import("../../app/student/assignments/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student assignments helpers map auth expiry and stale class copy", () => {
  assert.equal(
    getStudentAssignmentsRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看作业中心。"
  );
  assert.equal(
    getStudentAssignmentsRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级信息已失效，作业列表会在重新加入班级后恢复。"
  );
  assert.equal(isMissingStudentAssignmentsClassError(createRequestError(404, "not found")), true);
});

test("student assignments helpers clear stale subject filter after refresh", () => {
  const nextData = [
    {
      id: "assignment-1",
      title: "Math homework",
      dueDate: "2026-03-17T08:00:00.000Z",
      className: "Class 1",
      classSubject: "math",
      classGrade: "4",
      status: "pending",
      score: null,
      total: null,
      completedAt: null
    },
    {
      id: "assignment-2",
      title: "English homework",
      dueDate: "2026-03-18T08:00:00.000Z",
      className: "Class 1",
      classSubject: "english",
      classGrade: "4",
      status: "pending",
      score: null,
      total: null,
      completedAt: null
    }
  ];

  assert.equal(resolveStudentAssignmentsSubjectFilter(nextData, "math"), "math");
  assert.equal(resolveStudentAssignmentsSubjectFilter(nextData, "physics"), "all");
  assert.equal(resolveStudentAssignmentsSubjectFilter(nextData, "all"), "all");
});
