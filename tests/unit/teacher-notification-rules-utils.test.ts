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
  buildDraftRule,
  DEFAULT_RULE,
  getTeacherNotificationRulesPageDerivedState,
  getTeacherNotificationMissingClassError,
  getTeacherNotificationRefreshErrors,
  getTeacherNotificationRulesRequestMessage,
  isMissingTeacherNotificationClassError,
  resolveTeacherNotificationClassId,
  upsertTeacherNotificationRule
} = require("../../app/teacher/notifications/utils") as typeof import("../../app/teacher/notifications/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher notification rules helpers map auth and validation errors", () => {
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续配置通知规则。"
  );
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(400, "body.classId must be at least 1 chars"), "fallback"),
    "请先选择班级后再操作。"
  );
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(400, "body.dueDays must be >= 0"), "fallback"),
    "截止前提醒天数不能小于 0。"
  );
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(400, "body.overdueDays must be >= 0"), "fallback"),
    "逾期提醒天数不能小于 0。"
  );
});

test("teacher notification rules helpers detect stale class context", () => {
  assert.equal(
    getTeacherNotificationRulesRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的配置权限。"
  );
  assert.equal(isMissingTeacherNotificationClassError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherNotificationClassError(createRequestError(400, "bad request")), false);
});

test("teacher notification rules helpers resolve class selection and draft upsert deterministically", () => {
  const classes = [{ id: "class-a" }, { id: "class-b" }];
  const nextRule = {
    id: "rule-b",
    classId: "class-b",
    enabled: false,
    dueDays: 1,
    overdueDays: 3,
    includeParents: false
  };

  assert.equal(resolveTeacherNotificationClassId("class-b", classes), "class-b");
  assert.equal(resolveTeacherNotificationClassId("missing", classes), "class-a");
  assert.equal(resolveTeacherNotificationClassId("", []), "");
  assert.deepEqual(buildDraftRule("class-missing", []), {
    id: "",
    classId: "class-missing",
    ...DEFAULT_RULE
  });
  assert.deepEqual(
    upsertTeacherNotificationRule(
      [{ id: "rule-a", classId: "class-a", enabled: true, dueDays: 2, overdueDays: 0, includeParents: true }],
      nextRule
    ),
    [
      { id: "rule-a", classId: "class-a", enabled: true, dueDays: 2, overdueDays: 0, includeParents: true },
      nextRule
    ]
  );
});

test("teacher notification rules helpers collect missing class and refresh errors", () => {
  const missing = createRequestError(404, "not found");
  const previewFailure = createRequestError(400, "body.classId must be at least 1 chars");

  assert.equal(getTeacherNotificationMissingClassError([previewFailure, missing]), missing);
  assert.deepEqual(
    getTeacherNotificationRefreshErrors([
      { label: "提醒预览刷新失败", error: previewFailure },
      { label: "执行历史刷新失败", error: null }
    ]),
    ["提醒预览刷新失败：请先选择班级后再操作。"]
  );
});

test("teacher notification rules helpers derive page state and preview deltas consistently", () => {
  const classes = [{ id: "class-a", name: "一班", subject: "math", grade: "6" }];
  const savedRules = [
    { id: "rule-a", classId: "class-a", enabled: true, dueDays: 2, overdueDays: 0, includeParents: true }
  ];
  const draftRule = savedRules[0];
  const preview = {
    generatedAt: "2026-03-20T10:00:00.000Z",
    class: classes[0],
    rule: draftRule,
    summary: {
      enabled: true,
      assignmentTargets: 3,
      dueSoonAssignments: 1,
      overdueAssignments: 2,
      studentTargets: 12,
      parentTargets: 8,
      uniqueStudents: 10
    },
    sampleAssignments: [
      {
        assignmentId: "assignment-1",
        title: "分数练习",
        dueDate: "2026-03-20",
        stage: "overdue" as const,
        studentTargets: 6,
        parentTargets: 4
      }
    ]
  };
  const history = [
    {
      id: "history-1",
      executedAt: "2026-03-19T10:00:00.000Z",
      totals: {
        classes: 1,
        assignmentTargets: 2,
        dueSoonAssignments: 1,
        overdueAssignments: 1,
        studentTargets: 9,
        parentTargets: 6,
        uniqueStudents: 8
      },
      classResults: [
        {
          classId: "class-a",
          className: "一班",
          subject: "math",
          grade: "6",
          rule: draftRule,
          assignmentTargets: 2,
          dueSoonAssignments: 1,
          overdueAssignments: 1,
          studentTargets: 9,
          parentTargets: 6,
          uniqueStudents: 8,
          sampleAssignments: []
        }
      ]
    }
  ];

  const derived = getTeacherNotificationRulesPageDerivedState({
    classes,
    savedRules,
    classId: "class-a",
    draftRule,
    preview,
    previewRuleSnapshot: draftRule,
    history
  });

  assert.equal(derived.selectedClass?.id, "class-a");
  assert.equal(derived.hasUnsavedChanges, false);
  assert.equal(derived.isPreviewCurrent, true);
  assert.equal(derived.configuredRuleCount, 1);
  assert.equal(derived.enabledRuleCount, 1);
  assert.equal(derived.overdueAssignments.length, 1);
  assert.equal(derived.dueSoonAssignments.length, 0);
  assert.equal(derived.previewTargetDelta, 3);
  assert.equal(derived.commandState.title, "当前更适合先发逾期催交");
});

test("teacher notification rules helpers fall back when class and preview are missing", () => {
  const derived = getTeacherNotificationRulesPageDerivedState({
    classes: [],
    savedRules: [],
    classId: "",
    draftRule: { id: "", classId: "", enabled: false, dueDays: 2, overdueDays: 0, includeParents: true },
    preview: null,
    previewRuleSnapshot: null,
    history: []
  });

  assert.equal(derived.selectedClass, null);
  assert.equal(derived.savedRuleForClass.classId, "");
  assert.equal(derived.hasUnsavedChanges, false);
  assert.equal(derived.isPreviewCurrent, false);
  assert.equal(derived.latestHistory, null);
  assert.equal(derived.latestClassResult, null);
  assert.equal(derived.previewTargetDelta, null);
  assert.equal(derived.commandState.title, "当前规则关闭");
});
