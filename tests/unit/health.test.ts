import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { getLivenessPayload, getReadinessPayload } from "../../lib/health";

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "FILE_INLINE_CONTENT",
  "FILE_OBJECT_STORAGE_ENABLED",
  "LIBRARY_INLINE_FILE_CONTENT",
  "LIBRARY_OBJECT_STORAGE_ENABLED",
  "NODE_ENV",
  "OBJECT_STORAGE_ALLOW_DEFAULT_ROOT",
  "OBJECT_STORAGE_ROOT",
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

test("liveness payload is always alive", () => {
  const payload = getLivenessPayload();
  assert.equal(payload.ok, true);
  assert.equal(payload.alive, true);
  assert.equal(payload.mode, "liveness");
});

test("readiness stays ready in development with writable object storage and no database", async () => {
  const objectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-health-dev-"));
  try {
    setEnv({
      NODE_ENV: "development",
      DATABASE_URL: undefined,
      REQUIRE_DATABASE: undefined,
      ALLOW_JSON_FALLBACK: undefined,
      FILE_OBJECT_STORAGE_ENABLED: "true",
      LIBRARY_OBJECT_STORAGE_ENABLED: "true",
      OBJECT_STORAGE_ROOT: objectRoot,
      RUNTIME_GUARDRAILS_ENFORCE: undefined
    });

    const payload = await getReadinessPayload();
    assert.equal(payload.ready, true);
    assert.equal(payload.mode, "readiness");
    assert.ok(payload.summary.pass >= 1);

    const databaseCheck = payload.checks.find((item) => item.name === "database");
    assert.equal(databaseCheck?.state, "warn");

    const runtimeGuardrailsCheck = payload.checks.find((item) => item.name === "runtimeGuardrails");
    assert.equal(runtimeGuardrailsCheck?.state, "warn");
  } finally {
    await fs.rm(objectRoot, { recursive: true, force: true });
  }
});

test("readiness fails when guarded production runtime is missing database and explicit object storage", async () => {
  setEnv({
    NODE_ENV: "production",
    RUNTIME_GUARDRAILS_ENFORCE: "true",
    DATABASE_URL: undefined,
    ALLOW_JSON_FALLBACK: "true",
    OBJECT_STORAGE_ROOT: undefined,
    OBJECT_STORAGE_ALLOW_DEFAULT_ROOT: undefined,
    FILE_INLINE_CONTENT: "false",
    LIBRARY_INLINE_FILE_CONTENT: "false",
    FILE_OBJECT_STORAGE_ENABLED: "true",
    LIBRARY_OBJECT_STORAGE_ENABLED: "true"
  });

  const payload = await getReadinessPayload();
  assert.equal(payload.ready, false);

  const failingChecks = payload.checks.filter((item) => item.state === "fail").map((item) => item.name);
  assert.ok(failingChecks.includes("runtimeGuardrails"));
  assert.ok(failingChecks.includes("database"));
  assert.ok(failingChecks.includes("objectStorage"));
  assert.ok(failingChecks.includes("jsonFallback"));
});

