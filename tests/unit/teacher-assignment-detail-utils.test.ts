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
  appendTeacherAssignmentRubricItem,
  appendTeacherAssignmentRubricLevel,
  buildTeacherAssignmentNotifyPreviewStudents,
  filterTeacherAssignmentStudents,
  getTeacherAssignmentDetailDerivedState,
  getTeacherAssignmentStudentPriorityRank,
  getTeacherAssignmentDetailRequestMessage,
  isMissingTeacherAssignmentDetailError,
  patchTeacherAssignmentRubricItem,
  patchTeacherAssignmentRubricLevel,
  removeTeacherAssignmentRubricItem,
  removeTeacherAssignmentRubricLevel
} = require("../../app/teacher/assignments/[id]/utils") as typeof import("../../app/teacher/assignments/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher assignment detail helpers map auth and rubric validation errors", () => {
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看作业。"
  );
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(400, "missing items"), "fallback"),
    "请至少保留一个评分维度后再保存评分细则。"
  );
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(400, "body.items[0].title cannot be empty"), "fallback"),
    "评分维度标题不能为空。"
  );
  assert.equal(
    getTeacherAssignmentDetailRequestMessage(createRequestError(400, "body.items[0].levels[0].score must be a number"), "fallback"),
    "评分档位分值格式不正确，请重新填写。"
  );

  const students = [
    { id: "s-1", name: "陈明", email: "chen@example.com", grade: "四年级", status: "pending", score: null, total: null, completedAt: null },
    { id: "s-2", name: "王芳", email: "wang@example.com", grade: "四年级", status: "completed", score: null, total: null, completedAt: "2026-03-19T10:00:00.000Z" },
    { id: "s-3", name: "李雷", email: "li@example.com", grade: "四年级", status: "completed", score: 5, total: 10, completedAt: "2026-03-19T09:00:00.000Z" },
    { id: "s-4", name: "赵云", email: "zhao@example.com", grade: "四年级", status: "completed", score: 9, total: 10, completedAt: "2026-03-19T08:00:00.000Z" }
  ];

  assert.deepEqual(
    buildTeacherAssignmentNotifyPreviewStudents(students, "missing", 60).map((student) => student.id),
    ["s-1"]
  );
  assert.deepEqual(
    buildTeacherAssignmentNotifyPreviewStudents(students, "low_score", 60).map((student) => student.id),
    ["s-3"]
  );
  assert.deepEqual(
    filterTeacherAssignmentStudents(students, "all", "", true).map((student) => student.id),
    ["s-1", "s-2", "s-3", "s-4"]
  );
  assert.deepEqual(
    filterTeacherAssignmentStudents(students, "completed", "wang", false).map((student) => student.id),
    ["s-2"]
  );
  assert.equal(getTeacherAssignmentStudentPriorityRank(students[0], true), 0);
  assert.equal(getTeacherAssignmentStudentPriorityRank(students[1], false), 2);
  assert.equal(getTeacherAssignmentStudentPriorityRank(students[2], false), 3);
  assert.equal(getTeacherAssignmentStudentPriorityRank(students[3], false), 4);
});

