import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/constants") {
    return path.resolve(__dirname, "../../lib/constants.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { normalizeCreateErrorMessage } = require("../../app/teacher/exams/create/utils") as typeof import("../../app/teacher/exams/create/utils");
Module._resolveFilename = originalResolveFilename;

test("normalizeCreateErrorMessage maps teacher exam create business errors", () => {
  assert.equal(
    normalizeCreateErrorMessage("questionIds contains invalid item"),
    "所选题目中包含无效题目，请刷新题库后重新选择。"
  );
  assert.equal(
    normalizeCreateErrorMessage("questionIds must match class subject and grade"),
    "所选题目与当前班级的学科或年级不匹配，请重新选择。"
  );
  assert.equal(
    normalizeCreateErrorMessage("body.studentIds must contain at least 1 items"),
    "定向发布至少需要选择 1 名学生。"
  );
  assert.equal(
    normalizeCreateErrorMessage("题库数量不足，无法生成考试"),
    "当前题库数量不足，无法按现有条件生成考试。"
  );
});

test("normalizeCreateErrorMessage preserves isolated pool warning with punctuation", () => {
  assert.equal(
    normalizeCreateErrorMessage("题目包含隔离池高风险题（2 题），请先移除或显式开启 includeIsolated"),
    "题目包含隔离池高风险题（2 题），请先移除或显式开启 includeIsolated。"
  );
});
