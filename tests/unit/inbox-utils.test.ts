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
  getInboxCreateRequestMessage,
  getInboxLoadRequestMessage,
  getInboxReplyRequestMessage,
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
