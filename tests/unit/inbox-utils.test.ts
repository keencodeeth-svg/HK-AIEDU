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
  filterInboxThreads,
  getComposeHint,
  getInboxCreateRequestMessage,
  getInboxCreateSuccessMessage,
  getInboxDerivedState,
  getInboxLoadRequestMessage,
  getInboxNoStoreRequestInit,
  getInboxReplyRequestMessage,
  getInboxReplySuccessMessage,
  isInboxThreadDetailCurrent,
  isMissingInboxClassError,
  isMissingInboxThreadError,
  resolveInboxActiveThreadId,
  resolveInboxClassId
} = require("../../app/inbox/utils") as typeof import("../../app/inbox/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("inbox helpers map auth, missing thread, and validation errors", () => {
  assert.equal(
    getInboxLoadRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续查看收件箱。"
  );
  assert.equal(
    getInboxLoadRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该会话不存在，或你当前无权查看这条沟通记录。"
  );
  assert.equal(
    getInboxCreateRequestMessage(createRequestError(400, "missing fields"), "fallback"),
    "请先填写主题和消息内容。"
  );
  assert.equal(
    getInboxCreateRequestMessage(createRequestError(400, "class has no teacher"), "fallback"),
    "当前班级还没有绑定教师，暂时无法发起沟通。"
  );
  assert.equal(
    getInboxReplyRequestMessage(createRequestError(400, "missing content"), "fallback"),
    "请输入回复内容后再发送。"
  );
  assert.equal(
    getInboxReplyRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该会话已不存在，或你当前无权继续回复。"
  );
  assert.equal(isMissingInboxThreadError(createRequestError(404, "not found")), true);
  assert.equal(isMissingInboxClassError(createRequestError(404, "class not found")), true);
});

test("inbox helpers keep only existing class and thread selections", () => {
  const classes = [
    { id: "class-1", name: "一班", subject: "math", grade: "4" },
    { id: "class-2", name: "二班", subject: "chinese", grade: "4" }
  ];
  const threads = [
    {
      id: "thread-1",
      subject: "作业提醒",
      updatedAt: "2026-03-17T08:00:00.000Z",
      participants: [],
      unreadCount: 0
    },
    {
      id: "thread-2",
      subject: "课堂反馈",
      updatedAt: "2026-03-17T09:00:00.000Z",
      participants: [],
      unreadCount: 1
    }
  ];

  assert.equal(resolveInboxClassId(classes, "class-2"), "class-2");
  assert.equal(resolveInboxClassId(classes, "missing-class"), "class-1");
  assert.equal(resolveInboxClassId([], "class-1"), "");

  assert.equal(resolveInboxActiveThreadId(threads, "thread-2", "thread-1"), "thread-2");
  assert.equal(resolveInboxActiveThreadId(threads, "missing-thread", "thread-1"), "thread-1");
  assert.equal(resolveInboxActiveThreadId(threads, "missing-thread"), "thread-1");
  assert.equal(resolveInboxActiveThreadId([], "thread-2"), "");
});

test("inbox helpers detect whether visible detail still matches the selected thread", () => {
  assert.equal(
    isInboxThreadDetailCurrent(
      {
        thread: { id: "thread-1", subject: "作业提醒" },
        participants: [],
        messages: []
      },
      "thread-1"
    ),
    true
  );
  assert.equal(
    isInboxThreadDetailCurrent(
      {
        thread: { id: "thread-1", subject: "作业提醒" },
        participants: [],
        messages: []
      },
      "thread-2"
    ),
    false
  );
  assert.equal(isInboxThreadDetailCurrent(null, "thread-1"), false);
});

