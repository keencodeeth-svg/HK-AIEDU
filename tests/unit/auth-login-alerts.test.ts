import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AuthLoginAlertsModule = typeof import("../../lib/auth-login-alerts");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
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

function resetModules() {
  const targets = [
    "../../lib/auth-login-alerts",
    "../../lib/admin-log",
    "../../lib/db",
    "../../lib/notifications",
    "../../lib/storage"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function loadAuthLoginAlerts() {
  restoreEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-auth-login-alerts-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;

  resetModules();
  const mod = require("../../lib/auth-login-alerts") as AuthLoginAlertsModule;
  return { mod, root, runtimeDir };
}

async function readRuntimeJson<T>(runtimeDir: string, fileName: string): Promise<T> {
  const filePath = path.join(runtimeDir, fileName);
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("handleSuccessfulLoginSecurity persists trusted login fingerprints and logs new IP alerts", async () => {
  const { mod, root, runtimeDir } = await loadAuthLoginAlerts();

  try {
    const user = {
      id: "u-student-alert",
      email: "student-alert@demo.com",
      name: "Alert Student",
      role: "student" as const
    };

    const first = await mod.handleSuccessfulLoginSecurity({
      user,
      ip: "203.0.113.10",
      failedCountBeforeSuccess: 0
    });
    assert.equal(first, null);

    const second = await mod.handleSuccessfulLoginSecurity({
      user,
      ip: "203.0.113.11",
      failedCountBeforeSuccess: 0
    });
    assert.deepEqual(second?.reasons, ["new_ip"]);
    assert.equal(second?.severity, "medium");
    assert.equal(second?.previousIp, "203.0.113.10");

    const profiles = await readRuntimeJson<
      Array<{ userId: string; lastIp: string; knownIps: string[] }>
    >(runtimeDir, "auth-login-profiles.json");
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].userId, user.id);
    assert.equal(profiles[0].lastIp, "203.0.113.11");
    assert.deepEqual(profiles[0].knownIps, ["203.0.113.11", "203.0.113.10"]);

    const logs = await readRuntimeJson<Array<{ action: string; detail: string }>>(
      runtimeDir,
      "admin-logs.json"
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "auth_security_alert");
    assert.match(logs[0].detail, /"new_ip"/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("handleSuccessfulLoginSecurity ignores untrusted IP labels for new IP detection", async () => {
  const { mod, root, runtimeDir } = await loadAuthLoginAlerts();

  try {
    const user = {
      id: "u-student-untrusted",
      email: "student-untrusted@demo.com",
      name: "Untrusted Student",
      role: "student" as const
    };

    await mod.handleSuccessfulLoginSecurity({
      user,
      ip: "email-only",
      failedCountBeforeSuccess: 0
    });

    const second = await mod.handleSuccessfulLoginSecurity({
      user,
      ip: "email-only",
      failedCountBeforeSuccess: 0
    });
    assert.equal(second, null);

    await assert.rejects(fs.access(path.join(runtimeDir, "admin-logs.json")), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("privileged suspicious login creates notification and lockout events are logged separately", async () => {
  const { mod, root, runtimeDir } = await loadAuthLoginAlerts();

  try {
    const admin = {
      id: "u-admin-alert",
      email: "admin-alert@demo.com",
      name: "Admin Alert",
      role: "admin" as const
    };

    const suspicious = await mod.handleSuccessfulLoginSecurity({
      user: admin,
      ip: "email-only",
      failedCountBeforeSuccess: 2
    });
    assert.deepEqual(suspicious?.reasons, ["success_after_failures"]);
    assert.equal(suspicious?.severity, "high");

    const notifications = await readRuntimeJson<
      Array<{ userId: string; type: string; content: string }>
    >(runtimeDir, "notifications.json");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, admin.id);
    assert.equal(notifications[0].type, "security_alert");
    assert.match(notifications[0].content, /2 次失败尝试/);

    const lockout = await mod.handleLoginLockoutSecurity({
      user: admin,
      ip: "email-only",
      requestedRole: "admin",
      failedCount: 5,
      maxFailedAttempts: 5,
      lockUntil: "2026-03-12T08:00:00.000Z",
      trigger: "lockout_threshold_reached"
    });
    assert.equal(lockout?.kind, "login_lockout");
    assert.equal(lockout?.severity, "high");

    const logs = await readRuntimeJson<Array<{ action: string; detail: string }>>(
      runtimeDir,
      "admin-logs.json"
    );
    assert.equal(logs.length, 2);
    assert.equal(logs[0].action, "auth_login_lockout");
    assert.match(logs[0].detail, /"lockout_threshold_reached"/);
    assert.equal(logs[1].action, "auth_security_alert");
    assert.match(logs[1].detail, /"success_after_failures"/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
