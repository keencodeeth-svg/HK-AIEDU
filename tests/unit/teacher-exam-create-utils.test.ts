import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { FormState } from "../../app/teacher/exams/create/types";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/constants") {
    return path.resolve(__dirname, "../../lib/constants.js");
  }
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  buildTeacherExamCreateScopeLabel,
  buildTeacherExamCreateSubmitPayload,
  buildTeacherExamCreateSuccessMessage,
  buildTeacherExamCreateTargetLabel,
  getTeacherExamCreatePageDerivedState,
  getTeacherExamCreateCanSubmit,
  getTeacherExamCreateRequestMessage,
  getTeacherExamCreateTargetCount,
  isTeacherExamCreateClassMissingError,
  pruneTeacherExamCreateStudentIds,
  syncTeacherExamCreateFormWithConfig
} = require("../../app/teacher/exams/create/utils") as typeof import("../../app/teacher/exams/create/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher exam create helpers map auth, missing-class, and validation errors", () => {
  assert.equal(
    getTeacherExamCreateRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续发布考试。"
  );
  assert.equal(
    getTeacherExamCreateRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的发布权限。"
  );
  assert.equal(
    getTeacherExamCreateRequestMessage(
      createRequestError(400, "studentids required when publishmode is targeted"),
      "fallback"
    ),
    "定向发布至少需要选择 1 名学生。"
  );
  assert.equal(isTeacherExamCreateClassMissingError(createRequestError(404, "not found")), true);
  assert.equal(
    isTeacherExamCreateClassMissingError(createRequestError(400, "invalid datetime format")),
    false
  );
});

test("teacher exam create helpers sync class and knowledge-point config safely", () => {
  const prev: FormState = {
    classId: "class-a",
    title: "  周测一  ",
    description: "",
    publishMode: "targeted",
    antiCheatLevel: "basic",
    studentIds: ["stu-1", "stu-2"],
    startAt: "",
    endAt: "2026-03-26T18:00",
    durationMinutes: 60,
    questionCount: 10,
    knowledgePointId: "kp-a",
    difficulty: "medium",
    questionType: "choice",
    includeIsolated: false
  };

  assert.deepEqual(
    syncTeacherExamCreateFormWithConfig(
      prev,
      [{ id: "class-a", name: "四年级一班", subject: "math", grade: "4" }],
      [{ id: "kp-a", subject: "math", grade: "4", title: "分数乘法", chapter: "第三章" }]
    ),
    {
      nextClassId: "class-a",
      nextForm: {
        ...prev,
        classId: "class-a",
        knowledgePointId: "kp-a",
        studentIds: ["stu-1", "stu-2"],
        endAt: "2026-03-26T18:00"
      }
    }
  );

  const synced = syncTeacherExamCreateFormWithConfig(
    prev,
    [{ id: "class-b", name: "四年级二班", subject: "english", grade: "4" }],
    [{ id: "kp-a", subject: "math", grade: "4", title: "分数乘法", chapter: "第三章" }]
  );

  assert.equal(synced.nextClassId, "class-b");
  assert.equal(synced.nextForm.classId, "class-b");
  assert.equal(synced.nextForm.knowledgePointId, "");
  assert.deepEqual(synced.nextForm.studentIds, []);
});

test("teacher exam create helpers prune stale students and derive labels deterministically", () => {
  assert.deepEqual(
    pruneTeacherExamCreateStudentIds(
      ["stu-1", "stu-2", "stu-3"],
      [{ id: "stu-2" }, { id: "stu-3" }]
    ),
    ["stu-2", "stu-3"]
  );

  const targetCount = getTeacherExamCreateTargetCount("targeted", 2, 5);
  assert.equal(targetCount, 2);
  assert.equal(buildTeacherExamCreateTargetLabel("targeted", targetCount, 5), "定向 2/5 人");
  assert.equal(
    buildTeacherExamCreateScopeLabel(
      { id: "kp-a", subject: "math", grade: "4", title: "分数乘法", chapter: "第三章" },
      "math",
      12
    ),
    "第三章 · 分数乘法 · 12 题"
  );
  assert.equal(
    buildTeacherExamCreateScopeLabel(null, "english", 10),
    "英语全范围 · 10 题"
  );
  assert.equal(
    getTeacherExamCreateCanSubmit({
      classId: "class-a",
      title: "周测一",
      publishMode: "targeted",
      scheduleReady: true,
      configLoading: false,
      saving: false,
      targetCount: 2,
      studentsLoading: false
    }),
    true
  );
  assert.equal(
    getTeacherExamCreateCanSubmit({
      classId: "class-a",
      title: "周测一",
      publishMode: "targeted",
      scheduleReady: true,
      configLoading: false,
      saving: false,
      targetCount: 0,
      studentsLoading: true
    }),
    false
  );
});

