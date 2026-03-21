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
  applyStudentFavoriteSave,
  buildStudentFavoriteSavePayload,
  getFilteredStudentFavorites,
  getStudentFavoriteRemoveRequestMessage,
  getStudentFavoritesRequestMessage,
  getStudentFavoriteSaveRequestMessage,
  getStudentFavoritesSubjectOptions,
  getStudentFavoritesTopTags,
  removeStudentFavorite,
  resolveStudentFavoritesActiveFilters,
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
  assert.deepEqual(resolveStudentFavoritesActiveFilters(favorites, "english", "作文"), {
    subjectFilter: "all",
    selectedTag: "作文"
  });
});

test("student favorites helpers derive subject options, top tags, and filtered favorites deterministically", () => {
  const favorites = [
    {
      id: "favorite-1",
      questionId: "question-1",
      tags: ["易错", "口算"],
      note: "重做一次",
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
    },
    {
      id: "favorite-3",
      questionId: "question-3",
      tags: ["易错"],
      updatedAt: "2026-03-17T10:00:00.000Z",
      question: {
        id: "question-3",
        stem: "3 + 4 = ?",
        subject: "math",
        grade: "3",
        knowledgePointTitle: "加法"
      }
    }
  ];

  assert.deepEqual(getStudentFavoritesSubjectOptions(favorites), ["math", "chinese"]);
  assert.deepEqual(getStudentFavoritesTopTags(favorites), [
    ["易错", 2],
    ["口算", 1],
    ["作文", 1]
  ]);
  assert.deepEqual(
    getFilteredStudentFavorites(favorites, "加法", "易错", "math").map((item) => item.questionId),
    ["question-3", "question-1"]
  );
});

test("student favorites helpers normalize save payloads and local snapshot updates", () => {
  const favorites = [
    {
      id: "favorite-1",
      questionId: "question-1",
      tags: ["旧标签"],
      note: "旧备注",
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

  assert.deepEqual(buildStudentFavoriteSavePayload(" 易错，口算，易错 ", "  重新复习  "), {
    tags: ["易错", "口算"],
    note: "重新复习"
  });
  assert.deepEqual(
    applyStudentFavoriteSave(favorites, "question-1", ["易错"], undefined, "2026-03-18T08:00:00.000Z"),
    [
      {
        ...favorites[0],
        tags: ["易错"],
        note: undefined,
        updatedAt: "2026-03-18T08:00:00.000Z"
      },
      favorites[1]
    ]
  );
  assert.deepEqual(removeStudentFavorite(favorites, "question-1"), [favorites[1]]);
});
