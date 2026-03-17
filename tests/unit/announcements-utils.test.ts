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
  getAnnouncementClassListRequestMessage,
  getAnnouncementsListRequestMessage,
  getAnnouncementSubmitRequestMessage,
  isMissingAnnouncementClassError,
  resolveAnnouncementClassId
} = require("../../app/announcements/utils") as typeof import("../../app/announcements/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("announcements helpers map auth, missing student, and submit validation errors", () => {
  assert.equal(
    getAnnouncementsListRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续查看班级公告。"
  );
  assert.equal(
    getAnnouncementsListRequestMessage(createRequestError(400, "missing student"), "fallback"),
    "当前家长账号尚未绑定学生信息，绑定后即可查看班级公告。"
  );
  assert.equal(
    getAnnouncementClassListRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "登录状态已失效，请重新登录后继续选择发布班级。"
  );
  assert.equal(
    getAnnouncementSubmitRequestMessage(createRequestError(400, "missing fields"), "fallback"),
    "请先填写班级、公告标题和公告内容。"
  );
  assert.equal(
    getAnnouncementSubmitRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不可用，请刷新班级列表后重新选择。"
  );
  assert.equal(isMissingAnnouncementClassError(createRequestError(404, "not found")), true);
});

test("announcements helpers keep selected class only when it still exists", () => {
  const classes = [
    { id: "class-1", name: "一班", subject: "math", grade: "4" },
    { id: "class-2", name: "二班", subject: "chinese", grade: "4" }
  ];

  assert.equal(resolveAnnouncementClassId(classes, "class-2"), "class-2");
  assert.equal(resolveAnnouncementClassId(classes, "missing-class"), "class-1");
  assert.equal(resolveAnnouncementClassId([], "class-1"), "");
});
