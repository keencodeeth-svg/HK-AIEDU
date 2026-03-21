import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import type { PlanItem, TodayTaskPayload } from "../../app/student/types";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  if (request === "@/lib/tutor-launch") {
    return path.resolve(__dirname, "../../lib/tutor-launch.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getStudentDashboardJoinRequestMessage,
  getStudentDashboardRequestMessage,
  isMissingStudentDashboardClassError
} = require("../../app/student/dashboard-utils") as typeof import("../../app/student/dashboard-utils");
const {
  buildStudentDashboardTaskExposureProps,
  buildStudentDashboardTopTodayTasks,
  buildStudentDashboardVisiblePriorityTasks,
  countStudentDashboardPendingJoinRequests,
  extractStudentDashboardMotivation,
  extractStudentDashboardPlanItems,
  extractStudentDashboardRadarSnapshot,
  getStudentDashboardDerivedState,
  getStudentDashboardCategoryCounts,
  getStudentDashboardEntriesByCategory,
  getStudentDashboardHiddenTodayTaskCount,
  getStudentDashboardJoinSuccessMessage,
  getStudentDashboardRecommendedTask,
  getStudentDashboardTotalPlanCount,
  getStudentDashboardVisibleEntries,
  getStudentDashboardWeakPlanCount,
  hasStudentDashboardData
} = require("../../app/student/utils") as typeof import("../../app/student/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student dashboard helpers map auth and stale class errors", () => {
  assert.equal(
    getStudentDashboardRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看学习控制台。"
  );
  assert.equal(
    getStudentDashboardRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级信息已失效，课表与任务会在重新加入班级后恢复。"
  );
  assert.equal(isMissingStudentDashboardClassError(createRequestError(404, "not found")), true);
});

test("student dashboard join helpers map invite-code errors", () => {
  assert.equal(
    getStudentDashboardJoinRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续加入班级。"
  );
  assert.equal(
    getStudentDashboardJoinRequestMessage(createRequestError(404, "邀请码无效"), "fallback"),
    "邀请码无效，请检查老师提供的邀请码后重试。"
  );
  assert.equal(
    getStudentDashboardJoinRequestMessage(createRequestError(400, "班级与学生学校不匹配"), "fallback"),
    "该班级与当前学生账号不属于同一学校，暂时无法加入。"
  );
});

test("student dashboard helpers extract nested payloads and summary counts", () => {
  assert.deepEqual(
    extractStudentDashboardPlanItems({
      data: {
        plan: {
          items: [
            { knowledgePointId: "kp-1", targetCount: 3, dueDate: "2026-03-20", masteryLevel: "weak" }
          ]
        }
      }
    }),
    [{ knowledgePointId: "kp-1", targetCount: 3, dueDate: "2026-03-20", masteryLevel: "weak" }]
  );

  assert.deepEqual(
    extractStudentDashboardMotivation({ data: { streak: 5, badges: [] } }),
    { streak: 5, badges: [] }
  );

  assert.deepEqual(
    extractStudentDashboardRadarSnapshot({
      data: {
        mastery: {
          weakKnowledgePoints: [
            {
              knowledgePointId: "kp-1",
              title: "分数乘法",
              subject: "math",
              masteryScore: 42,
              weaknessRank: 1
            }
          ]
        }
      }
    }),
    {
      weakKnowledgePoint: {
        knowledgePointId: "kp-1",
        title: "分数乘法",
        subject: "math",
        masteryScore: 42,
        weaknessRank: 1
      }
    }
  );

  const plan: PlanItem[] = [
    { knowledgePointId: "kp-1", targetCount: 3, dueDate: "2026-03-20", masteryLevel: "weak" },
    { knowledgePointId: "kp-2", targetCount: 2, dueDate: "2026-03-21", masteryLevel: "strong" }
  ];

  assert.equal(getStudentDashboardTotalPlanCount(plan), 5);
  assert.equal(getStudentDashboardWeakPlanCount(plan), 1);
  assert.equal(
    countStudentDashboardPendingJoinRequests([{ status: "pending" }, { status: "approved" }]),
    1
  );
});

test("student dashboard helpers derive task and entry visibility deterministically", () => {
  const todayTasks: TodayTaskPayload = {
    generatedAt: "2026-03-19T10:00:00.000Z",
    summary: {
      total: 4,
      mustDo: 2,
      continueLearning: 1,
      growth: 1,
      overdue: 1,
      dueToday: 1,
      inProgress: 1,
      top3EstimatedMinutes: 30,
      bySource: {
        assignment: 1,
        exam: 1,
        wrongReview: 1,
        plan: 1,
        challenge: 0,
        lesson: 0
      }
    },
    groups: {
      mustDo: [
        {
          id: "task-1",
          source: "assignment",
          sourceId: "a-1",
          title: "数学作业",
          description: "完成练习",
          href: "/student/assignments",
          status: "due_today",
          priority: 10,
          impactScore: 9,
          urgencyScore: 8,
          effortMinutes: 20,
          expectedGain: 8,
          recommendedReason: "先做",
          dueAt: null,
          group: "must_do",
          tags: []
        }
      ],
      continueLearning: [],
      growth: []
    },
    topTasks: [
      {
        id: "task-2",
        source: "plan",
        sourceId: "p-1",
        title: "巩固弱项",
        description: "复练",
        href: "/practice",
        status: "in_progress",
        priority: 9,
        impactScore: 8,
        urgencyScore: 7,
        effortMinutes: 10,
        expectedGain: 7,
        recommendedReason: "保持节奏",
        dueAt: null,
        group: "must_do",
        tags: []
      }
    ],
    tasks: [
      {
        id: "task-1",
        source: "assignment",
        sourceId: "a-1",
        title: "数学作业",
        description: "完成练习",
        href: "/student/assignments",
        status: "due_today",
        priority: 10,
        impactScore: 9,
        urgencyScore: 8,
        effortMinutes: 20,
        expectedGain: 8,
        recommendedReason: "先做",
        dueAt: null,
        group: "must_do",
        tags: []
      },
      {
        id: "task-2",
        source: "plan",
        sourceId: "p-1",
        title: "巩固弱项",
        description: "复练",
        href: "/practice",
        status: "in_progress",
        priority: 9,
        impactScore: 8,
        urgencyScore: 7,
        effortMinutes: 10,
        expectedGain: 7,
        recommendedReason: "保持节奏",
        dueAt: null,
        group: "must_do",
        tags: []
      },
      {
        id: "task-3",
        source: "exam",
        sourceId: "e-1",
        title: "单元测",
        description: "考试",
        href: "/student/exams",
        status: "upcoming",
        priority: 8,
        impactScore: 7,
        urgencyScore: 6,
        effortMinutes: 30,
        expectedGain: 6,
        recommendedReason: "按时做",
        dueAt: null,
        group: "continue_learning",
        tags: []
      },
      {
        id: "task-4",
        source: "wrong_review",
        sourceId: "w-1",
        title: "错题复盘",
        description: "复练",
        href: "/wrong-book",
        status: "optional",
        priority: 5,
        impactScore: 5,
        urgencyScore: 3,
        effortMinutes: 15,
        expectedGain: 4,
        recommendedReason: "补充",
        dueAt: null,
        group: "growth",
        tags: []
      }
    ]
  };

  const topTodayTasks = buildStudentDashboardTopTodayTasks(todayTasks);
  assert.deepEqual(topTodayTasks.map((task) => task.id), ["task-2"]);

  const visiblePriorityTasks = buildStudentDashboardVisiblePriorityTasks(todayTasks, topTodayTasks);
  assert.deepEqual(visiblePriorityTasks.map((task) => task.id), ["task-1"]);
  assert.equal(getStudentDashboardHiddenTodayTaskCount(todayTasks, visiblePriorityTasks.length), 3);
  assert.equal(getStudentDashboardRecommendedTask(todayTasks, visiblePriorityTasks)?.id, "task-2");

  const priorityEntries = getStudentDashboardEntriesByCategory("priority");
  assert.equal(getStudentDashboardCategoryCounts().priority > 0, true);
  assert.equal(priorityEntries[0]?.id, "calendar");
  assert.equal(
    getStudentDashboardVisibleEntries(priorityEntries, "priority", false).length,
    4
  );
  assert.equal(
    hasStudentDashboardData({
      plan: [],
      motivation: null,
      todayTasks: null,
      schedule: null,
      joinRequests: []
    }),
    false
  );
  assert.equal(getStudentDashboardJoinSuccessMessage("", "已加入排队"), "已加入排队");
});

test("student dashboard helpers derive aggregate dashboard state and exposure payloads", () => {
  const todayTasks: TodayTaskPayload = {
    generatedAt: "2026-03-19T10:00:00.000Z",
    summary: {
      total: 2,
      mustDo: 1,
      continueLearning: 1,
      growth: 0,
      overdue: 0,
      dueToday: 1,
      inProgress: 1,
      top3EstimatedMinutes: 30,
      bySource: {
        assignment: 1,
        exam: 0,
        wrongReview: 0,
        plan: 1,
        challenge: 0,
        lesson: 0
      }
    },
    groups: {
      mustDo: [
        {
          id: "task-1",
          source: "assignment",
          sourceId: "a-1",
          title: "数学作业",
          description: "完成练习",
          href: "/student/assignments",
          status: "due_today",
          priority: 10,
          impactScore: 9,
          urgencyScore: 8,
          effortMinutes: 20,
          expectedGain: 8,
          recommendedReason: "先做",
          dueAt: null,
          group: "must_do",
          tags: []
        }
      ],
      continueLearning: [],
      growth: []
    },
    topTasks: [
      {
        id: "task-2",
        source: "plan",
        sourceId: "p-1",
        title: "巩固弱项",
        description: "复练",
        href: "/practice",
        status: "in_progress",
        priority: 9,
        impactScore: 8,
        urgencyScore: 7,
        effortMinutes: 10,
        expectedGain: 7,
        recommendedReason: "保持节奏",
        dueAt: null,
        group: "must_do",
        tags: []
      }
    ],
    tasks: [
      {
        id: "task-1",
        source: "assignment",
        sourceId: "a-1",
        title: "数学作业",
        description: "完成练习",
        href: "/student/assignments",
        status: "due_today",
        priority: 10,
        impactScore: 9,
        urgencyScore: 8,
        effortMinutes: 20,
        expectedGain: 8,
        recommendedReason: "先做",
        dueAt: null,
        group: "must_do",
        tags: []
      },
      {
        id: "task-2",
        source: "plan",
        sourceId: "p-1",
        title: "巩固弱项",
        description: "复练",
        href: "/practice",
        status: "in_progress",
        priority: 9,
        impactScore: 8,
        urgencyScore: 7,
        effortMinutes: 10,
        expectedGain: 7,
        recommendedReason: "保持节奏",
        dueAt: null,
        group: "must_do",
        tags: []
      }
    ]
  };

  const derived = getStudentDashboardDerivedState({
    plan: [
      { knowledgePointId: "kp-1", targetCount: 3, dueDate: "2026-03-20", masteryLevel: "weak" }
    ],
    motivation: { streak: 5, badges: [] },
    todayTasks,
    schedule: null,
    joinRequests: [{ status: "pending" }, { status: "approved" }],
    activeCategory: "priority",
    showAllEntries: false
  });

  assert.equal(derived.pendingJoinCount, 1);
  assert.equal(derived.totalPlanCount, 3);
  assert.equal(derived.weakPlanCount, 1);
  assert.deepEqual(derived.topTodayTasks.map((task) => task.id), ["task-2"]);
  assert.deepEqual(derived.visiblePriorityTasks.map((task) => task.id), ["task-1"]);
  assert.equal(derived.hiddenTodayTaskCount, 1);
  assert.equal(derived.entriesByCategory[0]?.id, "calendar");
  assert.equal(derived.visibleEntries.length, 4);
  assert.equal(derived.recommendedTask?.id, "task-2");
  assert.equal(derived.hasDashboardData, true);

  const exposureProps = buildStudentDashboardTaskExposureProps(todayTasks, derived.topTodayTasks);
  assert.deepEqual(exposureProps, [
    {
      generatedAt: "2026-03-19T10:00:00.000Z",
      taskId: "task-2",
      source: "plan",
      rank: 1,
      priority: 9,
      impactScore: 8,
      urgencyScore: 7,
      effortMinutes: 10
    }
  ]);
  assert.deepEqual(derived.taskExposureProps, exposureProps);
});
