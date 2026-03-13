import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStudyCoachResponse } from "../../lib/ai-study-mode";

const assist = {
  answer: "先通分，再相加，结果是 1。",
  steps: ["先把两个分数通分成同分母。", "再把分子相加。", "最后把结果化简。"],
  hints: ["先判断分母是否相同。", "如果分母不同，先通分。"],
  sources: ["分数加法"],
  provider: "mock"
};

test("study mode starts by locking answer and asking for student thinking", () => {
  const result = buildStudyCoachResponse({
    question: "3/4 + 1/4 等于多少？",
    subject: "math",
    assist
  });

  assert.equal(result.learningMode, "study");
  assert.equal(result.stage, "diagnose");
  assert.equal(result.answer, "");
  assert.deepEqual(result.steps, []);
  assert.equal(result.studentTurnRequired, true);
  assert.equal(result.answerAvailable, true);
  assert.equal(result.hints.length, 2);
  assert.equal(result.knowledgeChecks.length, 3);
  assert.match(result.masteryFocus, /分数加法/);
});

test("study mode gives adaptive feedback after student submits thinking", () => {
  const result = buildStudyCoachResponse({
    question: "3/4 + 1/4 等于多少？",
    subject: "math",
    studentAnswer: "我想先把两个分数变成一样的分母，再算。",
    assist
  });

  assert.equal(result.stage, "check");
  assert.equal(result.answer, "");
  assert.deepEqual(result.steps, []);
  assert.equal(result.studentTurnRequired, true);
  assert.equal(typeof result.feedback, "string");
  assert.match(result.feedback ?? "", /已收到你的思路/);
  assert.match(result.nextPrompt, /2-3 句/);
});

test("study mode reveals answer and steps only on explicit reveal", () => {
  const result = buildStudyCoachResponse({
    question: "3/4 + 1/4 等于多少？",
    subject: "math",
    studentAnswer: "我会先通分。",
    revealAnswer: true,
    assist
  });

  assert.equal(result.stage, "reveal");
  assert.equal(result.studentTurnRequired, false);
  assert.equal(result.answer, assist.answer);
  assert.deepEqual(result.steps, assist.steps);
  assert.equal(result.revealAnswerCta, "已显示完整讲解");
  assert.match(result.nextPrompt, /复述/);
});
