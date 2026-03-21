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
  if (request === "@/lib/seat-plan-utils") {
    return path.resolve(__dirname, "../../lib/seat-plan-utils.js");
  }
  if (request === "@/lib/student-persona-options") {
    return path.resolve(__dirname, "../../lib/student-persona-options.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getTeacherSeatingDerivedState,
  getTeacherSeatingRequestMessage,
  isMissingTeacherSeatingClassError,
  pruneTeacherSeatingLockedSeatIds,
  removeTeacherSeatingClassSnapshot,
  resolveTeacherSeatingClassId,
  toggleTeacherSeatingLockedSeatIds,
  updateTeacherSeatingPlanLayout,
  updateTeacherSeatingSeatAssignment
} = require("../../app/teacher/seating/utils") as typeof import("../../app/teacher/seating/utils");
Module._resolveFilename = originalResolveFilename;

type TeacherSeatingStudent = import("../../app/teacher/seating/types").TeacherSeatingStudent;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("getTeacherSeatingRequestMessage maps teacher seating business errors", () => {
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "duplicate locked seat student"), "fallback"),
    "同一名学生不能被分配到多个座位。"
  );
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "body.rows must be <= 12"), "fallback"),
    "排座行列数需在 1 到 12 之间。"
  );
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "locked seat position out of range"), "fallback"),
    "座位位置超出当前排座网格，请重新调整。"
  );
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "body.lockedSeats[0].studentId cannot be empty"), "fallback"),
    "锁定座位时必须保留学生信息。"
  );
});

test("teacher seating helpers distinguish auth expiry from missing class", () => {
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续配置学期排座。"
  );
  assert.equal(isMissingTeacherSeatingClassError(createRequestError(404, "class not found")), true);
  assert.equal(isMissingTeacherSeatingClassError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherSeatingClassError(createRequestError(400, "duplicate seat position")), false);
});

test("teacher seating helpers resolve next class after stale selection", () => {
  assert.equal(
    resolveTeacherSeatingClassId("class-b", [{ id: "class-a" }, { id: "class-b" }]),
    "class-b"
  );
  assert.equal(
    resolveTeacherSeatingClassId("missing", [{ id: "class-a" }, { id: "class-b" }]),
    "class-a"
  );
  assert.deepEqual(
    removeTeacherSeatingClassSnapshot(
      [{ id: "class-a" }, { id: "class-b" }],
      "class-a"
    ),
    {
      classes: [{ id: "class-b" }],
      classId: "class-b"
    }
  );
});

test("teacher seating helpers prune locked seats that no longer hold a student", () => {
  assert.deepEqual(pruneTeacherSeatingLockedSeatIds(["seat-1"], null), []);
  assert.deepEqual(
    pruneTeacherSeatingLockedSeatIds(["seat-1", "seat-2", "seat-3"], {
      seats: [
        { seatId: "seat-1", row: 1, column: 1, studentId: "student-1" },
        { seatId: "seat-2", row: 1, column: 2 },
        { seatId: "seat-4", row: 1, column: 3, studentId: "student-4" }
      ]
    }),
    ["seat-1"]
  );
});

