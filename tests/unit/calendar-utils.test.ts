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
  getCalendarScheduleRequestMessage,
  getCalendarTimelineRequestMessage,
  isCalendarMissingStudentError
} = require("../../app/calendar/utils") as typeof import("../../app/calendar/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("calendar helpers map auth expiry and missing student context", () => {
  assert.equal(
    getCalendarScheduleRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续查看课程表与学习日程。"
  );
  assert.equal(
    getCalendarScheduleRequestMessage(createRequestError(400, "missing student"), "fallback"),
    "当前账号尚未绑定学生信息，绑定后即可查看课程表。"
  );
  assert.equal(
    getCalendarTimelineRequestMessage(createRequestError(400, "missing student"), "fallback"),
    "当前账号尚未绑定学生信息，绑定后即可查看学习时间线。"
  );
  assert.equal(isCalendarMissingStudentError(createRequestError(400, "missing student")), true);
});
