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
  getReportPageDerivedState,
  getVisibleKnowledgeItems,
  getReportProfileRequestMessage,
  getWeeklyReportRequestMessage,
  resolveReportChapterFilter,
  resolveReportSubjectFilter
} = require("../../app/report/utils") as typeof import("../../app/report/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("report helpers map auth expiry to localized messages", () => {
  assert.equal(
    getWeeklyReportRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看学习周报。"
  );
  assert.equal(
    getReportProfileRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看学习画像。"
  );
});

test("report filter helpers prune stale subject and chapter selections", () => {
  const profile = {
    student: { id: "student-1", name: "Ada" },
    subjects: [
      {
        subject: "math",
        label: "数学",
        practiced: 2,
        total: 2,
        avgRatio: 70,
        items: [
          {
            id: "kp-1",
            title: "分数加减",
            chapter: "分数",
            unit: "上册",
            correct: 7,
            total: 10,
            ratio: 70
          }
        ]
      },
      {
        subject: "english",
        label: "英语",
        practiced: 1,
        total: 1,
        avgRatio: 90,
        items: [
          {
            id: "kp-2",
            title: "一般现在时",
            chapter: "语法",
            unit: "上册",
            correct: 9,
            total: 10,
            ratio: 90
          }
        ]
      }
    ]
  };

  assert.equal(resolveReportSubjectFilter(profile, "math"), "math");
  assert.equal(resolveReportSubjectFilter(profile, "science"), "all");
  assert.equal(resolveReportSubjectFilter(null, "english"), "all");
  assert.equal(resolveReportChapterFilter(profile.subjects, "语法"), "语法");
  assert.equal(resolveReportChapterFilter(profile.subjects, "几何"), "all");
  assert.equal(resolveReportChapterFilter([], "分数"), "all");
});

test("report helpers derive page filter state and chapter options consistently", () => {
  const profile = {
    student: { id: "student-1", name: "Ada" },
    subjects: [
      {
        subject: "math",
        label: "数学",
        practiced: 2,
        total: 2,
        avgRatio: 70,
        items: [
          {
            id: "kp-1",
            title: "分数加减",
            chapter: "分数",
            unit: "上册",
            correct: 7,
            total: 10,
            ratio: 70
          }
        ]
      },
      {
        subject: "english",
        label: "英语",
        practiced: 1,
        total: 1,
        avgRatio: 90,
        items: [
          {
            id: "kp-2",
            title: "一般现在时",
            chapter: "语法",
            unit: "上册",
            correct: 9,
            total: 10,
            ratio: 90
          }
        ]
      }
    ]
  };

  const derived = getReportPageDerivedState({
    profile,
    subjectFilter: "english",
    chapterFilter: "分数"
  });

  assert.equal(derived.profileData, profile);
  assert.equal(derived.resolvedSubjectFilter, "english");
  assert.equal(derived.resolvedChapterFilter, "all");
  assert.deepEqual(derived.chapterOptions, ["语法"]);
  assert.deepEqual(
    derived.displaySubjects.map((group) => group.subject),
    ["english"]
  );
});

test("report helpers filter and sort visible knowledge items deterministically", () => {
  const items = [
    { id: "kp-1", title: "A", chapter: "分数", unit: "上册", correct: 4, total: 10, ratio: 40 },
    { id: "kp-2", title: "B", chapter: "分数", unit: "上册", correct: 9, total: 12, ratio: 75 },
    { id: "kp-3", title: "C", chapter: "几何", unit: "下册", correct: 5, total: 20, ratio: 25 }
  ];

  assert.deepEqual(
    getVisibleKnowledgeItems(items, "all", "ratio-asc").map((item) => item.id),
    ["kp-3", "kp-1", "kp-2"]
  );
  assert.deepEqual(
    getVisibleKnowledgeItems(items, "分数", "total-desc").map((item) => item.id),
    ["kp-2", "kp-1"]
  );
});
