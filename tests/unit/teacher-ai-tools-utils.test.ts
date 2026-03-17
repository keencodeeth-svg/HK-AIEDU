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
  getTeacherAiToolsRequestMessage,
  isMissingTeacherAiToolsClassError,
  isMissingTeacherAiToolsQuestionError,
  resolveTeacherAiToolsClassId
} = require("../../app/teacher/ai-tools/utils") as typeof import("../../app/teacher/ai-tools/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher ai tools helpers map auth and business validation errors", () => {
  assert.equal(
    getTeacherAiToolsRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续使用 AI 工具。"
  );
  assert.equal(
    getTeacherAiToolsRequestMessage(createRequestError(400, "missing fields"), "fallback", "question_check"),
    "请先补全题干、选项和答案后再做纠错检查。"
  );
  assert.equal(
    getTeacherAiToolsRequestMessage(
      createRequestError(400, "body.items must contain at least 1 items"),
      "fallback",
      "review_pack_dispatch"
    ),
    "请至少选择 1 条复练单后再下发。"
  );
});

test("teacher ai tools helpers distinguish missing class from missing question", () => {
  const missingError = createRequestError(404, "not found");

  assert.equal(
    getTeacherAiToolsRequestMessage(missingError, "fallback", "paper"),
    "当前班级不存在，或你已失去该班级的操作权限。"
  );
  assert.equal(
    getTeacherAiToolsRequestMessage(missingError, "fallback", "question_check"),
    "当前题目不存在，请刷新题库后重试。"
  );
  assert.equal(isMissingTeacherAiToolsClassError(missingError), true);
  assert.equal(isMissingTeacherAiToolsQuestionError(missingError), true);
  assert.equal(isMissingTeacherAiToolsClassError(createRequestError(400, "missing fields")), false);
});

test("resolveTeacherAiToolsClassId falls back to the first available class", () => {
  const classes = [
    { id: "class-a" },
    { id: "class-b" }
  ];

  assert.equal(resolveTeacherAiToolsClassId("class-b", classes), "class-b");
  assert.equal(resolveTeacherAiToolsClassId("missing-class", classes), "class-a");
  assert.equal(resolveTeacherAiToolsClassId("", classes), "class-a");
  assert.equal(resolveTeacherAiToolsClassId("missing-class", []), "");
});
