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
  if (request === "@/lib/constants") {
    return path.resolve(__dirname, "../../lib/constants.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getStudentFavoriteRemoveRequestMessage,
  getStudentFavoritesRequestMessage,
  getStudentFavoriteSaveRequestMessage,
  resolveStudentFavoritesSelectedTag,
  resolveStudentFavoritesSubjectFilter
} = require("../../app/student/favorites/utils") as typeof import("../../app/student/favorites/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student favorites helpers map auth expiry copy by request type", () => {
  assert.equal(
    getStudentFavoritesRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看收藏夹。"
  );
  assert.equal(
    getStudentFavoriteSaveRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续保存收藏信息。"
  );
  assert.equal(
    getStudentFavoriteRemoveRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续整理收藏夹。"
  );
});

test("student favorites helpers keep active subject and tag filters only when the next snapshot still supports them", () => {
  const favorites = [
    {
      id: "favorite-1",
      questionId: "question-1",
      tags: ["易错", "口算"],
      updatedAt: "2026-03-17T08:00:00.000Z",
      question: {
        id: "question-1",
        stem: "2 + 3 = ?",
        subject: "math",
        grade: "3",
        knowledgePointTitle: "加法"
      }
    },
    {
      id: "favorite-2",
      questionId: "question-2",
      tags: ["作文"],
      updatedAt: "2026-03-17T09:00:00.000Z",
      question: {
        id: "question-2",
        stem: "描述春天",
        subject: "chinese",
        grade: "3",
        knowledgePointTitle: "写作"
      }
    }
  ];

  assert.equal(resolveStudentFavoritesSubjectFilter(favorites, "math"), "math");
  assert.equal(resolveStudentFavoritesSubjectFilter(favorites, "english"), "all");
  assert.equal(resolveStudentFavoritesSubjectFilter(favorites, "all"), "all");

  assert.equal(resolveStudentFavoritesSelectedTag(favorites, "作文"), "作文");
  assert.equal(resolveStudentFavoritesSelectedTag(favorites, "几何"), "");
  assert.equal(resolveStudentFavoritesSelectedTag(favorites, ""), "");
});
