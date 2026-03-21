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
  buildTeacherDashboardDefaultDueDate,
  getTeacherDashboardDerivedState,
  getTeacherDashboardAlertRequestMessage,
  getTeacherDashboardClassRequestMessage,
  getTeacherDashboardJoinRequestMessage,
  incrementTeacherDashboardAssignmentCount,
  incrementTeacherDashboardStudentCount,
  isMissingTeacherDashboardAlertError,
  isMissingTeacherDashboardClassError,
  isMissingTeacherDashboardJoinRequestError,
  isTeacherDashboardModuleMissingError,
  prependTeacherDashboardAssignment,
  prependTeacherDashboardClass,
  removeTeacherDashboardAlertImpact,
  removeTeacherDashboardClassSnapshot,
  removeTeacherDashboardJoinRequest,
  updateTeacherDashboardClassJoinCode,
  updateTeacherDashboardClassJoinMode
} = require("../../app/teacher/dashboard-utils") as typeof import("../../app/teacher/dashboard-utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher dashboard class helpers map business errors", () => {
  assert.equal(
    getTeacherDashboardClassRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的操作权限。"
  );
  assert.equal(
    getTeacherDashboardClassRequestMessage(createRequestError(404, "student not found"), "fallback"),
    "未找到该学生账号，请确认学生邮箱是否正确。"
  );
  assert.equal(
    getTeacherDashboardClassRequestMessage(createRequestError(400, "module not found"), "fallback"),
    "所选课程模块不存在，或已不属于当前班级。"
  );
  assert.equal(isMissingTeacherDashboardClassError(createRequestError(404, "not found")), true);
  assert.equal(isTeacherDashboardModuleMissingError(createRequestError(400, "module not found")), true);
});

test("teacher dashboard alert and join request helpers distinguish stale entities", () => {
  assert.equal(
    getTeacherDashboardAlertRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该预警已不存在，列表将按最新状态刷新。"
  );
  assert.equal(
    getTeacherDashboardJoinRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该加入班级申请已不存在，列表将按最新状态刷新。"
  );
  assert.equal(isMissingTeacherDashboardAlertError(createRequestError(400, "invalid alert id")), true);
  assert.equal(isMissingTeacherDashboardJoinRequestError(createRequestError(404, "not found")), true);
});

test("teacher dashboard optimistic helpers build class and assignment snapshots", () => {
  const nextClasses = prependTeacherDashboardClass(
    [
      {
        id: "class-existing",
        name: "旧班级",
        subject: "english",
        grade: "5",
        studentCount: 12,
        assignmentCount: 4,
        joinMode: "auto"
      }
    ],
    {
      id: "class-new",
      name: "四年级数学A班",
      joinCode: "JOIN123"
    },
    { name: "四年级数学A班", subject: "math", grade: "4" }
  );

  assert.equal(buildTeacherDashboardDefaultDueDate(0), "1970-01-08");
  assert.deepEqual(nextClasses[0], {
    id: "class-new",
    name: "四年级数学A班",
    subject: "math",
    grade: "4",
    studentCount: 0,
    assignmentCount: 0,
    joinCode: "JOIN123",
    joinMode: "approval"
  });

  const nextAssignments = prependTeacherDashboardAssignment(
    [],
    { id: "assignment-1" },
    {
      id: "class-new",
      name: "四年级数学A班",
      subject: "math",
      grade: "4",
      studentCount: 28,
      assignmentCount: 0
    },
    {
      classId: "class-new",
      moduleId: "module-1",
      title: "分数基础练习",
      description: "章节复习",
      dueDate: "2026-03-26",
      questionCount: 12,
      knowledgePointId: "",
      mode: "bank",
      difficulty: "medium",
      questionType: "choice",
      submissionType: "quiz",
      maxUploads: 3,
      gradingFocus: ""
    },
    { title: "分数初步认识" }
  );

  assert.deepEqual(nextAssignments[0], {
    id: "assignment-1",
    classId: "class-new",
    className: "四年级数学A班",
    classSubject: "math",
    classGrade: "4",
    moduleTitle: "分数初步认识",
    title: "分数基础练习",
    dueDate: "2026-03-26",
    total: 28,
    completed: 0,
    submissionType: "quiz"
  });
});

test("teacher dashboard list helpers update counters and join settings", () => {
  const classes = [
    {
      id: "class-1",
      name: "四年级数学A班",
      subject: "math",
      grade: "4",
      studentCount: 20,
      assignmentCount: 2,
      joinCode: "JOIN123",
      joinMode: "approval" as const
    }
  ];

  assert.equal(
    incrementTeacherDashboardStudentCount(classes, "class-1")[0]?.studentCount,
    21
  );
  assert.equal(
    incrementTeacherDashboardAssignmentCount(classes, "class-1")[0]?.assignmentCount,
    3
  );
  assert.equal(
    updateTeacherDashboardClassJoinMode(classes, "class-1", "auto")[0]?.joinMode,
    "auto"
  );
  assert.equal(
    updateTeacherDashboardClassJoinCode(classes, "class-1", "JOIN456")[0]?.joinCode,
    "JOIN456"
  );
});

