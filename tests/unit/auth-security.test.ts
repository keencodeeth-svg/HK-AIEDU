import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AuthSecurityModule = typeof import("../../lib/auth-security");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "AUTH_FAIL_WINDOW_MINUTES",
  "AUTH_LOCK_MINUTES",
  "AUTH_MAX_FAILED_ATTEMPTS",
  "AUTH_SECURITY_ENFORCE",
  "AUTH_TRUST_PROXY_HEADERS",
  "DATABASE_URL",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "HIGH_FREQUENCY_STATE_REQUIRE_DB",
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

function resetAuthSecurityModules() {
  const targets = ["../../lib/auth-security", "../../lib/storage", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function loadAuthSecurity(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  restoreEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-auth-security-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.AUTH_SECURITY_ENFORCE = "true";
  process.env.AUTH_MAX_FAILED_ATTEMPTS = "3";
  process.env.AUTH_FAIL_WINDOW_MINUTES = "3";
  process.env.AUTH_LOCK_MINUTES = "1";
  process.env.AUTH_TRUST_PROXY_HEADERS = "false";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetAuthSecurityModules();
  const mod = require("../../lib/auth-security") as AuthSecurityModule;
  return { mod, root, runtimeDir, seedDir };
}

afterEach(() => {
  resetAuthSecurityModules();
  restoreEnv();
});

test("buildLoginAttemptIdentity defaults to email-only lockout scope unless proxy headers are trusted", async () => {
  const { mod, root } = await loadAuthSecurity({
    AUTH_TRUST_PROXY_HEADERS: "false"
  });

  try {
    const identity = mod.buildLoginAttemptIdentity({
      email: " Student@Demo.com ",
      forwardedFor: "203.0.113.9, 198.51.100.10"
    });

    assert.equal(identity.email, "student@demo.com");
    assert.equal(identity.ip, "email-only");
    assert.match(identity.key, /^auth-attempt-[0-9a-f]{40}$/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("buildLoginAttemptIdentity uses the first forwarded IP when proxy headers are trusted", async () => {
  const { mod, root } = await loadAuthSecurity({
    AUTH_TRUST_PROXY_HEADERS: "true"
  });

  try {
    const identity = mod.buildLoginAttemptIdentity({
      email: "teacher@demo.com",
      forwardedFor: "203.0.113.9, 198.51.100.10"
    });

    assert.equal(identity.ip, "203.0.113.9");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("registerFailedLoginAttempt locks after threshold and clearLoginAttempt resets state", async () => {
  const { mod, root } = await loadAuthSecurity();

  try {
    const identity = mod.buildLoginAttemptIdentity({
      email: "student@demo.com"
    });

    const first = await mod.registerFailedLoginAttempt(identity);
    assert.equal(first.locked, false);
    assert.equal(first.failedCount, 1);
    assert.equal(first.remainingAttempts, 2);

    const second = await mod.registerFailedLoginAttempt(identity);
    assert.equal(second.locked, false);
    assert.equal(second.failedCount, 2);
    assert.equal(second.remainingAttempts, 1);

    const third = await mod.registerFailedLoginAttempt(identity);
    assert.equal(third.locked, true);
    assert.equal(third.failedCount, 3);
    assert.equal(third.remainingAttempts, 0);
    assert.equal(typeof third.lockUntil, "string");

    const lockedStatus = await mod.getLoginAttemptStatus(identity);
    assert.equal(lockedStatus.locked, true);
    assert.equal(lockedStatus.remainingAttempts, 0);

    await mod.clearLoginAttempt(identity);
    const cleared = await mod.getLoginAttemptStatus(identity);
    assert.equal(cleared.locked, false);
    assert.equal(cleared.failedCount, 0);
    assert.equal(cleared.remainingAttempts, 3);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("getLoginAttemptStatus clears stale attempts outside the failure window", async () => {
  const { mod, root, runtimeDir } = await loadAuthSecurity();

  try {
    const identity = mod.buildLoginAttemptIdentity({
      email: "stale@demo.com"
    });

    const staleAttempt = [
      {
        key: identity.key,
        email: identity.email,
        ip: identity.ip,
        failedCount: 2,
        firstFailedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        lockUntil: null,
        updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      }
    ];

    await fs.writeFile(
      path.join(runtimeDir, "auth-login-attempts.json"),
      JSON.stringify(staleAttempt, null, 2)
    );

    const status = await mod.getLoginAttemptStatus(identity);
    assert.equal(status.locked, false);
    assert.equal(status.failedCount, 0);
    assert.equal(status.remainingAttempts, 3);

    const persisted = JSON.parse(
      await fs.readFile(path.join(runtimeDir, "auth-login-attempts.json"), "utf-8")
    ) as Array<{ key: string }>;
    assert.equal(persisted.some((item) => item.key === identity.key), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("AUTH_SECURITY_ENFORCE=false disables lockout mutations", async () => {
  const { mod, root, runtimeDir } = await loadAuthSecurity({
    AUTH_SECURITY_ENFORCE: "false"
  });

  try {
    const identity = mod.buildLoginAttemptIdentity({
      email: "disabled@demo.com"
    });

    const status = await mod.registerFailedLoginAttempt(identity);
    assert.equal(status.enforced, false);
    assert.equal(status.locked, false);
    assert.equal(status.failedCount, 0);
    assert.equal(status.remainingAttempts, 3);

    await assert.rejects(
      fs.access(path.join(runtimeDir, "auth-login-attempts.json")),
      /ENOENT/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
