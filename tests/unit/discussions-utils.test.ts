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
  filterDiscussionTopics,
  getDiscussionCreateRequestMessage,
  getDiscussionCreateSuccessMessage,
  getDiscussionNoStoreRequestInit,
  getDiscussionsDerivedState,
  getDiscussionReplyRequestMessage,
  getDiscussionReplySuccessMessage,
  getDiscussionStageCopy,
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

test("discussion helpers filter topics and normalize keyword matching", () => {
  const topics = [
    {
      id: "topic-1",
      classId: "class-1",
      title: "作业复盘",
      content: "聊聊今天的作业难点",
      pinned: false,
      createdAt: "2026-03-17T08:00:00.000Z",
      updatedAt: "2026-03-17T08:10:00.000Z",
      authorName: "张老师"
    },
    {
      id: "topic-2",
      classId: "class-1",
      title: "错题分享",
      content: "分享你今天修正的一道题",
      pinned: true,
      createdAt: "2026-03-17T09:00:00.000Z",
      updatedAt: "2026-03-17T09:15:00.000Z",
      authorName: "李老师"
    }
  ];

  assert.deepEqual(filterDiscussionTopics(topics, "", false).map((item) => item.id), ["topic-1", "topic-2"]);
  assert.deepEqual(filterDiscussionTopics(topics, " 错题 ", false).map((item) => item.id), ["topic-2"]);
  assert.deepEqual(filterDiscussionTopics(topics, "张老师", false).map((item) => item.id), ["topic-1"]);
  assert.deepEqual(filterDiscussionTopics(topics, "", true).map((item) => item.id), ["topic-2"]);
});

test("discussion helpers derive stage copy for loading, empty, and active-topic states", () => {
  assert.deepEqual(
    getDiscussionStageCopy({
      loading: true,
      classesCount: 0,
      topicsCount: 0,
      activeTopic: null,
      teacherMode: false
    }),
    {
      title: "正在加载班级讨论区",
      description: "系统正在同步你的班级、话题与回复记录，请稍等。"
    }
  );
  assert.deepEqual(
    getDiscussionStageCopy({
      loading: false,
      classesCount: 0,
      topicsCount: 0,
      activeTopic: null,
      teacherMode: true
    }),
    {
      title: "先绑定班级，再发起课堂讨论",
      description: "建立授课班级后，这里会自动开放发布话题、收集回复和班级讨论沉淀。"
    }
  );
  assert.deepEqual(
    getDiscussionStageCopy({
      loading: false,
      classesCount: 2,
      topicsCount: 3,
      activeTopic: {
        id: "topic-2",
        classId: "class-1",
        title: "错题分享",
        content: "分享你今天修正的一道题",
        pinned: true,
        createdAt: "2026-03-17T09:00:00.000Z",
        updatedAt: "2026-03-17T09:15:00.000Z"
      },
      teacherMode: false
    }),
    {
      title: "正在查看「错题分享」",
      description: "你可以先读完老师发起的话题，再在下方直接回复，形成完整讨论闭环。"
    }
  );
});

test("discussion helpers derive page state for filters, counts, and current class deterministically", () => {
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
      updatedAt: "2026-03-17T08:10:00.000Z",
      authorName: "张老师"
    },
    {
      id: "topic-2",
      classId: "class-1",
      title: "错题分享",
      content: "分享你今天修正的一道题",
      pinned: true,
      createdAt: "2026-03-17T09:00:00.000Z",
      updatedAt: "2026-03-17T09:15:00.000Z",
      authorName: "李老师"
    }
  ];

  const derived = getDiscussionsDerivedState({
    user: { id: "teacher-1", role: "teacher", name: "张老师" },
    classes,
    classId: "class-1",
    topics,
    activeTopic: topics[1],
    keyword: "错题",
    pinnedOnly: true,
    loading: false
  });

  assert.equal(derived.teacherMode, true);
  assert.equal(derived.currentClass?.id, "class-1");
  assert.equal(derived.pinnedTopicCount, 1);
  assert.equal(derived.hasTopicFilters, true);
  assert.deepEqual(derived.filteredTopics.map((item) => item.id), ["topic-2"]);
  assert.equal(derived.hasDiscussionData, true);
  assert.equal(derived.stageCopy.title, "正在查看「错题分享」");
});

test("discussion helpers map create and reply sync outcomes", () => {
  assert.equal(getDiscussionCreateSuccessMessage("loaded"), "话题已发布，并已自动打开详情，方便继续查看学生回复。");
  assert.equal(getDiscussionCreateSuccessMessage("error"), "话题已发布，但最新列表同步失败，请稍后重试。");
  assert.equal(getDiscussionCreateSuccessMessage("stale"), "话题已发布，讨论区正在同步最新内容。");

  assert.equal(getDiscussionReplySuccessMessage("loaded"), "回复已发送，讨论记录已经更新。");
  assert.equal(getDiscussionReplySuccessMessage("error"), "回复已发送，但讨论记录同步失败，请稍后重试。");
  assert.equal(getDiscussionReplySuccessMessage("stale"), "回复已发送，讨论区正在同步最新内容。");
});

test("discussion helpers expose fresh no-store request init for dynamic session bootstrap", () => {
  const first = getDiscussionNoStoreRequestInit();
  const second = getDiscussionNoStoreRequestInit();

  assert.notEqual(first, second);
  assert.deepEqual(first, { cache: "no-store" });
  assert.deepEqual(second, { cache: "no-store" });
});
