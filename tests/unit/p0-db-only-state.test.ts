import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type MasteryModule = typeof import("../../lib/mastery");
type CorrectionsModule = typeof import("../../lib/corrections");
type AnalyticsModule = typeof import("../../lib/analytics");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
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
  const targets = ["../../lib/db", "../../lib/runtime-guardrails", "../../lib/mastery", "../../lib/corrections", "../../lib/analytics"];
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
  delete process.env.DATABASE_URL;
  delete process.env.REQUIRE_DATABASE;
  delete process.env.ALLOW_JSON_FALLBACK;

  resetModules();

  return {
    mastery: require("../../lib/mastery") as MasteryModule,
    corrections: require("../../lib/corrections") as CorrectionsModule,
    analytics: require("../../lib/analytics") as AnalyticsModule
  };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("mastery records require database-backed storage", async () => {
  const { mastery } = loadDbOnlyModules();

  await assert.rejects(
    () => mastery.getMasteryRecordsByUser("u-student-001"),
    /DATABASE_URL is required for mastery_records/
  );
});

test("correction tasks require database-backed storage", async () => {
  const { corrections } = loadDbOnlyModules();

  await assert.rejects(
    () => corrections.getCorrectionTasksByUser("u-student-001"),
    /DATABASE_URL is required for correction_tasks/
  );
});

test("analytics events require database-backed storage for reads and writes", async () => {
  const { analytics } = loadDbOnlyModules();

  await assert.rejects(
    () => analytics.getAnalyticsEvents(),
    /DATABASE_URL is required for analytics_events/
  );

  await assert.rejects(
    () =>
      analytics.appendAnalyticsEvents([
        {
          id: "evt-test-001",
          eventName: "login_page_view",
          eventTime: "2026-03-15T00:00:00.000Z",
          receivedAt: "2026-03-15T00:00:00.000Z",
          userId: null,
          role: null,
          subject: null,
          grade: null,
          page: "/login",
          sessionId: "session-001",
          traceId: null,
          entityId: null,
          props: null,
          propsTruncated: false,
          userAgent: "node",
          ip: "127.0.0.1"
        }
      ]),
    /DATABASE_URL is required for analytics_events/
  );
});
