import assert from "node:assert/strict";
import { test } from "node:test";

const {
  resolveAdminQuestionKnowledgePointId
} = require("../../app/admin/questions/utils") as typeof import("../../app/admin/questions/utils");

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
