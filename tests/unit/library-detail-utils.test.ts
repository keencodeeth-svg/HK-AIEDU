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
  getLibraryDetailRequestMessage,
  isMissingLibraryItemError,
  resolveLibrarySelectedKnowledgePointIds
} = require("../../app/library/detail-utils") as typeof import("../../app/library/detail-utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("library detail helpers map auth, missing item, and validation errors", () => {
  assert.equal(
    getLibraryDetailRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后再查看资料。"
  );
  assert.equal(
    getLibraryDetailRequestMessage(createRequestError(404, "not found"), "fallback"),
    "资料不存在，或当前账号无权访问。"
  );
  assert.equal(
    getLibraryDetailRequestMessage(createRequestError(400, "knowledgePointIds required"), "fallback"),
    "请至少选择一个知识点后再保存。"
  );
  assert.equal(isMissingLibraryItemError(createRequestError(404, "not found")), true);
});

test("library detail helpers prune stale selected knowledge points", () => {
  const item = {
    subject: "math" as const,
    grade: "4",
    knowledgePointIds: ["kp-1", "kp-3"]
  };
  const knowledgePoints = [
    { id: "kp-1", subject: "math" as const, grade: "4" },
    { id: "kp-2", subject: "math" as const, grade: "4" },
    { id: "kp-9", subject: "english" as const, grade: "4" }
  ];

  assert.deepEqual(resolveLibrarySelectedKnowledgePointIds(item, knowledgePoints, ["kp-2", "kp-9"]), ["kp-2"]);
  assert.deepEqual(resolveLibrarySelectedKnowledgePointIds(item, knowledgePoints, []), ["kp-1"]);
  assert.deepEqual(resolveLibrarySelectedKnowledgePointIds(null, knowledgePoints, ["kp-2"]), []);
});