test("teacher dashboard removal helpers clear stale snapshots deterministically", () => {
  const classRemoval = removeTeacherDashboardClassSnapshot(
    [
      {
        id: "class-1",
        name: "四年级数学A班",
        subject: "math",
        grade: "4",
        studentCount: 20,
        assignmentCount: 2
      },
      {
        id: "class-2",
        name: "四年级数学B班",
        subject: "math",
        grade: "4",
        studentCount: 18,
        assignmentCount: 1
      }
    ],
    "class-1"
  );
  const impactMap = {
    "alert-1": {
      alertId: "alert-1",
      impact: {
        tracked: true,
        trackedAt: "2026-03-19T00:00:00.000Z",
        elapsedHours: 24,
        deltas: { riskScore: -3 },
        windows: {
          h24: { ready: true, remainingHours: 0, riskDelta: -3 },
          h72: { ready: false, remainingHours: 48, riskDelta: null }
        }
      }
    }
  };

  assert.deepEqual(classRemoval, {
    classes: [
      {
        id: "class-2",
        name: "四年级数学B班",
        subject: "math",
        grade: "4",
        studentCount: 18,
        assignmentCount: 1
      }
    ],
    nextClassId: "class-2"
  });
  assert.deepEqual(
    removeTeacherDashboardJoinRequest(
      [
        {
          id: "join-1",
          classId: "class-1",
          studentId: "student-1",
          status: "pending",
          createdAt: "2026-03-19T00:00:00.000Z",
          className: "四年级数学A班",
          subject: "math",
          grade: "4",
          studentName: "学生甲",
          studentEmail: "student@example.com"
        }
      ],
      "join-1"
    ),
    []
  );
  assert.deepEqual(removeTeacherDashboardAlertImpact(impactMap, "alert-1"), {});
  assert.equal(removeTeacherDashboardAlertImpact(impactMap, "missing"), impactMap);
});

test("teacher dashboard derived helpers compute filtered points and overview counters deterministically", () => {
  const derived = getTeacherDashboardDerivedState({
    classes: [
      {
        id: "class-1",
        name: "四年级数学A班",
        subject: "math",
        grade: "4",
        studentCount: 20,
        assignmentCount: 0,
        joinMode: "approval"
      },
      {
        id: "class-2",
        name: "四年级语文A班",
        subject: "chinese",
        grade: "4",
        studentCount: 0,
        assignmentCount: 1,
        joinMode: "auto"
      }
    ],
    assignments: [
      {
        id: "assignment-1",
        classId: "class-1",
        className: "四年级数学A班",
        classSubject: "math",
        classGrade: "4",
        moduleTitle: "分数初步认识",
        title: "分数基础练习",
        dueDate: "2026-03-20T12:00:00.000Z",
        total: 20,
        completed: 8,
        submissionType: "quiz"
      },
      {
        id: "assignment-2",
        classId: "class-2",
        className: "四年级语文A班",
        classSubject: "chinese",
        classGrade: "4",
        moduleTitle: "古诗文",
        title: "背诵打卡",
        dueDate: "2026-03-25T12:00:00.000Z",
        total: 10,
        completed: 10,
        submissionType: "upload"
      }
    ],
    knowledgePoints: [
      { id: "kp-1", subject: "math", grade: "4", title: "分数", chapter: "第一章" },
      { id: "kp-2", subject: "math", grade: "5", title: "小数", chapter: "第二章" },
      { id: "kp-3", subject: "chinese", grade: "4", title: "古诗", chapter: "第三章" }
    ],
    assignmentClassId: "class-1",
    insights: {
      summary: {
        classes: 2,
        students: 20,
        assignments: 2,
        completionRate: 0.8,
        accuracy: 0.75,
        classRiskScore: 52,
        activeAlerts: 1,
        highRiskAlerts: 0,
        parentCollaboration: {
          totalParentCount: 20,
          activeParentCount7d: 10,
          coveredStudentCount: 18,
          receiptCount: 12,
          doneMinutes: 120,
          doneRate: 0.6,
          last7dDoneRate: 0.55,
          avgEffectScore: 0.7,
          sourceDoneRate: {
            weeklyReport: 0.6,
            assignmentPlan: 0.5
          }
        }
      },
      weakPoints: [],
      riskClasses: [],
      riskStudents: [],
      riskKnowledgePoints: [],
      alerts: [
        {
          id: "alert-1",
          type: "student-risk",
          classId: "class-1",
          className: "四年级数学A班",
          subject: "math",
          grade: "4",
          riskScore: 60,
          riskReason: "完成率偏低",
          recommendedAction: "安排复习",
          status: "active"
        },
        {
          id: "alert-2",
          type: "knowledge-risk",
          classId: "class-2",
          className: "四年级语文A班",
          subject: "chinese",
          grade: "4",
          riskScore: 40,
          riskReason: "波动",
          recommendedAction: "观察",
          status: "acknowledged"
        }
      ]
    },
    joinRequests: [
      {
        id: "join-1",
        classId: "class-1",
        studentId: "student-1",
        status: "pending",
        createdAt: "2026-03-19T00:00:00.000Z",
        className: "四年级数学A班",
        subject: "math",
        grade: "4",
        studentName: "学生甲",
        studentEmail: "student@example.com"
      }
    ],
    now: new Date("2026-03-19T12:00:00.000Z").getTime()
  });

  assert.deepEqual(derived.filteredPoints.map((item) => item.id), ["kp-1"]);
  assert.equal(derived.pendingJoinCount, 1);
  assert.equal(derived.activeAlertCount, 1);
  assert.equal(derived.classesMissingAssignmentsCount, 1);
  assert.equal(derived.dueSoonAssignmentCount, 1);
  assert.equal(derived.hasDashboardData, true);
});
