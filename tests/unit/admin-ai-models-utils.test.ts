import assert from "node:assert/strict";
import { test } from "node:test";

const {
  addProviderToChain,
  moveProviderInChain,
  parseChainInput,
  removeProviderFromChain,
  toChainInput,
  toggleEvalDatasetSelection,
  toggleRequiredEvalDatasetSelection
} = require("../../app/admin/ai-models/utils") as typeof import("../../app/admin/ai-models/utils");

test("admin ai models helpers parse and format provider chains consistently", () => {
  assert.deepEqual(parseChainInput(" deepseek, kimi | glm，seed "), ["deepseek", "kimi", "glm", "seed"]);
  assert.deepEqual(parseChainInput(" ,, | "), []);
  assert.equal(toChainInput(["deepseek", "kimi", "glm"]), "deepseek, kimi, glm");
});

test("admin ai models helpers add, remove, and move providers without corrupting order", () => {
  assert.deepEqual(addProviderToChain(["deepseek", "kimi"], "glm"), ["deepseek", "kimi", "glm"]);
  assert.deepEqual(addProviderToChain(["deepseek", "kimi"], "kimi"), ["deepseek", "kimi"]);
  assert.deepEqual(removeProviderFromChain(["deepseek", "kimi", "glm"], "kimi"), ["deepseek", "glm"]);
  assert.deepEqual(removeProviderFromChain(["deepseek", "kimi"], "seed"), ["deepseek", "kimi"]);
  assert.deepEqual(moveProviderInChain(["deepseek", "kimi", "glm"], "kimi", 1), ["deepseek", "glm", "kimi"]);
  assert.deepEqual(moveProviderInChain(["deepseek", "kimi", "glm"], "kimi", -1), ["kimi", "deepseek", "glm"]);
  assert.deepEqual(moveProviderInChain(["deepseek", "kimi", "glm"], "deepseek", -1), ["deepseek", "kimi", "glm"]);
});

test("admin ai models helpers toggle evaluation datasets while preserving gate minimum selection", () => {
  assert.deepEqual(toggleEvalDatasetSelection(["explanation"], "homework_review"), ["explanation", "homework_review"]);
  assert.deepEqual(toggleEvalDatasetSelection(["explanation", "homework_review"], "explanation"), ["homework_review"]);
  assert.deepEqual(toggleRequiredEvalDatasetSelection(["explanation"], "explanation"), ["explanation"]);
  assert.deepEqual(
    toggleRequiredEvalDatasetSelection(["explanation", "homework_review"], "explanation"),
    ["homework_review"]
  );
});
