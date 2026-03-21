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
  buildParentCorrectionsReminderText,
  deriveParentTaskBuckets,
  getParentAssignmentsRequestMessage,
  getParentReceiptSubmitRequestMessage,
  getParentReportRequestMessage,
  isParentMissingActionItemError,
  isParentMissingStudentContextError,
  pruneParentReceiptNotes
} = require("../../app/parent/utils") as typeof import("../../app/parent/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("parent helpers map auth expiry and missing student context", () => {
  assert.equal(
    getParentReportRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "家长登录状态已失效，请重新登录后继续查看家长周报。"
  );
  assert.equal(
    getParentAssignmentsRequestMessage(createRequestError(400, "missing student"), "fallback"),
    "当前家长账号尚未绑定学生信息，绑定后即可查看作业提醒。"
  );
  assert.equal(isParentMissingStudentContextError(createRequestError(404, "student not found")), true);
});

test("parent helpers map receipt validation errors and prune stale notes", () => {
  assert.equal(
    getParentReceiptSubmitRequestMessage(createRequestError(400, "skipped status requires note"), "fallback"),
    "如选择“暂时跳过”，请填写至少 2 个字的原因。"
  );
  assert.equal(
    getParentReceiptSubmitRequestMessage(createRequestError(400, "invalid actionItemId for source"), "fallback"),
    "当前行动卡已不可用，页面会在刷新后自动同步。"
  );
  assert.equal(isParentMissingActionItemError(createRequestError(400, "invalid actionItemId for source")), true);

  assert.deepEqual(
    pruneParentReceiptNotes(
      {
        "weekly_report:daily-practice": "今晚完成",
        "weekly_report:stale-item": "旧备注",
        "assignment_plan:daily-checklist": "",
        "assignment_plan:review-today": "跟进错题"
      },
      [
        {
          source: "weekly_report",
          items: [{ id: "daily-practice" }]
        },
        {
          source: "assignment_plan",
          items: [{ id: "review-today" }]
        }
      ]
    ),
    {
      "weekly_report:daily-practice": "今晚完成",
      "assignment_plan:review-today": "跟进错题"
    }
  );
});

test("parent helpers derive correction task buckets by pending and due windows", () => {
  const now = Date.parse("2026-03-19T12:00:00.000Z");
  const tasks = [
    {
      id: "due-soon",
      status: "pending",
      dueDate: "2026-03-20T12:00:00.000Z"
    },
    {
      id: "overdue",
      status: "pending",
      dueDate: "2026-03-18T11:59:59.000Z"
    },
    {
      id: "later",
      status: "pending",
      dueDate: "2026-03-24T12:00:00.000Z"
    },
    {
      id: "done",
      status: "done",
      dueDate: "2026-03-20T12:00:00.000Z"
    }
  ];

  assert.deepEqual(
    deriveParentTaskBuckets(tasks, now),
    {
      pendingTasks: tasks.slice(0, 3),
      dueSoonTasks: [tasks[0]],
      overdueTasks: [tasks[1]]
    }
  );
});

test("parent helpers build corrections reminder text from summary and due soon tasks", () => {
  const dueSoonTasks = [
    {
      id: "1",
      status: "pending",
      dueDate: "2026-03-20T12:00:00.000Z",
      question: { stem: "分数加法" }
    },
    {
      id: "2",
      status: "pending",
      dueDate: "2026-03-21T12:00:00.000Z",
      question: { stem: "古诗默写" }
    },
    {
      id: "3",
      status: "pending",
      dueDate: "2026-03-21T18:00:00.000Z"
    },
    {
      id: "4",
      status: "pending",
      dueDate: "2026-03-21T23:00:00.000Z",
      question: { stem: "这条不应出现" }
    }
  ];

  const reminderText = buildParentCorrectionsReminderText({
    summary: { pending: 5 },
    pendingTasks: dueSoonTasks,
    dueSoonTasks,
    overdueTasks: [{ id: "late", status: "pending", dueDate: "2026-03-18T12:00:00.000Z" }]
  });

  assert.equal(
    reminderText,
    [
      "本周订正任务：待完成 5 题。",
      "已逾期 1 题，请尽快完成。",
      "近 2 天到期 4 题。",
      `- 分数加法（截止 ${new Date("2026-03-20T12:00:00.000Z").toLocaleDateString("zh-CN")}）`,
      `- 古诗默写（截止 ${new Date("2026-03-21T12:00:00.000Z").toLocaleDateString("zh-CN")}）`,
      `- 题目（截止 ${new Date("2026-03-21T18:00:00.000Z").toLocaleDateString("zh-CN")}）`
    ].join("\n")
  );
});