test("inbox helpers filter threads and map sync success messages", () => {
  const threads = [
    {
      id: "thread-1",
      subject: "作业提醒",
      updatedAt: "2026-03-17T08:00:00.000Z",
      participants: [{ id: "u1", name: "张老师", role: "teacher" }],
      lastMessage: { content: "明天交作业", createdAt: "2026-03-17T08:05:00.000Z" },
      unreadCount: 0
    },
    {
      id: "thread-2",
      subject: "课堂反馈",
      updatedAt: "2026-03-17T09:00:00.000Z",
      participants: [{ id: "u2", name: "李老师", role: "teacher" }],
      lastMessage: { content: "今天表现不错", createdAt: "2026-03-17T09:05:00.000Z" },
      unreadCount: 1
    }
  ];

  assert.deepEqual(filterInboxThreads(threads, "", false).map((item) => item.id), ["thread-1", "thread-2"]);
  assert.deepEqual(filterInboxThreads(threads, "李老师", false).map((item) => item.id), ["thread-2"]);
  assert.deepEqual(filterInboxThreads(threads, "作业", false).map((item) => item.id), ["thread-1"]);
  assert.deepEqual(filterInboxThreads(threads, "", true).map((item) => item.id), ["thread-2"]);

  assert.equal(getInboxCreateSuccessMessage("loaded"), "消息已发送");
  assert.equal(getInboxCreateSuccessMessage("error"), "消息已发送，但会话列表刷新失败，请稍后重试。");
  assert.equal(getInboxCreateSuccessMessage("stale"), "消息已发送，收件箱正在同步最新内容。");
  assert.equal(getInboxReplySuccessMessage("loaded"), "回复已发送");
  assert.equal(getInboxReplySuccessMessage("error"), "回复已发送，但会话刷新失败，请稍后重试。");
  assert.equal(getInboxReplySuccessMessage("stale"), "回复已发送，收件箱正在同步最新内容。");
});

test("inbox helpers derive compose hints and page state deterministically", () => {
  const threads = [
    {
      id: "thread-1",
      subject: "作业提醒",
      updatedAt: "2026-03-17T08:00:00.000Z",
      participants: [{ id: "u1", name: "张老师", role: "teacher" }],
      lastMessage: { content: "明天交作业", createdAt: "2026-03-17T08:05:00.000Z" },
      unreadCount: 2
    },
    {
      id: "thread-2",
      subject: "课堂反馈",
      updatedAt: "2026-03-17T09:00:00.000Z",
      participants: [{ id: "u2", name: "李老师", role: "teacher" }],
      lastMessage: { content: "今天表现不错", createdAt: "2026-03-17T09:05:00.000Z" },
      unreadCount: 1
    }
  ];

  assert.equal(getComposeHint("teacher"), "支持按班级发送给学生，并可选择同步给家长。");
  assert.equal(getComposeHint("parent"), "按班级发送给任课老师，适合家校沟通与反馈。");
  assert.equal(getComposeHint("student"), "按班级发送给任课老师，适合提问、反馈和沟通学习安排。");

  const derived = getInboxDerivedState({
    user: { id: "teacher-1", role: "teacher", name: "张老师" },
    classes: [{ id: "class-1", name: "一班", subject: "math", grade: "4" }],
    classId: "class-1",
    threads,
    activeThreadId: "thread-2",
    threadDetail: {
      thread: { id: "thread-2", subject: "课堂反馈" },
      participants: [{ id: "u2", name: "李老师", role: "teacher" }],
      messages: []
    },
    keyword: "李老师",
    unreadOnly: true,
    requestedThreadId: "thread-2"
  });

  assert.equal(derived.currentClass?.id, "class-1");
  assert.equal(derived.activeThread?.id, "thread-2");
  assert.equal(derived.unreadCount, 3);
  assert.deepEqual(derived.filteredThreads.map((item) => item.id), ["thread-2"]);
  assert.equal(derived.hasInboxData, true);
  assert.equal(derived.requestedThreadMatched, true);
});

test("inbox helpers expose fresh no-store request init for dynamic session bootstrap", () => {
  const first = getInboxNoStoreRequestInit();
  const second = getInboxNoStoreRequestInit();

  assert.notEqual(first, second);
  assert.deepEqual(first, { cache: "no-store" });
  assert.deepEqual(second, { cache: "no-store" });
});