test("readiness fails when guarded runtime detects high-frequency JSON state files on disk", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-health-guarded-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  const objectRoot = path.join(root, "objects");

  try {
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.mkdir(seedDir, { recursive: true });
    await fs.mkdir(objectRoot, { recursive: true });
    await fs.writeFile(path.join(runtimeDir, "focus-sessions.json"), "[]");

    setEnv({
      NODE_ENV: "production",
      RUNTIME_GUARDRAILS_ENFORCE: "true",
      DATABASE_URL: "postgres://demo:demo@localhost:5432/demo",
      ALLOW_JSON_FALLBACK: "false",
      OBJECT_STORAGE_ROOT: objectRoot,
      OBJECT_STORAGE_ALLOW_DEFAULT_ROOT: undefined,
      FILE_INLINE_CONTENT: "false",
      LIBRARY_INLINE_FILE_CONTENT: "false",
      FILE_OBJECT_STORAGE_ENABLED: "true",
      LIBRARY_OBJECT_STORAGE_ENABLED: "true",
      DATA_DIR: runtimeDir,
      DATA_SEED_DIR: seedDir
    });

    const payload = await getReadinessPayload();
    assert.equal(payload.ready, false);

    const highFrequencyStateCheck = payload.checks.find((item) => item.name === "highFrequencyState");
    assert.equal(highFrequencyStateCheck?.state, "fail");
    const details = (highFrequencyStateCheck?.details ?? {}) as { runtimeFiles?: string[] };
    assert.deepEqual(details.runtimeFiles, ["focus-sessions.json"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("readiness fails when promoted execution-state JSON files remain in seed storage", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-health-promoted-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  const objectRoot = path.join(root, "objects");

  try {
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.mkdir(seedDir, { recursive: true });
    await fs.mkdir(objectRoot, { recursive: true });
    await fs.writeFile(path.join(seedDir, "assignment-submissions.json"), "[]");

    setEnv({
      NODE_ENV: "production",
      RUNTIME_GUARDRAILS_ENFORCE: "true",
      DATABASE_URL: "postgres://demo:demo@localhost:5432/demo",
      ALLOW_JSON_FALLBACK: "false",
      OBJECT_STORAGE_ROOT: objectRoot,
      OBJECT_STORAGE_ALLOW_DEFAULT_ROOT: undefined,
      FILE_INLINE_CONTENT: "false",
      LIBRARY_INLINE_FILE_CONTENT: "false",
      FILE_OBJECT_STORAGE_ENABLED: "true",
      LIBRARY_OBJECT_STORAGE_ENABLED: "true",
      DATA_DIR: runtimeDir,
      DATA_SEED_DIR: seedDir
    });

    const payload = await getReadinessPayload();
    assert.equal(payload.ready, false);

    const highFrequencyStateCheck = payload.checks.find((item) => item.name === "highFrequencyState");
    assert.equal(highFrequencyStateCheck?.state, "fail");
    const details = (highFrequencyStateCheck?.details ?? {}) as { seedFiles?: string[] };
    assert.deepEqual(details.seedFiles, ["assignment-submissions.json"]);

    const migrationPriorityCheck = payload.checks.find((item) => item.name === "migrationPriorityState");
    assert.equal(migrationPriorityCheck?.state, "pass");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("readiness fails when promoted review-loop JSON state files remain on disk", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-health-migration-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  const objectRoot = path.join(root, "objects");

  try {
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.mkdir(seedDir, { recursive: true });
    await fs.mkdir(objectRoot, { recursive: true });
    await fs.writeFile(path.join(seedDir, "review-tasks.json"), "[]");

    setEnv({
      NODE_ENV: "production",
      RUNTIME_GUARDRAILS_ENFORCE: "true",
      DATABASE_URL: "postgres://demo:demo@localhost:5432/demo",
      ALLOW_JSON_FALLBACK: "false",
      OBJECT_STORAGE_ROOT: objectRoot,
      OBJECT_STORAGE_ALLOW_DEFAULT_ROOT: undefined,
      FILE_INLINE_CONTENT: "false",
      LIBRARY_INLINE_FILE_CONTENT: "false",
      FILE_OBJECT_STORAGE_ENABLED: "true",
      LIBRARY_OBJECT_STORAGE_ENABLED: "true",
      DATA_DIR: runtimeDir,
      DATA_SEED_DIR: seedDir
    });

    const payload = await getReadinessPayload();
    const highFrequencyStateCheck = payload.checks.find((item) => item.name === "highFrequencyState");
    assert.equal(highFrequencyStateCheck?.state, "fail");
    const highFrequencyDetails = (highFrequencyStateCheck?.details ?? {}) as { seedFiles?: string[] };
    assert.deepEqual(highFrequencyDetails.seedFiles, ["review-tasks.json"]);

    const migrationPriorityCheck = payload.checks.find((item) => item.name === "migrationPriorityState");
    assert.equal(migrationPriorityCheck?.state, "pass");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
