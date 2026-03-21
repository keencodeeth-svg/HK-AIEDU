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
  buildAdminQuestionCreateRequest,
  buildAdminQuestionGenerateRequest,
  buildAdminQuestionsMeta,
  getAdminQuestionsPageDerivedState,
  buildAdminQuestionsRecheckPayload,
  buildAdminQuestionsSearchParams,
  buildQuestionImportItems,
  filterAdminQuestionsKnowledgePoints,
  formatAdminQuestionsRecheckMessage,
  getAdminQuestionsErrorMessage,
  getAdminQuestionsChapterOptions,
  getAdminQuestionsMetaAfterRemoval,
  getAdminQuestionsPageRange,
  isAdminQuestionKnowledgePointSelectionError,
  isAdminQuestionMissingError,
  isHighRiskQuestionQualityResult,
  normalizeAdminQuestionsFacets,
  parseCsv,
  resolveAdminQuestionsFormSelections,
  resolveAdminQuestionKnowledgePointId
} = require("../../app/admin/questions/utils") as typeof import("../../app/admin/questions/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("admin question helper keeps only knowledge points matching subject and grade", () => {
  const knowledgePoints = [
    { id: "kp-1", subject: "math", grade: "4" },
    { id: "kp-2", subject: "math", grade: "5" },
    { id: "kp-3", subject: "english", grade: "4" }
  ];

  assert.equal(resolveAdminQuestionKnowledgePointId(knowledgePoints, "math", "4", "kp-1"), "kp-1");
  assert.equal(resolveAdminQuestionKnowledgePointId(knowledgePoints, "math", "4", "kp-2"), "");
  assert.equal(resolveAdminQuestionKnowledgePointId(knowledgePoints, "math", "4", "kp-3"), "");
  assert.equal(resolveAdminQuestionKnowledgePointId(knowledgePoints, "math", "4", "missing-kp"), "");
  assert.equal(resolveAdminQuestionKnowledgePointId(knowledgePoints, "math", "4", ""), "");
});

test("admin question helpers derive scoped knowledge points, chapter options, and fallback selections", () => {
  const knowledgePoints = [
    { id: "kp-1", subject: "math", grade: "4", title: "分数的意义", chapter: "分数" },
    { id: "kp-2", subject: "math", grade: "4", title: "分数比较", chapter: "分数" },
    { id: "kp-3", subject: "math", grade: "4", title: "三角形面积", chapter: "几何" },
    { id: "kp-4", subject: "math", grade: "5", title: "小数意义", chapter: "小数" }
  ];
  const formKnowledgePoints = filterAdminQuestionsKnowledgePoints(knowledgePoints, "math", "4");
  const chapterOptions = getAdminQuestionsChapterOptions(knowledgePoints, "math", "4");

  assert.deepEqual(formKnowledgePoints, [
    { id: "kp-1", subject: "math", grade: "4", title: "分数的意义", chapter: "分数" },
    { id: "kp-2", subject: "math", grade: "4", title: "分数比较", chapter: "分数" },
    { id: "kp-3", subject: "math", grade: "4", title: "三角形面积", chapter: "几何" }
  ]);
  assert.deepEqual(chapterOptions, ["分数", "几何"]);
  assert.deepEqual(
    resolveAdminQuestionsFormSelections({
      form: { subject: "math", grade: "4", knowledgePointId: "missing-kp" },
      aiForm: {
        subject: "math",
        grade: "4",
        knowledgePointId: "kp-4",
        mode: "batch",
        chapter: "不存在的章节"
      },
      formKnowledgePoints,
      aiKnowledgePoints: formKnowledgePoints,
      chapterOptions
    }),
    {
      nextFormKnowledgePointId: "kp-1",
      nextAiKnowledgePointId: "kp-1",
      nextAiChapter: "分数"
    }
  );
});

