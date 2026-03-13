import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFallbackStudyVariants, buildStudyTransferGoal } from "../../lib/ai-study-variants";

test("math transfer goal emphasizes method transfer over copying answers", () => {
  const goal = buildStudyTransferGoal({
    question: "3/4 + 1/4 等于多少？",
    answer: "1",
    subject: "math",
    knowledgePointTitle: "分数加法"
  });

  assert.match(goal, /分数加法/);
  assert.match(goal, /选对方法|条件变了/);
});

test("fallback study variants return valid multiple-choice drills", () => {
  const variants = buildFallbackStudyVariants({
    question: "3/4 + 1/4 等于多少？",
    answer: "1",
    subject: "math",
    knowledgePointTitle: "分数加法",
    count: 2
  });

  assert.equal(variants.length, 2);
  variants.forEach((variant) => {
    assert.equal(variant.options.length, 4);
    assert.ok(variant.options.includes(variant.answer));
    assert.ok(variant.explanation.length > 0);
  });
});

test("english fallback study variants focus on context and grammar checks", () => {
  const variants = buildFallbackStudyVariants({
    question: "Choose the correct tense.",
    answer: "went",
    subject: "english",
    knowledgePointTitle: "一般过去时",
    count: 2
  });

  assert.equal(variants.length, 2);
  assert.match(variants[0]?.stem ?? "", /一般过去时|同类题/);
});
