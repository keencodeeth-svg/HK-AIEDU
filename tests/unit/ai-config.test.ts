import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AiConfigModule = typeof import("../../lib/ai-config");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "LLM_PROVIDER",
  "LLM_PROVIDER_CHAIN",
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

function resetModules() {
  const targets = ["../../lib/ai-config", "../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("guarded db-backed ai provider config ignores legacy json bootstrap file", async () => {
  restoreEnv();

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-config-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "production";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.ALLOW_JSON_FALLBACK = "false";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";
  process.env.LLM_PROVIDER_CHAIN = "mock";
  delete process.env.LLM_PROVIDER;

  await fs.writeFile(
    path.join(runtimeDir, "ai-provider-config.json"),
    JSON.stringify(
      {
        providerChain: ["deepseek", "kimi"],
        updatedAt: "2026-03-17T00:00:00.000Z",
        updatedBy: "legacy-json"
      },
      null,
      2
    )
  );

  resetModules();

  const dbState = {
    runtimeRow: null as null | {
      id: string;
      provider_chain: string[];
      updated_at: string;
      updated_by: string | null;
    },
    writes: [] as Array<{ providerChain: string[] }>
  };

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string) => {
    if (text.includes("FROM ai_provider_runtime_config")) {
      return dbState.runtimeRow;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("INSERT INTO ai_provider_runtime_config")) {
      dbState.writes.push({
        providerChain: Array.isArray(params[1]) ? (params[1] as string[]) : []
      });
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/ai-config") as AiConfigModule;

  try {
    await mod.refreshRuntimeAiProviderConfig();

    const runtime = mod.getRuntimeAiProviderConfig();
    assert.deepEqual(runtime.providerChain, []);
    assert.deepEqual(mod.getEffectiveAiProviderChain(), ["mock"]);
    assert.equal(dbState.writes.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
