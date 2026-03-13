import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStudyVariantProgressMessage,
  buildStudyVariantQuestionId,
  summarizeRecentStudyVariantAttempts
} from "../../lib/ai-study-progress";

test("study variant question id is stable for the same variant stem and knowledge point", () => {
  const first = buildStudyVariantQuestionId({
    subject: "math",
    grade: "4",
    knowledgePointId: "kp-fraction-add",
    stem: "3/4 + 1/4 等于多少？"
  });
  const second = buildStudyVariantQuestionId({
    subject: "math",
    grade: "4",
    knowledgePointId: "kp-fraction-add",
    stem: "3/4 + 1/4  等于多少？"
  });

  assert.equal(first, second);
  assert.match(first, /^study-variant:/);
});

test("study variant progress message includes mastery delta when persisted", () => {
  const message = buildStudyVariantProgressMessage({
    persisted: true,
    knowledgePointTitle: "分数加法",
    masteryScore: 72,
    masteryDelta: 6
  });

  assert.match(message, /分数加法/);
  assert.match(message, /72/);
  assert.match(message, /\+6/);
});

test("recent study variant summary tracks latest tutor drill in the last 24 hours", () => {
  const summary = summarizeRecentStudyVariantAttempts({
    now: new Date("2026-03-12T12:00:00.000Z").getTime(),
    attempts: [
      {
        reason: "practice",
        createdAt: "2026-03-12T10:00:00.000Z",
        knowledgePointId: "kp-ignore",
        subject: "math",
        correct: true
      },
      {
        reason: "study-variant",
        createdAt: "2026-03-12T11:00:00.000Z",
        knowledgePointId: "kp-fraction",
        subject: "math",
        correct: false
      },
      {
        reason: "study-variant",
        createdAt: "2026-03-12T11:30:00.000Z",
        knowledgePointId: "kp-fraction",
        subject: "math",
        correct: true
      }
    ]
  });

  assert.equal(summary?.recentAttemptCount, 2);
  assert.equal(summary?.recentCorrectCount, 1);
  assert.equal(summary?.latestKnowledgePointId, "kp-fraction");
  assert.equal(summary?.latestCorrect, true);
});
