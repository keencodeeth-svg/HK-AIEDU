import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type AdminStepUpModule = typeof import("../../lib/admin-step-up");

const ENV_KEYS = ["ADMIN_STEP_UP_SECRET", "ADMIN_STEP_UP_TTL_MINUTES", "NODE_ENV"] as const;
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
  const targets = ["../../lib/admin-step-up"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadModule(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}
): AdminStepUpModule {
  restoreEnv();
  process.env.NODE_ENV = "test";
  process.env.ADMIN_STEP_UP_SECRET = "unit-test-admin-step-up-secret";
  process.env.ADMIN_STEP_UP_TTL_MINUTES = "10";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetModules();
  return require("../../lib/admin-step-up") as AdminStepUpModule;
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("createAdminStepUpToken binds verification to the same user and session", () => {
  const mod = loadModule();
  const now = new Date("2026-03-11T08:00:00.000Z");

  const grant = mod.createAdminStepUpToken({
    userId: "admin-1",
    sessionToken: "session-123",
    now
  });
  const verified = mod.verifyAdminStepUpToken(grant.token, {
    userId: "admin-1",
    sessionToken: "session-123",
    now: new Date("2026-03-11T08:05:00.000Z")
  });

  assert.equal(verified.valid, true);
  if (verified.valid) {
    assert.equal(verified.issuedAt, now.toISOString());
    assert.equal(verified.expiresAt, "2026-03-11T08:10:00.000Z");
  }
});

test("verifyAdminStepUpToken rejects mismatched sessions and expired grants", () => {
  const mod = loadModule();
  const grant = mod.createAdminStepUpToken({
    userId: "admin-1",
    sessionToken: "session-123",
    now: new Date("2026-03-11T08:00:00.000Z")
  });

  const wrongSession = mod.verifyAdminStepUpToken(grant.token, {
    userId: "admin-1",
    sessionToken: "session-456",
    now: new Date("2026-03-11T08:02:00.000Z")
  });
  assert.deepEqual(wrongSession, { valid: false, reason: "session" });

  const expired = mod.verifyAdminStepUpToken(grant.token, {
    userId: "admin-1",
    sessionToken: "session-123",
    now: new Date("2026-03-11T08:10:00.000Z")
  });
  assert.deepEqual(expired, { valid: false, reason: "expired" });
});

test("production mode requires ADMIN_STEP_UP_SECRET", () => {
  const mod = loadModule({
    NODE_ENV: "production",
    ADMIN_STEP_UP_SECRET: undefined
  });

  assert.throws(
    () =>
      mod.createAdminStepUpToken({
        userId: "admin-1",
        sessionToken: "session-123",
        now: new Date("2026-03-11T08:00:00.000Z")
      }),
    /admin step-up unavailable/
  );
});
