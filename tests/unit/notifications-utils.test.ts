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
  getNotificationActionRequestMessage,
  getNotificationsRequestMessage,
  isMissingNotificationError,
  resolveNotificationsTypeFilter
} = require("../../app/notifications/utils") as typeof import("../../app/notifications/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("notifications helpers map auth and mutation validation errors", () => {
  assert.equal(
    getNotificationsRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续查看通知。"
  );
  assert.equal(
    getNotificationActionRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "登录状态已失效，请重新登录后继续处理通知。"
  );
  assert.equal(
    getNotificationActionRequestMessage(createRequestError(400, "missing id"), "fallback"),
    "未找到要处理的通知，请刷新列表后重试。"
  );
  assert.equal(
    getNotificationActionRequestMessage(createRequestError(404, "not found"), "fallback"),
    "这条通知已不存在，通知列表会在刷新后自动同步。"
  );
  assert.equal(isMissingNotificationError(createRequestError(404, "not found")), true);
});

test("notifications helpers clear stale type filter after refresh", () => {
  const nextList = [
    {
      id: "notification-1",
      title: "作业提醒",
      content: "请完成数学作业",
      type: "assignment",
      createdAt: "2026-03-17T08:00:00.000Z"
    },
    {
      id: "notification-2",
      title: "系统公告",
      content: "今晚维护",
      type: "announcement",
      createdAt: "2026-03-17T09:00:00.000Z",
      readAt: "2026-03-17T09:30:00.000Z"
    }
  ];

  assert.equal(resolveNotificationsTypeFilter(nextList, "assignment"), "assignment");
  assert.equal(resolveNotificationsTypeFilter(nextList, "review"), "all");
  assert.equal(resolveNotificationsTypeFilter(nextList, "all"), "all");
});