test("admin question helpers parse import rows and query params consistently", () => {
  const rows = parseCsv(
    'subject,grade,knowledgePointId,knowledgePointTitle,stem,options,answer,explanation,difficulty,questionType,tags,abilities\n' +
      '"math","4","","分数的意义","题干","A|B","A","解析","medium","choice","tag1|tag2","ability1"\n' +
      '"math","4","","缺失知识点","题干二","A|B","B","解析","hard","choice","",""\n'
  );
  const result = buildQuestionImportItems(rows, [
    { id: "kp-1", title: "分数的意义", subject: "math" }
  ]);

  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    subject: "math",
    grade: "4",
    knowledgePointId: "kp-1",
    stem: "题干",
    options: ["A", "B"],
    answer: "A",
    explanation: "解析",
    difficulty: "medium",
    questionType: "choice",
    tags: ["tag1", "tag2"],
    abilities: ["ability1"]
  });
  assert.deepEqual(result.errors, ["第 3 行：找不到知识点"]);

  assert.equal(
    buildAdminQuestionsSearchParams(
      {
        subject: "math",
        grade: "4",
        chapter: "分数",
        difficulty: "medium",
        questionType: "choice",
        search: " 分数 ",
        pool: "active",
        riskLevel: "high",
        answerConflict: "yes",
        duplicateClusterId: " cluster-1 "
      },
      2,
      50
    ).toString(),
    "subject=math&grade=4&chapter=%E5%88%86%E6%95%B0&difficulty=medium&questionType=choice&search=%E5%88%86%E6%95%B0&pool=active&riskLevel=high&answerConflict=yes&duplicateClusterId=cluster-1&page=2&pageSize=50"
  );
});

test("admin question helpers build generate, create, and recheck payloads deterministically", () => {
  assert.deepEqual(
    buildAdminQuestionGenerateRequest({
      subject: "math",
      grade: "4",
      knowledgePointId: "kp-1",
      count: 3,
      difficulty: "medium",
      mode: "single",
      chapter: ""
    }),
    {
      endpoint: "/api/admin/questions/generate",
      payload: {
        subject: "math",
        grade: "4",
        knowledgePointId: "kp-1",
        count: 3,
        difficulty: "medium"
      }
    }
  );
  assert.deepEqual(
    buildAdminQuestionGenerateRequest({
      subject: "math",
      grade: "5",
      knowledgePointId: "",
      count: 6,
      difficulty: "hard",
      mode: "batch",
      chapter: "小数"
    }),
    {
      endpoint: "/api/admin/questions/generate-batch",
      payload: {
        subject: "math",
        grade: "5",
        count: 10,
        chapter: "小数",
        difficulty: "hard"
      }
    }
  );

  assert.deepEqual(
    buildAdminQuestionCreateRequest({
      subject: "math",
      grade: "4",
      knowledgePointId: "kp-1",
      stem: "题干",
      options: "A\nB",
      answer: "A",
      explanation: "解析",
      difficulty: "medium",
      questionType: "choice",
      tags: "tag1|tag2",
      abilities: "ability1, ability2"
    }),
    {
      payload: {
        subject: "math",
        grade: "4",
        knowledgePointId: "kp-1",
        stem: "题干",
        options: ["A", "B"],
        answer: "A",
        explanation: "解析",
        difficulty: "medium",
        questionType: "choice",
        tags: ["tag1", "tag2"],
        abilities: ["ability1", "ability2"]
      },
      nextForm: {
        subject: "math",
        grade: "4",
        knowledgePointId: "kp-1",
        stem: "",
        options: "",
        answer: "",
        explanation: "",
        difficulty: "medium",
        questionType: "choice",
        tags: "",
        abilities: ""
      }
    }
  );

  assert.deepEqual(
    buildAdminQuestionsRecheckPayload({
      subject: "math",
      grade: "4",
      chapter: "all",
      difficulty: "all",
      questionType: "all",
      search: "",
      pool: "active",
      riskLevel: "all",
      answerConflict: "all",
      duplicateClusterId: ""
    }),
    {
      limit: 1000,
      subject: "math",
      grade: "4",
      includeIsolated: false
    }
  );
  assert.equal(
    formatAdminQuestionsRecheckMessage({
      scope: { processedCount: 8 },
      summary: { newlyTracked: 3, updated: 2, highRiskCount: 1, isolatedCount: 4 }
    }),
    "已重算 8 题（新增质检 3，变更 2，高风险 1，隔离池 4）。"
  );
});

