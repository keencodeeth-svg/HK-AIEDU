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
  formatSubmissionType,
  getCourseNoStoreRequestInit,
  getCourseSaveRequestMessage,
  getCourseSummaryRequestMessage,
  getCourseSyllabusRequestMessage,
  isMissingCourseClassError,
  normalizeSyllabus,
  resolveCourseClassId,
  resolveCourseStateAfterMissingClass
} = require("../../app/course/utils") as typeof import("../../app/course/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("course helpers map auth expiry, missing class, and save validation errors", () => {
  assert.equal(
    getCourseSyllabusRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续查看课程主页。"
  );
  assert.equal(
    getCourseSummaryRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级课程概览不可用，可能已被移除或你已失去访问权限。"
  );
  assert.equal(
    getCourseSaveRequestMessage(createRequestError(400, "missing classId"), "fallback"),
    "请先选择班级后再保存课程大纲。"
  );
  assert.equal(
    getCourseSaveRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不可用，请刷新班级列表后重新选择。"
  );
  assert.equal(isMissingCourseClassError(createRequestError(404, "not found")), true);
});

test("course helpers keep selected class only when it still exists", () => {
  const classes = [
    { id: "class-1", name: "一班", subject: "math", grade: "4" },
    { id: "class-2", name: "二班", subject: "chinese", grade: "4" }
  ];

  assert.equal(resolveCourseClassId(classes, "class-2"), "class-2");
  assert.equal(resolveCourseClassId(classes, "missing-class"), "class-1");
  assert.equal(resolveCourseClassId([], "class-2"), "");
});

test("course helpers normalize syllabus defaults and remove stale class selection deterministically", () => {
  const classes = [
    { id: "class-1", name: "一班", subject: "math", grade: "4" },
    { id: "class-2", name: "二班", subject: "chinese", grade: "4" },
    { id: "class-3", name: "三班", subject: "english", grade: "4" }
  ];

  assert.deepEqual(normalizeSyllabus(null), {
    summary: "",
    objectives: "",
    gradingPolicy: "",
    scheduleText: "",
    updatedAt: undefined
  });
  assert.deepEqual(
    normalizeSyllabus({ summary: "概览", objectives: undefined as unknown as string, gradingPolicy: "", scheduleText: "周计划" }),
    {
      summary: "概览",
      objectives: "",
      gradingPolicy: "",
      scheduleText: "周计划",
      updatedAt: undefined
    }
  );
  assert.deepEqual(resolveCourseStateAfterMissingClass(classes, "class-2", "class-2"), {
    nextClasses: [classes[0], classes[2]],
    nextClassId: "class-1"
  });
  assert.deepEqual(resolveCourseStateAfterMissingClass(classes, "class-2", "class-3"), {
    nextClasses: [classes[0], classes[2]],
    nextClassId: "class-3"
  });
});

test("course helpers format submission type labels", () => {
  assert.equal(formatSubmissionType("essay"), "作文");
  assert.equal(formatSubmissionType("upload"), "上传");
  assert.equal(formatSubmissionType("quiz"), "在线作业");
});

test("course helpers expose fresh no-store request init for dynamic page bootstrap", () => {
  const first = getCourseNoStoreRequestInit();
  const second = getCourseNoStoreRequestInit();

  assert.notEqual(first, second);
  assert.deepEqual(first, { cache: "no-store" });
  assert.deepEqual(second, { cache: "no-store" });
});