test("teacher assignment detail helpers detect stale assignment access", () => {
  const missingError = createRequestError(404, "not found");

  assert.equal(
    getTeacherAssignmentDetailRequestMessage(missingError, "fallback"),
    "作业不存在，或当前教师账号无权查看该作业。"
  );
  assert.equal(isMissingTeacherAssignmentDetailError(missingError), true);
  assert.equal(isMissingTeacherAssignmentDetailError(createRequestError(400, "missing items")), false);

  const rubricItems = [
    {
      title: "表达",
      description: "结构清晰",
      maxScore: 10,
      weight: 1,
      levels: [
        { label: "优秀", score: 10, description: "完整" },
        { label: "良好", score: 8, description: "基本完整" }
      ]
    }
  ];

  const patched = patchTeacherAssignmentRubricItem(rubricItems, 0, { title: "表达与结构", maxScore: 12 });
  assert.equal(patched[0]?.title, "表达与结构");
  assert.equal(patched[0]?.maxScore, 12);

  const patchedLevel = patchTeacherAssignmentRubricLevel(patched, 0, 1, { score: 7, description: "仍需补充" });
  assert.equal(patchedLevel[0]?.levels[1]?.score, 7);
  assert.equal(patchedLevel[0]?.levels[1]?.description, "仍需补充");

  const withNewLevel = appendTeacherAssignmentRubricLevel(patchedLevel, 0);
  assert.equal(withNewLevel[0]?.levels.length, 3);
  assert.equal(withNewLevel[0]?.levels[2]?.score, 12);

  const withoutLevel = removeTeacherAssignmentRubricLevel(withNewLevel, 0, 0);
  assert.equal(withoutLevel[0]?.levels.length, 2);
  assert.equal(withoutLevel[0]?.levels[0]?.label, "良好");

  const withNewRubric = appendTeacherAssignmentRubricItem(withoutLevel);
  assert.equal(withNewRubric.length, 2);
  assert.equal(withNewRubric[1]?.title, "评分维度");

  const withoutRubric = removeTeacherAssignmentRubricItem(withNewRubric, 0);
  assert.equal(withoutRubric.length, 1);
  assert.equal(withoutRubric[0]?.title, "评分维度");
});

test("teacher assignment detail helpers derive page state for notify and roster flows", () => {
  const derived = getTeacherAssignmentDetailDerivedState({
    data: {
      assignment: {
        id: "assignment-1",
        title: "分数训练",
        dueDate: "2026-03-18T08:00:00.000Z",
        createdAt: "2026-03-17T08:00:00.000Z",
        submissionType: "quiz"
      },
      class: {
        id: "class-1",
        name: "四年级一班",
        subject: "math",
        grade: "4"
      },
      students: [
        {
          id: "s-1",
          name: "陈明",
          email: "chen@example.com",
          grade: "四年级",
          status: "pending",
          score: null,
          total: null,
          completedAt: null
        },
        {
          id: "s-2",
          name: "王芳",
          email: "wang@example.com",
          grade: "四年级",
          status: "completed",
          score: null,
          total: null,
          completedAt: "2026-03-19T10:00:00.000Z"
        },
        {
          id: "s-3",
          name: "李雷",
          email: "li@example.com",
          grade: "四年级",
          status: "completed",
          score: 5,
          total: 10,
          completedAt: "2026-03-19T09:00:00.000Z"
        },
        {
          id: "s-4",
          name: "赵云",
          email: "zhao@example.com",
          grade: "四年级",
          status: "completed",
          score: 9,
          total: 10,
          completedAt: "2026-03-19T08:00:00.000Z"
        }
      ]
    },
    notifyTarget: "low_score",
    threshold: 60,
    studentFilter: "review",
    studentKeyword: "wang",
    now: new Date("2026-03-20T08:00:00.000Z").getTime()
  });

  assert.equal(derived.assignmentOverdue, true);
  assert.equal(derived.completedStudents.length, 3);
  assert.equal(derived.pendingStudents.length, 1);
  assert.equal(derived.reviewReadyStudents.length, 1);
  assert.equal(derived.scoredStudents.length, 2);
  assert.equal(derived.lowScoreStudents.length, 1);
  assert.equal(derived.latestCompletedStudent?.id, "s-2");
  assert.equal(derived.completionRate, 75);
  assert.equal(derived.averagePercent, 70);
  assert.deepEqual(derived.notifyPreviewStudents.map((student) => student.id), ["s-3"]);
  assert.equal(derived.hasStudentFilters, true);
  assert.deepEqual(derived.filteredStudents.map((student) => student.id), ["s-2"]);

  const emptyDerived = getTeacherAssignmentDetailDerivedState({
    data: null,
    notifyTarget: "all",
    threshold: 60,
    studentFilter: "all",
    studentKeyword: "",
    now: Date.now()
  });

  assert.equal(emptyDerived.assignmentOverdue, false);
  assert.equal(emptyDerived.completionRate, 0);
  assert.equal(emptyDerived.averagePercent, null);
  assert.equal(emptyDerived.hasStudentFilters, false);
  assert.deepEqual(emptyDerived.filteredStudents, []);
});
