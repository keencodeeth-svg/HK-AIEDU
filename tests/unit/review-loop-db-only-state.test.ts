import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type ReviewTasksModule = typeof import("../../lib/review-tasks");
type WrongReviewModule = typeof import("../../lib/wrong-review");
type MemoryModule = typeof import("../../lib/memory");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "API_TEST_SCOPE",
  "DATABASE_URL",
  "NODE_ENV",
  "REQUIRE_DATABASE",
  "RUNTIME_GUARDRAILS_ENFORCE",
  "UNIFIED_REVIEW_ENGINE"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function resetModules() {
  const targets = [
    "../../lib/db",
    "../../lib/runtime-guardrails",
    "../../lib/review-tasks",
    "../../lib/wrong-review",
    "../../lib/memory"
  ];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadDbOnlyModules() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "false";
  process.env.UNIFIED_REVIEW_ENGINE = "true";
  delete process.env.DATABASE_URL;
  delete process.env.REQUIRE_DATABASE;
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.API_TEST_SCOPE;

  resetModules();

  return {
    reviewTasks: require("../../lib/review-tasks") as ReviewTasksModule,
    wrongReview: require("../../lib/wrong-review") as WrongReviewModule,
    memory: require("../../lib/memory") as MemoryModule
  };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("review tasks require database-backed storage outside api test runtime", async () => {
  const { reviewTasks } = loadDbOnlyModules();

  await assert.rejects(
    () => reviewTasks.getReviewTasksByUser("u-student-001"),
    /DATABASE_URL is required for review_tasks/
  );

  await assert.rejects(
    () =>
      reviewTasks.upsertReviewTask({
        userId: "u-student-001",
        questionId: "q-math-001",
        sourceType: "wrong",
        status: "active"
      }),
    /DATABASE_URL is required for review_tasks/
  );
});

test("wrong review items require database-backed storage outside api test runtime", async () => {
  const { wrongReview } = loadDbOnlyModules();

  await assert.rejects(
    () => wrongReview.getWrongReviewItemsByUser("u-student-001"),
    /DATABASE_URL is required for wrong_review_items/
  );

  await assert.rejects(
    () =>
      wrongReview.enqueueWrongReview({
        userId: "u-student-001",
        questionId: "q-math-001",
        subject: "math",
        knowledgePointId: "kp-math-001"
      }),
    /DATABASE_URL is required for wrong_review_items/
  );
});

test("memory reviews require database-backed storage outside api test runtime", async () => {
  const { memory } = loadDbOnlyModules();

  await assert.rejects(
    () => memory.getMemoryReviewsByUser("u-student-001"),
    /DATABASE_URL is required for memory_reviews/
  );

  await assert.rejects(
    () =>
      memory.updateMemorySchedule({
        userId: "u-student-001",
        questionId: "q-math-001",
        correct: true
      }),
    /DATABASE_URL is required for memory_reviews/
  );
});
