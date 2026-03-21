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
  filterNotifications,
  getNotificationActionRequestMessage,
  getNotificationCounts,
  getNotificationTypeOptions,
  getNotificationsRequestMessage,
  hasActiveNotificationFilters,
  isMissingNotificationError,
  markAllNotificationsAsRead,
  markNotificationAsRead,
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

test("notifications helpers derive counts, options, and filtered list deterministically", () => {
  const list = [
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
    },
    {
      id: "notification-3",
      title: "批改反馈",
      content: "英语作文已批改",
      type: "review",
      createdAt: "2026-03-17T10:00:00.000Z"
    }
  ];

  assert.deepEqual(getNotificationCounts(list), { unreadCount: 2, readCount: 1 });
  assert.deepEqual(getNotificationTypeOptions(list), ["assignment", "announcement", "review"]);
  assert.equal(hasActiveNotificationFilters("all", "all", ""), false);
  assert.equal(hasActiveNotificationFilters("unread", "all", ""), true);
  assert.deepEqual(
    filterNotifications(list, "unread", "all", "批改").map((item) => item.id),
    ["notification-3"]
  );
  assert.deepEqual(
    filterNotifications(list, "all", "announcement", "公告").map((item) => item.id),
    ["notification-2"]
  );
});

test("notifications helpers apply local read snapshots without mutating unrelated items", () => {
  const list = [
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

  const markedList = markNotificationAsRead(list, "notification-1", "2026-03-17T10:00:00.000Z");
  assert.equal(markedList[0].readAt, "2026-03-17T10:00:00.000Z");
  assert.equal(markedList[1].readAt, "2026-03-17T09:30:00.000Z");

  const markAllList = markAllNotificationsAsRead(list, "2026-03-17T11:00:00.000Z");
  assert.equal(markAllList[0].readAt, "2026-03-17T11:00:00.000Z");
  assert.equal(markAllList[1].readAt, "2026-03-17T09:30:00.000Z");
});
