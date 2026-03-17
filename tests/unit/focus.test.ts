import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type FocusModule = typeof import("../../lib/focus");

const ENV_KEYS = [
  "API_TEST_SCOPE",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
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

function resetFocusModules() {
  const targets = ["../../lib/focus", "../../lib/storage", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function loadFocusModule(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  restoreEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-focus-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.API_TEST_SCOPE = "unit-focus";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetFocusModules();
  const mod = require("../../lib/focus") as FocusModule;
  return { mod, root, runtimeDir };
}

afterEach(() => {
  resetFocusModules();
  restoreEnv();
});

test("addFocusSession persists JSON-backed sessions in reverse chronological order", async () => {
  const { mod, root, runtimeDir } = await loadFocusModule();

  try {
    const first = await mod.addFocusSession({
      userId: "student-1",
      mode: "focus",
      durationMinutes: 25,
      endedAt: "2026-03-11T08:00:00.000Z"
    });
    const second = await mod.addFocusSession({
      userId: "student-1",
      mode: "break",
      durationMinutes: 5,
      endedAt: "2026-03-11T08:30:00.000Z"
    });
    assert.ok(first);
    assert.ok(second);

    const persisted = JSON.parse(
      await fs.readFile(path.join(runtimeDir, "focus-sessions.json"), "utf-8")
    ) as Array<{ id: string }>;
    assert.equal(persisted[0]?.id, second.id);
    assert.equal(persisted[1]?.id, first.id);

    const sessions = await mod.getFocusSessionsByUser("student-1");
    assert.equal(sessions[0]?.id, second.id);
    assert.equal(sessions[1]?.id, first.id);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
