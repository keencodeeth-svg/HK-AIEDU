import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getRuntimeGuardrailIssues,
  isHighFrequencyStateFile,
  isMigrationPriorityStateFile,
  listMigrationPriorityStateFiles,
  requiresDatabaseBackedState,
  shouldAllowDbBootstrapFromJsonFallback,
  shouldEnforceRuntimeGuardrails
} from "../../lib/runtime-guardrails";

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
  "API_TEST_SUITE",
  "API_TEST_SCOPE",
  "DATABASE_URL",
  "FILE_INLINE_CONTENT",
  "FILE_OBJECT_STORAGE_ENABLED",
  "HIGH_FREQUENCY_STATE_REQUIRE_DB",
  "LIBRARY_INLINE_FILE_CONTENT",
  "LIBRARY_OBJECT_STORAGE_ENABLED",
  "NODE_ENV",
  "OBJECT_STORAGE_ALLOW_DEFAULT_ROOT",
  "OBJECT_STORAGE_ROOT",
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

function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  restoreEnv();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  restoreEnv();
});

test("runtime guardrails stay off in development by default", () => {
  setEnv({
    NODE_ENV: "development",
    API_TEST_SCOPE: undefined,
    API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER: undefined,
    RUNTIME_GUARDRAILS_ENFORCE: undefined
  });

  assert.equal(shouldEnforceRuntimeGuardrails(), false);
  assert.equal(shouldAllowDbBootstrapFromJsonFallback(), true);
  assert.deepEqual(getRuntimeGuardrailIssues(), []);
});

test("runtime guardrails turn on in production and report missing critical config", () => {
  setEnv({
    NODE_ENV: "production",
    DATABASE_URL: undefined,
    ALLOW_JSON_FALLBACK: "true",
    OBJECT_STORAGE_ROOT: undefined,
    OBJECT_STORAGE_ALLOW_DEFAULT_ROOT: undefined,
    FILE_INLINE_CONTENT: "true",
    LIBRARY_INLINE_FILE_CONTENT: "true",
    RUNTIME_GUARDRAILS_ENFORCE: undefined,
    API_TEST_SCOPE: undefined,
    API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER: undefined
  });

  assert.equal(shouldEnforceRuntimeGuardrails(), true);
  assert.equal(shouldAllowDbBootstrapFromJsonFallback(), false);
  const issues = getRuntimeGuardrailIssues();
  assert.ok(issues.some((item) => item.includes("DATABASE_URL is required")));
  assert.ok(issues.some((item) => item.includes("ALLOW_JSON_FALLBACK=true")));
  assert.ok(issues.some((item) => item.includes("OBJECT_STORAGE_ROOT must be set")));
  assert.ok(issues.some((item) => item.includes("FILE_INLINE_CONTENT=true")));
  assert.ok(issues.some((item) => item.includes("LIBRARY_INLINE_FILE_CONTENT=true")));
});

test("explicit ALLOW_JSON_FALLBACK=false disables DB bootstrap from legacy json even outside guarded runtime", () => {
  setEnv({
    NODE_ENV: "development",
    ALLOW_JSON_FALLBACK: "false",
    RUNTIME_GUARDRAILS_ENFORCE: undefined
  });

  assert.equal(shouldEnforceRuntimeGuardrails(), false);
  assert.equal(shouldAllowDbBootstrapFromJsonFallback(), false);
});

test("runtime guardrails can permit default object storage root when explicitly allowed", () => {
  setEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://demo:demo@localhost:5432/demo",
    ALLOW_JSON_FALLBACK: "false",
    OBJECT_STORAGE_ROOT: undefined,
    OBJECT_STORAGE_ALLOW_DEFAULT_ROOT: "true",
    FILE_INLINE_CONTENT: "false",
    LIBRARY_INLINE_FILE_CONTENT: "false",
    API_TEST_SCOPE: undefined,
    API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER: undefined
  });

  const issues = getRuntimeGuardrailIssues();
  assert.deepEqual(issues, []);
});