test("admin question helpers normalize meta, facets, and page ranges consistently", () => {
  assert.deepEqual(buildAdminQuestionsMeta(undefined, 6, 2, 20), {
    total: 6,
    page: 2,
    pageSize: 20,
    totalPages: 1
  });
  assert.deepEqual(
    normalizeAdminQuestionsFacets({
      subjects: [{ value: "math", count: 12 }]
    }),
    {
      subjects: [{ value: "math", count: 12 }],
      grades: [],
      chapters: [],
      difficulties: [],
      questionTypes: []
    }
  );
  assert.deepEqual(
    getAdminQuestionsMetaAfterRemoval({
      total: 21,
      page: 2,
      pageSize: 20,
      totalPages: 2
    }),
    {
      total: 20,
      page: 1,
      pageSize: 20,
      totalPages: 1
    }
  );
  assert.deepEqual(
    getAdminQuestionsPageRange({
      total: 47,
      page: 2,
      pageSize: 20,
      totalPages: 3
    }),
    {
      start: 21,
      end: 40
    }
  );
});

test("admin question helpers derive page state consistently", () => {
  const knowledgePoints = [
    { id: "kp-1", subject: "math", grade: "4", title: "分数的意义", chapter: "分数" },
    { id: "kp-2", subject: "math", grade: "4", title: "三角形面积", chapter: "几何" },
    { id: "kp-3", subject: "english", grade: "4", title: "阅读理解", chapter: "阅读" }
  ];

  assert.deepEqual(
    getAdminQuestionsPageDerivedState({
      knowledgePoints,
      form: { subject: "math", grade: "4" },
      aiForm: { subject: "english", grade: "4" },
      meta: {
        total: 47,
        page: 2,
        pageSize: 20,
        totalPages: 3
      },
      knowledgePointsLoadError: "知识点加载失败",
      questionsLoadError: null
    }),
    {
      formKnowledgePoints: [
        { id: "kp-1", subject: "math", grade: "4", title: "分数的意义", chapter: "分数" },
        { id: "kp-2", subject: "math", grade: "4", title: "三角形面积", chapter: "几何" }
      ],
      aiKnowledgePoints: [
        { id: "kp-3", subject: "english", grade: "4", title: "阅读理解", chapter: "阅读" }
      ],
      chapterOptions: ["阅读"],
      loadError: "知识点加载失败",
      pageStart: 21,
      pageEnd: 40
    }
  );
});

test("admin question helpers map errors and risk classification predictably", () => {
  assert.equal(isAdminQuestionMissingError(createRequestError(404, "question not found")), true);
  assert.equal(isAdminQuestionKnowledgePointSelectionError(createRequestError(400, "knowledge point mismatch")), true);
  assert.equal(
    getAdminQuestionsErrorMessage(createRequestError(400, "no questions to recheck"), "fallback"),
    "当前范围内没有可重算的题目，请调整范围后重试。"
  );
  assert.equal(
    getAdminQuestionsErrorMessage(createRequestError(401, "unauthorized"), "fallback"),
    "管理员会话已失效，请重新登录后继续操作。"
  );
  assert.equal(
    isHighRiskQuestionQualityResult({
      id: "q-1",
      qualityScore: 70,
      duplicateRisk: "high",
      ambiguityRisk: "low",
      answerConsistency: 0.9,
      duplicateClusterId: null,
      answerConflict: false,
      riskLevel: "medium",
      isolated: false
    }),
    true
  );
});
