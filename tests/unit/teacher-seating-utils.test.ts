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
  if (request === "@/lib/seat-plan-utils") {
    return path.resolve(__dirname, "../../lib/seat-plan-utils.js");
  }
  if (request === "@/lib/student-persona-options") {
    return path.resolve(__dirname, "../../lib/student-persona-options.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getTeacherSeatingRequestMessage,
  isMissingTeacherSeatingClassError
} = require("../../app/teacher/seating/utils") as typeof import("../../app/teacher/seating/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("getTeacherSeatingRequestMessage maps teacher seating business errors", () => {
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "duplicate locked seat student"), "fallback"),
    "同一名学生不能被分配到多个座位。"
  );
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "body.rows must be <= 12"), "fallback"),
    "排座行列数需在 1 到 12 之间。"
  );
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "locked seat position out of range"), "fallback"),
    "座位位置超出当前排座网格，请重新调整。"
  );
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(400, "body.lockedSeats[0].studentId cannot be empty"), "fallback"),
    "锁定座位时必须保留学生信息。"
  );
});

test("teacher seating helpers distinguish auth expiry from missing class", () => {
  assert.equal(
    getTeacherSeatingRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续配置学期排座。"
  );
  assert.equal(isMissingTeacherSeatingClassError(createRequestError(404, "class not found")), true);
  assert.equal(isMissingTeacherSeatingClassError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherSeatingClassError(createRequestError(400, "duplicate seat position")), false);
});
