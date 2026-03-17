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
  getPracticeExplainRequestMessage,
  getPracticeFavoriteRequestMessage,
  getPracticeKnowledgePointsRequestMessage,
  getPracticeNextQuestionRequestMessage,
  getPracticeSubmitRequestMessage,
  getPracticeVariantRequestMessage,
  isPracticeNoQuestionsError,
  isPracticeQuestionMissingError,
  resolvePracticeKnowledgePointId
} = require("../../app/practice/utils") as typeof import("../../app/practice/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("practice helpers map auth, empty question, and stale question errors", () => {
  assert.equal(
    getPracticeKnowledgePointsRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续加载知识点。"
  );
  assert.equal(
    getPracticeNextQuestionRequestMessage(createRequestError(404, "no questions"), {
      mode: "review",
      knowledgePointId: undefined
    }),
    "当前还没有到期的复练题目，可先做普通练习或错题练习。"
  );
  assert.equal(
    getPracticeSubmitRequestMessage(createRequestError(404, "question not found"), "fallback"),
    "当前题目已失效，请重新获取新题后继续练习。"
  );
  assert.equal(
    getPracticeExplainRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续生成 AI 讲解。"
  );
  assert.equal(
    getPracticeFavoriteRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续处理收藏。"
  );
  assert.equal(
    getPracticeVariantRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续生成变式训练。"
  );
  assert.equal(isPracticeNoQuestionsError(createRequestError(404, "no questions")), true);
  assert.equal(isPracticeQuestionMissingError(createRequestError(404, "not found")), true);
});

test("practice helpers clear stale knowledge point selection", () => {
  const knowledgePoints = [{ id: "kp-1" }, { id: "kp-2" }];

  assert.equal(resolvePracticeKnowledgePointId(knowledgePoints, "kp-2"), "kp-2");
  assert.equal(resolvePracticeKnowledgePointId(knowledgePoints, "missing-kp"), undefined);
  assert.equal(resolvePracticeKnowledgePointId([], "kp-1"), undefined);
});