test("api test runtime disables guardrails even if NODE_ENV is production", () => {
  setEnv({
    NODE_ENV: "production",
    API_TEST_SCOPE: "smoke",
    DATABASE_URL: undefined,
    RUNTIME_GUARDRAILS_ENFORCE: undefined
  });

  assert.equal(shouldEnforceRuntimeGuardrails(), false);
  assert.deepEqual(getRuntimeGuardrailIssues(), []);
});

test("API_TEST_SUITE also disables guardrails when API_TEST_SCOPE is unset", () => {
  setEnv({
    NODE_ENV: "production",
    API_TEST_SUITE: "school-schedules",
    API_TEST_SCOPE: undefined,
    DATABASE_URL: undefined,
    RUNTIME_GUARDRAILS_ENFORCE: undefined
  });

  assert.equal(shouldEnforceRuntimeGuardrails(), false);
  assert.deepEqual(getRuntimeGuardrailIssues(), []);
});

test("high frequency state files require database backing in guarded runtime", () => {
  setEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://demo:demo@localhost:5432/demo",
    ALLOW_JSON_FALLBACK: "false",
    OBJECT_STORAGE_ROOT: "/tmp/hk-ai-objects",
    FILE_INLINE_CONTENT: "false",
    LIBRARY_INLINE_FILE_CONTENT: "false",
    RUNTIME_GUARDRAILS_ENFORCE: "true",
    HIGH_FREQUENCY_STATE_REQUIRE_DB: undefined
  });

  assert.equal(requiresDatabaseBackedState("sessions.json"), true);
  assert.equal(requiresDatabaseBackedState("auth-login-attempts.json"), true);
  assert.equal(requiresDatabaseBackedState("auth-recovery-attempts.json"), true);
  assert.equal(requiresDatabaseBackedState("assignment-submissions.json"), true);
  assert.equal(requiresDatabaseBackedState("notifications.json"), true);
  assert.equal(requiresDatabaseBackedState("question-attempts.json"), true);
  assert.equal(requiresDatabaseBackedState("review-tasks.json"), true);
  assert.equal(requiresDatabaseBackedState("memory-reviews.json"), true);
  assert.equal(requiresDatabaseBackedState("study-plans.json"), true);
  assert.equal(requiresDatabaseBackedState("wrong-review-items.json"), true);
  assert.equal(isHighFrequencyStateFile("analytics-events.json"), true);
  assert.equal(isHighFrequencyStateFile("study-plans.json"), true);
  assert.equal(isHighFrequencyStateFile("question-attempts.json"), true);
  assert.equal(isHighFrequencyStateFile("review-tasks.json"), true);
  assert.equal(isHighFrequencyStateFile("memory-reviews.json"), true);
  assert.equal(isHighFrequencyStateFile("wrong-review-items.json"), true);
  assert.equal(requiresDatabaseBackedState("random-cache.json"), false);
});

test("HIGH_FREQUENCY_STATE_REQUIRE_DB=false can relax guarded file checks", () => {
  setEnv({
    NODE_ENV: "production",
    RUNTIME_GUARDRAILS_ENFORCE: "true",
    HIGH_FREQUENCY_STATE_REQUIRE_DB: "false"
  });

  assert.equal(requiresDatabaseBackedState("sessions.json"), false);
});

test("migration priority state list is empty after the current review-loop migration tranche", () => {
  assert.equal(isMigrationPriorityStateFile("review-tasks.json"), false);
  assert.equal(isMigrationPriorityStateFile("memory-reviews.json"), false);
  assert.equal(isMigrationPriorityStateFile("wrong-review-items.json"), false);
  assert.equal(isMigrationPriorityStateFile("assignment-submissions.json"), false);
  assert.equal(isMigrationPriorityStateFile("question-attempts.json"), false);
  assert.equal(isMigrationPriorityStateFile("study-plans.json"), false);
  assert.equal(isMigrationPriorityStateFile("random-cache.json"), false);
  assert.deepEqual(listMigrationPriorityStateFiles(), []);
  assert.ok(!listMigrationPriorityStateFiles().includes("assignment-submissions.json"));
  assert.ok(!listMigrationPriorityStateFiles().includes("study-plans.json"));
});
