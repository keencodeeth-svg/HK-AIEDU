import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AccountRecoveryModule = typeof import("../../lib/account-recovery");
type AdminLogModule = typeof import("../../lib/admin-log");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS",
  "AUTH_RECOVERY_EMAIL_WINDOW_MINUTES",
  "AUTH_RECOVERY_IP_MAX_ATTEMPTS",
  "AUTH_RECOVERY_IP_WINDOW_MINUTES",
  "AUTH_TRUST_PROXY_HEADERS",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "HIGH_FREQUENCY_STATE_REQUIRE_DB",
  "NODE_ENV",
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

function resetRecoveryModules() {
  const targets = [
    "../../lib/account-recovery",
    "../../lib/admin-log",
    "../../lib/auth",
    "../../lib/storage",
    "../../lib/db"
  ];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function loadRecoveryModules(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  restoreEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-recovery-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");

  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.AUTH_TRUST_PROXY_HEADERS = "false";
  process.env.AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS = "4";
  process.env.AUTH_RECOVERY_EMAIL_WINDOW_MINUTES = "30";
  process.env.AUTH_RECOVERY_IP_MAX_ATTEMPTS = "12";
  process.env.AUTH_RECOVERY_IP_WINDOW_MINUTES = "30";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;
  delete process.env.ALLOW_JSON_FALLBACK;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetRecoveryModules();
  const recovery = require("../../lib/account-recovery") as AccountRecoveryModule;
  const adminLog = require("../../lib/admin-log") as AdminLogModule;
  return { recovery, adminLog, root, runtimeDir, seedDir };
}

afterEach(() => {
  resetRecoveryModules();
  restoreEnv();
});

test("first recovery request creates a ticket and matches an existing user", async () => {
  const { recovery, adminLog, root, runtimeDir } = await loadRecoveryModules();

  try {
    await writeJson(path.join(runtimeDir, "users.json"), [
      {
        id: "u-student-1",
        email: "student@demo.com",
        name: "Student Demo",
        role: "student",
        password: "plain:Student123",
        grade: "4"
      }
    ]);

    const result = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: " student@demo.com ",
      issueType: "forgot_password",
      requesterIp: "203.0.113.10",
      userAgent: "unit-test-agent"
    });

    assert.equal(result.rateLimited, false);
    if (result.rateLimited) return;
    assert.equal(result.duplicate, false);
    assert.equal(result.matched, true);
    assert.equal(typeof result.ticketId, "string");

    const logs = await adminLog.getAdminLogs(20);
    assert.ok(logs.some((item) => item.action === "auth_recovery_request"));
    assert.ok(logs.some((item) => item.action === "auth_recovery_attempt"));

    const attempts = JSON.parse(
      await fs.readFile(path.join(runtimeDir, "auth-recovery-attempts.json"), "utf-8")
    ) as Array<{ result: string; email: string }>;
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]?.result, "accepted");
    assert.equal(attempts[0]?.email, "student@demo.com");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("same email + role + issueType within duplicate window reuses the original ticket", async () => {
  const { recovery, adminLog, root } = await loadRecoveryModules();

  try {
    const first = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "duplicate@demo.com",
      issueType: "forgot_account",
      requesterIp: "203.0.113.11",
      userAgent: "unit-test-agent"
    });
    assert.equal(first.rateLimited, false);
    if (first.rateLimited) return;

    const second = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "duplicate@demo.com",
      issueType: "forgot_account",
      requesterIp: "203.0.113.11",
      userAgent: "unit-test-agent"
    });

    assert.equal(second.rateLimited, false);
    if (second.rateLimited) return;
    assert.equal(second.duplicate, true);
    assert.equal(second.ticketId, first.ticketId);

    const logs = await adminLog.getAdminLogs(20);
    const duplicateAttempt = logs.find((item) => item.action === "auth_recovery_attempt" && item.entityId === first.ticketId);
    assert.ok(duplicateAttempt, "duplicate attempt should be recorded");
    const detail = duplicateAttempt?.detail ? JSON.parse(duplicateAttempt.detail) : null;
    assert.equal(detail?.result, "duplicate");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("email rate limit eventually returns a rate-limited result with retry metadata", async () => {
  const { recovery, root, runtimeDir } = await loadRecoveryModules({
    AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS: "3",
    AUTH_RECOVERY_EMAIL_WINDOW_MINUTES: "30"
  });

  try {
    const first = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "rate-limit@demo.com",
      issueType: "forgot_password",
      requesterIp: "203.0.113.12"
    });
    assert.equal(first.rateLimited, false);

    const second = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "rate-limit@demo.com",
      issueType: "account_locked",
      requesterIp: "203.0.113.12"
    });
    assert.equal(second.rateLimited, false);

    const third = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "rate-limit@demo.com",
      issueType: "forgot_account",
      requesterIp: "203.0.113.12"
    });
    assert.equal(third.rateLimited, false);

    const limited = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "rate-limit@demo.com",
      issueType: "forgot_password",
      requesterIp: "203.0.113.12"
    });

    assert.equal(limited.rateLimited, true);
    if (!limited.rateLimited) return;
    assert.equal(limited.limitedBy, "email");
    assert.equal(limited.maxAttempts, 3);
    assert.equal(typeof limited.retryAt, "string");

    const attempts = JSON.parse(
      await fs.readFile(path.join(runtimeDir, "auth-recovery-attempts.json"), "utf-8")
    ) as Array<{ result: string }>;
    assert.equal(attempts.filter((item) => item.result === "accepted").length, 3);
    assert.equal(attempts.filter((item) => item.result === "rate_limited").length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("rate limit remains effective even if audit logs are pruned between requests", async () => {
  const { recovery, root, runtimeDir } = await loadRecoveryModules({
    AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS: "3",
    AUTH_RECOVERY_EMAIL_WINDOW_MINUTES: "30"
  });

  try {
    const attempts = [
      "forgot_password",
      "account_locked",
      "forgot_account"
    ] as const;

    for (const issueType of attempts) {
      const result = await recovery.createAccountRecoveryRequest({
        role: "student",
        email: "pruned-logs@demo.com",
        issueType,
        requesterIp: "203.0.113.20"
      });
      assert.equal(result.rateLimited, false);
      await writeJson(path.join(runtimeDir, "admin-logs.json"), []);
    }

    const limited = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "pruned-logs@demo.com",
      issueType: "forgot_password",
      requesterIp: "203.0.113.20"
    });

    assert.equal(limited.rateLimited, true);
    if (!limited.rateLimited) return;
    assert.equal(limited.limitedBy, "email");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("ip rate limit applies across different emails when proxy headers are trusted", async () => {
  const { recovery, root } = await loadRecoveryModules({
    AUTH_TRUST_PROXY_HEADERS: "true",
    AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS: "10",
    AUTH_RECOVERY_IP_MAX_ATTEMPTS: "3",
    AUTH_RECOVERY_IP_WINDOW_MINUTES: "30"
  });

  try {
    const first = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "ip-limit-1@demo.com",
      issueType: "forgot_password",
      requesterIp: "198.51.100.20, 203.0.113.1"
    });
    assert.equal(first.rateLimited, false);

    const second = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "ip-limit-2@demo.com",
      issueType: "forgot_password",
      requesterIp: "198.51.100.20"
    });
    assert.equal(second.rateLimited, false);

    const third = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "ip-limit-3@demo.com",
      issueType: "forgot_password",
      requesterIp: "198.51.100.20"
    });
    assert.equal(third.rateLimited, false);

    const limited = await recovery.createAccountRecoveryRequest({
      role: "student",
      email: "ip-limit-4@demo.com",
      issueType: "forgot_password",
      requesterIp: "198.51.100.20"
    });

    assert.equal(limited.rateLimited, true);
    if (!limited.rateLimited) return;
    assert.equal(limited.limitedBy, "ip");
    assert.equal(limited.maxAttempts, 3);
    assert.equal(typeof limited.retryAt, "string");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