test("teacher seating helpers derive draft overview and follow-up state deterministically", () => {
  const studentA: TeacherSeatingStudent = {
    id: "student-a",
    name: "Alice",
    email: "alice@example.com",
    preferredName: "小艾",
    gender: "female",
    eyesightLevel: "front_preferred",
    focusSupport: "self_driven",
    completed: 2,
    pending: 0,
    overdue: 0,
    late: 0,
    avgScore: 92,
    placementScore: 90,
    scoreSource: "quiz",
    performanceBand: "high",
    profileCompleteness: 98,
    missingProfileFields: [],
    tags: []
  };
  const studentB: TeacherSeatingStudent = {
    id: "student-b",
    name: "Bob",
    email: "bob@example.com",
    gender: "male",
    focusSupport: "needs_focus",
    completed: 1,
    pending: 1,
    overdue: 0,
    late: 0,
    avgScore: 75,
    placementScore: 72,
    scoreSource: "quiz",
    performanceBand: "medium",
    profileCompleteness: 65,
    missingProfileFields: ["身高"],
    tags: []
  };
  const studentC: TeacherSeatingStudent = {
    id: "student-c",
    name: "Cara",
    email: "cara@example.com",
    gender: "female",
    completed: 0,
    pending: 2,
    overdue: 1,
    late: 1,
    avgScore: 58,
    placementScore: 55,
    scoreSource: "completion",
    performanceBand: "low",
    profileCompleteness: 82,
    missingProfileFields: [],
    tags: []
  };

  const derived = getTeacherSeatingDerivedState({
    classes: [{ id: "class-a", name: "四年级一班", subject: "math", grade: "4" }],
    classId: "class-a",
    students: [studentA, studentB, studentC],
    draftPlan: {
      id: "plan-1",
      classId: "class-a",
      teacherId: "teacher-1",
      rows: 2,
      columns: 2,
      generatedBy: "manual",
      createdAt: "2026-03-19T00:00:00.000Z",
      updatedAt: "2026-03-19T00:00:00.000Z",
      seats: [
        { seatId: "seat-1", row: 1, column: 1, studentId: "student-a" },
        { seatId: "seat-2", row: 1, column: 2, studentId: "student-b" },
        { seatId: "seat-3", row: 2, column: 1 }
      ]
    },
    savedPlan: {
      id: "plan-0",
      classId: "class-a",
      teacherId: "teacher-1",
      rows: 2,
      columns: 2,
      generatedBy: "ai",
      createdAt: "2026-03-18T00:00:00.000Z",
      updatedAt: "2026-03-18T00:00:00.000Z",
      seats: []
    },
    preview: {
      plan: {
        id: "preview-1",
        classId: "class-a",
        teacherId: "teacher-1",
        rows: 2,
        columns: 2,
        generatedBy: "ai",
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
        seats: []
      },
      summary: {
        studentCount: 3,
        seatCapacity: 4,
        assignedCount: 3,
        unassignedCount: 0,
        occupancyRate: 75,
        frontPriorityStudentCount: 1,
        frontPrioritySatisfiedCount: 1,
        focusPriorityStudentCount: 1,
        focusPrioritySatisfiedCount: 1,
        scoreComplementPairCount: 1,
        mixedGenderPairCount: 1,
        lowCompletenessCount: 1,
        inferredScoreCount: 1,
        lockedSeatCount: 1
      },
      warnings: ["前排容量有限"],
      insights: ["建议优先补齐画像"]
    },
    lockedSeatIds: ["seat-1", "seat-3"]
  });

  assert.equal(derived.classLabel, "四年级一班");
  assert.deepEqual(derived.lockedSeats.map((seat) => seat.seatId), ["seat-1"]);
  assert.equal(derived.draftSummary?.assignedCount, 2);
  assert.equal(derived.draftSummary?.unassignedCount, 1);
  assert.equal(derived.draftSummary?.lockedSeatCount, 1);
  assert.deepEqual(derived.unassignedStudents.map((student) => student.id), ["student-c"]);
  assert.deepEqual(
    derived.studentsNeedingProfileReminder.map((student) => student.id),
    ["student-b"]
  );
  assert.deepEqual(
    derived.watchStudents.map((student) => student.id),
    ["student-b", "student-a"]
  );
  assert.match(derived.followUpChecklist, /班级：四年级一班/);
  assert.match(derived.followUpChecklist, /资料待补：1 人/);
  assert.deepEqual(derived.previewWarnings, ["前排容量有限"]);
  assert.deepEqual(derived.previewInsights, ["建议优先补齐画像"]);
  assert.equal(derived.semesterStatus, "建议重排");
  assert.equal(derived.semesterStatusTone, "#b54708");
  assert.equal(derived.frontRowCount, 1);
  assert.ok(derived.semesterReplanReasons.includes("仍有 1 名学生未分配座位"));
  assert.ok(derived.semesterReplanReasons.includes("当前有一份未应用的学期预览"));
});

test("teacher seating helpers update locked seats and local seat plan edits safely", () => {
  assert.deepEqual(
    toggleTeacherSeatingLockedSeatIds(["seat-1"], "seat-2"),
    ["seat-1", "seat-2"]
  );
  assert.deepEqual(toggleTeacherSeatingLockedSeatIds(["seat-1"], "seat-1"), []);

  const basePlan = {
    id: "plan-1",
    classId: "class-a",
    teacherId: "teacher-1",
    rows: 2,
    columns: 2,
    generatedBy: "ai" as const,
    createdAt: "2026-03-19T00:00:00.000Z",
    updatedAt: "2026-03-19T00:00:00.000Z",
    seats: [
      { seatId: "seat-1", row: 1, column: 1, studentId: "student-a" },
      { seatId: "seat-2", row: 1, column: 2 },
      { seatId: "seat-3", row: 2, column: 1, studentId: "student-b" },
      { seatId: "seat-4", row: 2, column: 2 }
    ]
  };

  const resized = updateTeacherSeatingPlanLayout(
    basePlan,
    3,
    2,
    "2026-03-19T01:00:00.000Z"
  );
  assert.equal(resized?.rows, 3);
  assert.equal(resized?.columns, 2);
  assert.equal(resized?.seats.length, 6);
  assert.equal(resized?.updatedAt, "2026-03-19T01:00:00.000Z");

  const reassigned = updateTeacherSeatingSeatAssignment(
    basePlan,
    "seat-2",
    "student-b",
    "2026-03-19T02:00:00.000Z"
  );
  assert.equal(reassigned?.generatedBy, "manual");
  assert.equal(reassigned?.updatedAt, "2026-03-19T02:00:00.000Z");
  assert.equal(
    reassigned?.seats.find((seat) => seat.seatId === "seat-2")?.studentId,
    "student-b"
  );
  assert.equal(
    reassigned?.seats.find((seat) => seat.seatId === "seat-3")?.studentId,
    undefined
  );
});