test("teacher exam create helpers normalize submit payloads and warning messages", () => {
  const payload = buildTeacherExamCreateSubmitPayload({
    classId: "class-a",
    title: "  周测一  ",
    description: "  随堂检测  ",
    publishMode: "targeted",
    antiCheatLevel: "basic",
    studentIds: ["stu-1"],
    startAt: "",
    endAt: "2026-03-26T18:00",
    durationMinutes: 0,
    questionCount: 12,
    knowledgePointId: "",
    difficulty: "hard",
    questionType: "fill",
    includeIsolated: true
  });

  assert.deepEqual(payload, {
    classId: "class-a",
    title: "周测一",
    description: "随堂检测",
    publishMode: "targeted",
    antiCheatLevel: "basic",
    studentIds: ["stu-1"],
    startAt: undefined,
    endAt: "2026-03-26T18:00",
    durationMinutes: undefined,
    questionCount: 12,
    knowledgePointId: undefined,
    difficulty: "hard",
    questionType: "fill",
    includeIsolated: true
  });

  assert.equal(
    buildTeacherExamCreateSuccessMessage("考试发布成功", ["题库已自动放宽", "", "已排除隔离题"]),
    "考试发布成功 题库已自动放宽；已排除隔离题"
  );
  assert.equal(buildTeacherExamCreateSuccessMessage(undefined, undefined), "考试发布成功");
});

test("teacher exam create helpers derive page state consistently", () => {
  const derived = getTeacherExamCreatePageDerivedState({
    classes: [
      { id: "class-a", name: "四年级一班", subject: "math", grade: "4" },
      { id: "class-b", name: "四年级二班", subject: "english", grade: "4" }
    ],
    knowledgePoints: [
      { id: "kp-a", subject: "math", grade: "4", title: "分数乘法", chapter: "第三章" },
      { id: "kp-b", subject: "math", grade: "5", title: "小数除法", chapter: "第四章" }
    ],
    classStudents: [
      { id: "stu-1", name: "李明", email: "li@example.com" },
      { id: "stu-2", name: "王芳", email: "wang@example.com" }
    ],
    form: {
      classId: "class-a",
      title: "周测一",
      description: "",
      publishMode: "targeted",
      antiCheatLevel: "basic",
      studentIds: ["stu-1"],
      startAt: "",
      endAt: "2999-03-26T18:00",
      durationMinutes: 60,
      questionCount: 12,
      knowledgePointId: "kp-a",
      difficulty: "medium",
      questionType: "choice",
      includeIsolated: false
    },
    configLoading: false,
    saving: false,
    studentsLoading: false,
    lastLoadedAt: null
  });

  assert.equal(derived.selectedClass?.id, "class-a");
  assert.deepEqual(derived.filteredPoints, [
    { id: "kp-a", subject: "math", grade: "4", title: "分数乘法", chapter: "第三章" }
  ]);
  assert.equal(derived.selectedPoint?.id, "kp-a");
  assert.equal(derived.targetCount, 1);
  assert.equal(derived.canSubmit, true);
  assert.equal(derived.classLabel, "四年级一班 · 数学 · 四年级");
  assert.equal(derived.scopeLabel, "第三章 · 分数乘法 · 12 题");
  assert.equal(derived.targetLabel, "定向 1/2 人");
  assert.equal(derived.lastLoadedAtLabel, "");
});
