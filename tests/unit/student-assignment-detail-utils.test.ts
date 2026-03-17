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
  getStudentAssignmentDetailRequestMessage,
  getStudentAssignmentReviewRequestMessage,
  getStudentAssignmentUploadRequestMessage,
  isMissingStudentAssignmentDetailError
} = require("../../app/student/assignments/[id]/utils") as typeof import("../../app/student/assignments/[id]/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student assignment detail helpers map auth, missing resource, and submit validation errors", () => {
  assert.equal(
    getStudentAssignmentDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看作业。"
  );
  assert.equal(
    getStudentAssignmentDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "作业不存在，或你当前账号无权查看这份作业。"
  );
  assert.equal(
    getStudentAssignmentDetailRequestMessage(createRequestError(400, "请填写作文内容或上传作业图片"), "fallback"),
    "请先填写作文内容，或至少上传 1 份作业图片后再提交。"
  );
  assert.equal(isMissingStudentAssignmentDetailError(createRequestError(404, "not found")), true);
});

test("student assignment detail helpers map review and upload request errors", () => {
  assert.equal(
    getStudentAssignmentReviewRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看老师反馈。"
  );
  assert.equal(
    getStudentAssignmentUploadRequestMessage(createRequestError(400, "单个文件不能超过 3MB"), "fallback"),
    "单个文件大小不能超过 3MB。"
  );
  assert.equal(
    getStudentAssignmentUploadRequestMessage(createRequestError(400, "missing uploadId"), "fallback"),
    "未找到要删除的上传文件，请刷新列表后重试。"
  );
});
