import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type StorageModule = typeof import("../../lib/storage");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "FILE_INLINE_CONTENT",
  "LIBRARY_INLINE_FILE_CONTENT",
  "NODE_ENV",
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

function resetStorageModules() {
  const targets = ["../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function loadStorageModule(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}
) {
  restoreEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-storage-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  const objectRoot = path.join(root, "objects");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });
  await fs.mkdir(objectRoot, { recursive: true });

  process.env.NODE_ENV = "production";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.ALLOW_JSON_FALLBACK = "false";
  process.env.FILE_INLINE_CONTENT = "false";
  process.env.LIBRARY_INLINE_FILE_CONTENT = "false";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.OBJECT_STORAGE_ROOT = objectRoot;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetStorageModules();
  const mod = require("../../lib/storage") as StorageModule;
  return { mod, root, runtimeDir, seedDir };
}

afterEach(() => {
  resetStorageModules();
  restoreEnv();
});

test("guarded runtime blocks JSON access for high-frequency state files even when database is configured", async () => {
  const { mod, root } = await loadStorageModule();

  try {
    assert.throws(
      () => mod.readJson("sessions.json", []),
      /cannot use JSON storage once DATABASE_URL is configured/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("guarded runtime blocks JSON access for promoted execution-state files", async () => {
  const { mod, root } = await loadStorageModule();

  try {
    assert.throws(
      () => mod.readJson("assignment-submissions.json", []),
      /cannot use JSON storage once DATABASE_URL is configured/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("database-backed high-frequency state cannot fall back to JSON even when runtime guardrails are not enforced", async () => {
  const { mod, root } = await loadStorageModule({
    NODE_ENV: "development",
    RUNTIME_GUARDRAILS_ENFORCE: "false"
  });

  try {
    assert.throws(
      () => mod.readJson("sessions.json", []),
      /cannot use JSON storage once DATABASE_URL is configured/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("guarded runtime still allows JSON fallback for non-blocking local cache files", async () => {
  const { mod, root, seedDir } = await loadStorageModule();

  try {
    await fs.writeFile(path.join(seedDir, "local-cache.json"), JSON.stringify([{ id: "cache-1" }], null, 2));
    const cache = mod.readJson("local-cache.json", []);
    assert.deepEqual(cache, [{ id: "cache-1" }]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("database-backed runtime still allows JSON fallback for non-promoted cache files", async () => {
  const { mod, root, seedDir } = await loadStorageModule({
    NODE_ENV: "development",
    RUNTIME_GUARDRAILS_ENFORCE: "false"
  });

  try {
    await fs.writeFile(path.join(seedDir, "local-cache.json"), JSON.stringify([{ id: "cache-dev-1" }], null, 2));
    const cache = mod.readJson("local-cache.json", []);
    assert.deepEqual(cache, [{ id: "cache-dev-1" }]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
