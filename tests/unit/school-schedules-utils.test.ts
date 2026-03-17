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
  getSchoolSchedulesRequestMessage,
  isMissingSchoolScheduleClassError,
  isMissingSchoolScheduleOperationError,
  isMissingSchoolSchedulePreviewError,
  isMissingSchoolScheduleSessionError,
  isMissingSchoolScheduleTeacherRuleError,
  isMissingSchoolScheduleTeacherUnavailableError,
  isMissingSchoolScheduleTemplateError
} = require("../../app/school/schedules/utils") as typeof import("../../app/school/schedules/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("school schedules helpers map auth and school context errors", () => {
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续管理课程表。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(403, "school not bound"), "fallback"),
    "当前账号尚未绑定学校，暂时无法管理课程表。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(403, "cross school access denied"), "fallback"),
    "当前账号不能访问这所学校的课程表数据，请切换到有权限的学校后再试。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(400, "schoolId required for platform admin"), "fallback"),
    "请先选择学校后再管理课程表。"
  );
});

test("school schedules helpers map stale schedule entities to actionable copy", () => {
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "class not found: cls_1"), "fallback"),
    "所选班级不存在，请刷新班级列表后重试。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "schedule not found"), "fallback"),
    "该课程节次不存在，可能已被其他管理员删除。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "schedule template not found"), "fallback"),
    "课时模板不存在，可能已被删除。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "teacher schedule rule not found"), "fallback"),
    "教师排课规则不存在，可能已被删除。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "teacher unavailable slot not found"), "fallback"),
    "教师禁排时段不存在，可能已被删除。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "ai schedule preview not found"), "fallback"),
    "这次 AI 预演已失效，请重新预演后再写入。"
  );
  assert.equal(
    getSchoolSchedulesRequestMessage(createRequestError(404, "ai schedule operation not found"), "fallback"),
    "没有找到可回滚的 AI 排课记录。"
  );
});

test("school schedules helpers distinguish missing schedule contexts", () => {
  assert.equal(isMissingSchoolScheduleClassError(createRequestError(404, "class not found: cls_1")), true);
  assert.equal(isMissingSchoolScheduleSessionError(createRequestError(404, "schedule not found")), true);
  assert.equal(isMissingSchoolScheduleTemplateError(createRequestError(404, "schedule template not found")), true);
  assert.equal(isMissingSchoolScheduleTeacherRuleError(createRequestError(404, "teacher schedule rule not found")), true);
  assert.equal(
    isMissingSchoolScheduleTeacherUnavailableError(createRequestError(404, "teacher unavailable slot not found")),
    true
  );
  assert.equal(isMissingSchoolSchedulePreviewError(createRequestError(404, "ai schedule preview not found")), true);
  assert.equal(isMissingSchoolScheduleOperationError(createRequestError(404, "ai schedule operation not found")), true);
  assert.equal(isMissingSchoolScheduleSessionError(createRequestError(400, "bad request")), false);
});
