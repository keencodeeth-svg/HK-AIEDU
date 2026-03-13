import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStudyVariantReflection } from "../../lib/ai-study-reflection";

test("study reflection marks perfect transfer drills as secure", () => {
  const reflection = buildStudyVariantReflection({
    subject: "math",
    knowledgePointTitle: "分数加法",
    variants: [
      {
        stem: "1/2 + 1/2 等于多少？",
        answer: "1",
        explanation: "先看分母相同，可以直接相加。",
        studentAnswer: "1"
      },
      {
        stem: "2/5 + 1/5 等于多少？",
        answer: "3/5",
        explanation: "分母相同，分子相加。",
        studentAnswer: "3/5"
      }
    ]
  });

  assert.equal(reflection.masteryLevel, "secure");
  assert.equal(reflection.correctCount, 2);
  assert.match(reflection.summary, /分数加法/);
  assert.equal(reflection.detail.title, "继续拉开难度");
  assert.equal(reflection.detailSource, "fallback");
});

test("study reflection highlights wrong-answer repair steps", () => {
  const reflection = buildStudyVariantReflection({
    subject: "math",
    knowledgePointTitle: "分数加法",
    variants: [
      {
        stem: "1/3 + 2/3 等于多少？",
        answer: "1",
        explanation: "分母相同，分子相加后得到 1。",
        studentAnswer: "1/5"
      },
      {
        stem: "3/10 + 2/10 等于多少？",
        answer: "1/2",
        explanation: "先相加得到 5/10，再化简。",
        studentAnswer: "1/2"
      }
    ]
  });

  assert.equal(reflection.masteryLevel, "developing");
  assert.equal(reflection.correctCount, 1);
  assert.equal(reflection.answeredCount, 2);
  assert.equal(reflection.detail.title, "重点错因");
  assert.match(reflection.detail.analysis, /条件|方法|迁移/);
  assert.ok(reflection.nextSteps.length >= 2);
});
