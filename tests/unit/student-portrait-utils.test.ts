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
  if (request === "@/lib/tutor-launch") {
    return path.resolve(__dirname, "../../lib/tutor-launch.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  buildPracticeHref,
  getRecentStudyVariantSummary,
  getStudentPortraitPageDerivedState,
  getStudentPortraitRequestMessage
} = require("../../app/student/portrait/utils") as typeof import("../../app/student/portrait/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student portrait helpers map auth expiry copy", () => {
  assert.equal(
    getStudentPortraitRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看学习画像。"
  );
  assert.equal(
    getStudentPortraitRequestMessage(createRequestError(500, "server exploded"), "fallback"),
    "server exploded"
  );
});

test("student portrait helpers derive stage, action plan, and tutor reuse state", () => {
  const derived = getStudentPortraitPageDerivedState({
    abilities: [
      { id: "ability-1", label: "计算", correct: 8, total: 10, score: 80 },
      { id: "ability-2", label: "建模", correct: 4, total: 10, score: 40 }
    ],
    mastery: {
      averageMasteryScore: 72,
      averageConfidenceScore: 68,
      averageTrend7d: 6,
      trackedKnowledgePoints: 12,
      weakKnowledgePoints: [
        {
          knowledgePointId: "kp-1",
          title: "分数乘法",
          subject: "math",
          masteryScore: 45,
          masteryLevel: "weak",
          confidenceScore: 55,
          recencyWeight: 0.8,
          masteryTrend7d: -4,
          weaknessRank: 1,
          correct: 3,
          total: 8,
          lastAttemptAt: "2026-03-20T10:00:00.000Z"
        }
      ],
      subjects: [],
      recentStudyVariantActivity: {
        recentAttemptCount: 5,
        recentCorrectCount: 3,
        latestAttemptAt: "2026-03-20T10:30:00.000Z",
        latestKnowledgePointId: "kp-2",
        latestKnowledgePointTitle: "分数除法",
        latestSubject: "math",
        latestCorrect: false,
        masteryScore: 52,
        masteryLevel: "developing",
        weaknessRank: 2
      }
    },
    loading: false
  });

  assert.equal(derived.lowestAbility?.label, "建模");
  assert.equal(derived.trackedKnowledgePoints, 12);
  assert.equal(derived.weakKnowledgePointCount, 1);
  assert.equal(derived.hasPortraitData, true);
  assert.equal(
    derived.stageCopy.title,
    "当前有 1 个优先补强知识点"
  );
  assert.equal(
    derived.recentStudyVariantSummary,
    "最近一轮 Tutor 变式巩固暴露出「分数除法」还不稳，当前掌握 52 分。"
  );
  assert.equal(
    derived.portraitActionPlan.title,
    "先把「分数除法」迁到正式练习"
  );
  assert.equal(
    derived.recentStudyPracticeHref,
    "/practice?subject=math&knowledgePointId=kp-2"
  );
  assert.equal(
    derived.overviewPrimaryHref,
    "/practice?subject=math&knowledgePointId=kp-1"
  );
  assert.equal(derived.overviewSecondaryLabel, "去 Tutor 追问");
  assert.equal(derived.recentStudyTutorHref.includes("/tutor?"), true);
  assert.equal(derived.polygonPoints.length > 0, true);
});

test("student portrait helpers fall back to generic practice and wrong-book actions", () => {
  const derived = getStudentPortraitPageDerivedState({
    abilities: [],
    mastery: null,
    loading: false
  });

  assert.equal(derived.hasPortraitData, false);
  assert.equal(
    derived.stageCopy.title,
    "当前还没有足够的学习画像数据"
  );
  assert.equal(derived.portraitActionPlan.primaryHref, "/practice");
  assert.equal(derived.overviewPrimaryHref, "/practice");
  assert.equal(derived.overviewSecondaryHref, "/wrong-book");
  assert.equal(derived.overviewSecondaryLabel, "去错题本");
  assert.equal(getRecentStudyVariantSummary(null), null);
  assert.equal(buildPracticeHref({ subject: " math ", knowledgePointId: " kp-1 " }), "/practice?subject=math&knowledgePointId=kp-1");
});
