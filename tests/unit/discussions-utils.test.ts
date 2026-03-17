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
  getDiscussionCreateRequestMessage,
  getDiscussionReplyRequestMessage,
  getDiscussionTopicDetailRequestMessage,
  getDiscussionTopicListRequestMessage,
  isMissingDiscussionClassError,
  isMissingDiscussionTopicError,
  resolveDiscussionsClassId,
  resolveDiscussionTopicId
} = require("../../app/discussions/utils") as typeof import("../../app/discussions/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("discussions helpers map auth, missing topic, and validation errors", () => {
  assert.equal(
    getDiscussionTopicListRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续查看班级讨论。"
  );
  assert.equal(
    getDiscussionTopicDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该话题不存在，或你当前无权查看这个班级的讨论。"
  );
  assert.equal(
    getDiscussionCreateRequestMessage(createRequestError(400, "missing fields"), "fallback"),
    "请先补全班级、标题和话题内容。"
  );
  assert.equal(
    getDiscussionCreateRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不可用，请刷新班级列表后重新选择可发布的班级。"
  );
  assert.equal(
    getDiscussionReplyRequestMessage(createRequestError(400, "missing content"), "fallback"),
    "请输入回复内容后再发送。"
  );
  assert.equal(
    getDiscussionReplyRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该话题已不存在，或你当前无权继续回复。"
  );
  assert.equal(isMissingDiscussionTopicError(createRequestError(404, "not found")), true);
  assert.equal(isMissingDiscussionClassError(createRequestError(404, "class not found")), true);
});

test("discussions helpers keep selected class and topic only when they still exist", () => {
  const classes = [
    { id: "class-1", name: "一班", subject: "math", grade: "4" },
    { id: "class-2", name: "二班", subject: "chinese", grade: "4" }
  ];
  const topics = [
    {
      id: "topic-1",
      classId: "class-1",
      title: "作业复盘",
      content: "聊聊今天的作业难点",
      pinned: false,
      createdAt: "2026-03-17T08:00:00.000Z",
      updatedAt: "2026-03-17T08:10:00.000Z"
    },
    {
      id: "topic-2",
      classId: "class-1",
      title: "错题分享",
      content: "分享你今天修正的一道题",
      pinned: true,
      createdAt: "2026-03-17T09:00:00.000Z",
      updatedAt: "2026-03-17T09:15:00.000Z"
    }
  ];

  assert.equal(resolveDiscussionsClassId(classes, "class-2"), "class-2");
  assert.equal(resolveDiscussionsClassId(classes, "missing-class"), "class-1");
  assert.equal(resolveDiscussionsClassId([], "class-1"), "");

  assert.equal(resolveDiscussionTopicId(topics, "topic-2", "topic-1"), "topic-2");
  assert.equal(resolveDiscussionTopicId(topics, "missing-topic", "topic-1"), "topic-1");
  assert.equal(resolveDiscussionTopicId(topics, "missing-topic"), "topic-1");
  assert.equal(resolveDiscussionTopicId([], "topic-2"), "");
});
