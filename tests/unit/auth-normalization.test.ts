import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AuthModule = typeof import("../../lib/auth");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "API_TEST_SCOPE",
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

function resetAuthModules() {
  const targets = ["../../lib/auth", "../../lib/storage", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function loadAuthModule() {
  restoreEnv();

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-auth-normalization-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.API_TEST_SCOPE = "unit-auth-normalization";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;

  resetAuthModules();
  const mod = require("../../lib/auth") as AuthModule;
  return { mod, root, runtimeDir };
}

afterEach(() => {
  resetAuthModules();
  restoreEnv();
});

test("createUser persists normalized email and name and getUserByEmail trims lookup input", async () => {
  const { mod, root, runtimeDir } = await loadAuthModule();

  try {
    await mod.createUser({
      id: "u-auth-normalized-1",
      email: " Student@Demo.com ",
      name: "  Student Demo  ",
      role: "student",
      password: "plain:Student123",
      grade: "4"
    });

    const users = await mod.getUsers();
    assert.equal(users.length, 1);
    assert.equal(users[0]?.email, "student@demo.com");
    assert.equal(users[0]?.name, "Student Demo");

    const byEmail = await mod.getUserByEmail("  STUDENT@demo.com  ");
    assert.equal(byEmail?.id, "u-auth-normalized-1");
    assert.equal(byEmail?.email, "student@demo.com");
    assert.equal(byEmail?.name, "Student Demo");

    const persisted = JSON.parse(
      await fs.readFile(path.join(runtimeDir, "users.json"), "utf-8")
    ) as Array<{ email: string; name: string }>;
    assert.equal(persisted[0]?.email, "student@demo.com");
    assert.equal(persisted[0]?.name, "Student Demo");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
