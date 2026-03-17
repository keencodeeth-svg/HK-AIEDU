import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type ProgressModule = typeof import("../../lib/progress");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "API_TEST_SCOPE",
  "DATABASE_URL",
  "NODE_ENV",
  "REQUIRE_DATABASE",
  "RUNTIME_GUARDRAILS_ENFORCE"
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
    "../../lib/progress",
    "../../lib/storage",
    "../../lib/content",
    "../../lib/reviews",
    "../../lib/focus",
    "../../lib/favorites",
    "../../lib/review-scheduler"
  ];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadProgressModule() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "false";
  delete process.env.DATABASE_URL;
  delete process.env.REQUIRE_DATABASE;
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.API_TEST_SCOPE;

  resetModules();
  return require("../../lib/progress") as ProgressModule;
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("question attempts require database-backed storage outside api test runtime", async () => {
  const progress = loadProgressModule();

  await assert.rejects(() => progress.getAttempts(), /DATABASE_URL is required for question_attempts/);
});

test("study plans require database-backed storage outside api test runtime", async () => {
  const progress = loadProgressModule();

  await assert.rejects(() => progress.getStudyPlan("u-student-001", "math"), /DATABASE_URL is required for study_plans/);
});
