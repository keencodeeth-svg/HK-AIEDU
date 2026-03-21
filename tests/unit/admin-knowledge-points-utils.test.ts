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
  buildAdminKnowledgePointsSearchParams,
  formatKnowledgePointBatchPreviewError,
  getAdminKnowledgePointsDerivedState,
  getAdminKnowledgePointsErrorMessage,
  isKnowledgePointMissingError,
  mergeKnowledgePointBatchPreviewItems,
  removeKnowledgePointSnapshot,
  resolveKnowledgePointChapter,
  resolveKnowledgePointChapterOptions
} = require("../../app/admin/knowledge-points/utils") as typeof import("../../app/admin/knowledge-points/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("admin knowledge point helpers map auth and missing-item errors", () => {
  assert.equal(
    getAdminKnowledgePointsErrorMessage(createRequestError(401, "unauthorized"), "fallback"),
    "管理员会话已失效，请重新登录后继续操作。"
  );
  assert.equal(
    getAdminKnowledgePointsErrorMessage(createRequestError(400, "items required"), "fallback"),
    "没有可导入的知识树内容，请先生成预览后再入库。"
  );
  assert.equal(isKnowledgePointMissingError(createRequestError(404, "not found")), true);
  assert.equal(isKnowledgePointMissingError(createRequestError(404, "knowledge point not found")), false);
});

test("admin knowledge point helpers build filters and normalize chapter selection", () => {
  assert.equal(
    buildAdminKnowledgePointsSearchParams(
      {
        subject: "math",
        grade: "4",
        unit: "第一单元",
        chapter: "分数",
        search: " 分数意义 "
      },
      2,
      50
    ).toString(),
    "subject=math&grade=4&unit=%E7%AC%AC%E4%B8%80%E5%8D%95%E5%85%83&chapter=%E5%88%86%E6%95%B0&search=%E5%88%86%E6%95%B0%E6%84%8F%E4%B9%89&page=2&pageSize=50"
  );

  const chapterOptions = resolveKnowledgePointChapterOptions(
    [
      { id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" },
      { id: "kp-2", subject: "math", grade: "4", title: "分数减法", chapter: "分数" },
      { id: "kp-3", subject: "math", grade: "4", title: "小数乘法", chapter: "小数" },
      { id: "kp-4", subject: "english", grade: "4", title: "一般现在时", chapter: "语法" }
    ],
    "math",
    "4"
  );

  assert.deepEqual(chapterOptions, ["分数", "小数"]);
  assert.equal(resolveKnowledgePointChapter(chapterOptions, "分数"), "分数");
  assert.equal(resolveKnowledgePointChapter(chapterOptions, "旧章节"), "分数");
  assert.equal(resolveKnowledgePointChapter([], "旧章节"), "");
});

test("admin knowledge point helpers merge preview chunks and summarize failures", () => {
  assert.deepEqual(
    mergeKnowledgePointBatchPreviewItems([
      { subject: "math", grade: "4", units: [{ title: "单元一", chapters: [] }] },
      { subject: "english", grade: "5", units: [{ title: "Unit 1", chapters: [] }] },
      { subject: "math", grade: "4", units: [{ title: "单元二", chapters: [] }] }
    ]),
    [
      { subject: "math", grade: "4", units: [{ title: "单元二", chapters: [] }] },
      { subject: "english", grade: "5", units: [{ title: "Unit 1", chapters: [] }] }
    ]
  );
  assert.equal(
    formatKnowledgePointBatchPreviewError([
      { subject: "math", grade: "4", reason: "超时" },
      { subject: "english", grade: "5", reason: "配额不足" }
    ]),
    "数学4年级：超时；英语5年级：配额不足"
  );
  assert.equal(formatKnowledgePointBatchPreviewError([]), null);
});

test("admin knowledge point helpers derive chapter fallback, load error, and page ranges", () => {
  assert.deepEqual(
    getAdminKnowledgePointsDerivedState({
      allKnowledgePoints: [
        { id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" },
        { id: "kp-2", subject: "math", grade: "4", title: "小数乘法", chapter: "小数" },
        { id: "kp-3", subject: "english", grade: "4", title: "一般现在时", chapter: "语法" }
      ],
      aiForm: { subject: "math", grade: "4", chapter: "旧章节", count: 5 },
      meta: { total: 45, page: 2, pageSize: 20, totalPages: 3 },
      allKnowledgePointsLoadError: "全集失败",
      knowledgePointListLoadError: "列表失败"
    }),
    {
      chapterOptions: ["分数", "小数"],
      resolvedAiChapter: "分数",
      loadError: "列表失败",
      pageStart: 21,
      pageEnd: 40
    }
  );
});

test("admin knowledge point helpers remove stale list snapshot without corrupting pagination", () => {
  assert.deepEqual(
    removeKnowledgePointSnapshot(
      [{ id: "kp-2", subject: "math", grade: "4", title: "分数减法", chapter: "分数" }],
      [
        { id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" },
        { id: "kp-2", subject: "math", grade: "4", title: "分数减法", chapter: "分数" }
      ],
      { total: 2, page: 2, pageSize: 1, totalPages: 2 },
      "kp-2"
    ),
    {
      list: [],
      allKnowledgePoints: [{ id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" }],
      meta: { total: 1, page: 1, pageSize: 1, totalPages: 1 }
    }
  );

  assert.deepEqual(
    removeKnowledgePointSnapshot(
      [{ id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" }],
      [{ id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" }],
      { total: 1, page: 1, pageSize: 20, totalPages: 1 },
      "missing-kp"
    ),
    {
      list: [{ id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" }],
      allKnowledgePoints: [{ id: "kp-1", subject: "math", grade: "4", title: "分数加法", chapter: "分数" }],
      meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 }
    }
  );
});
