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
