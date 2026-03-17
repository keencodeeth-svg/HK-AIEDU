import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AiTaskPoliciesModule = typeof import("../../lib/ai-task-policies");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "HIGH_FREQUENCY_STATE_REQUIRE_DB",
  "LLM_PROVIDER",
  "LLM_PROVIDER_CHAIN",
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

function resetAiPolicyModules() {
  const targets = [
    "../../lib/ai-task-policies",
    "../../lib/ai-config",
    "../../lib/storage",
    "../../lib/db",
    "../../lib/request-context",
    "../../lib/runtime-guardrails"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function loadAiTaskPoliciesModule(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}
) {
  restoreEnv();

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-policy-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.LLM_PROVIDER_CHAIN = "mock";
  delete process.env.DATABASE_URL;
  delete process.env.REQUIRE_DATABASE;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.LLM_PROVIDER;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetAiPolicyModules();
  const mod = require("../../lib/ai-task-policies") as AiTaskPoliciesModule;
  return { mod, root, runtimeDir, seedDir };
}

afterEach(() => {
  resetAiPolicyModules();
  restoreEnv();
});

test("saveAiTaskPolicy normalizes runtime overrides and resetAiTaskPolicy restores env defaults", async () => {
  const { mod, root, runtimeDir } = await loadAiTaskPoliciesModule({
    LLM_PROVIDER_CHAIN: "DeepSeek, mock, Kimi"
  });

  try {
    const defaultPolicy = mod.getAiTaskPolicy("assist");
    assert.equal(defaultPolicy.source, "default");
    assert.deepEqual(defaultPolicy.providerChain, ["deepseek", "mock", "kimi"]);
    assert.equal(defaultPolicy.timeoutMs, 8000);
    assert.equal(defaultPolicy.maxRetries, 1);

    const saved = await mod.saveAiTaskPolicy({
      taskType: "assist",
      providerChain: ["GLM", " custom ", "openai_compatible", "glm", ""],
      timeoutMs: 999999,
      maxRetries: -2,
      budgetLimit: 50,
      minQualityScore: 101,
      updatedBy: " admin "
    });

    assert.equal(saved.source, "runtime");
    assert.deepEqual(saved.providerChain, ["zhipu", "custom", "compatible"]);
    assert.equal(saved.timeoutMs, 30000);
    assert.equal(saved.maxRetries, 0);
    assert.equal(saved.budgetLimit, 100);
    assert.equal(saved.minQualityScore, 100);
    assert.equal(saved.updatedBy, "admin");

    const stored = await readJsonFile<Record<string, any>>(path.join(runtimeDir, "ai-task-policies.json"));
    assert.deepEqual(stored.assist.providerChain, ["zhipu", "custom", "compatible"]);
    assert.equal(stored.assist.timeoutMs, 30000);
    assert.equal(stored.assist.updatedBy, "admin");

    const reset = (await mod.resetAiTaskPolicy("assist")) as ReturnType<AiTaskPoliciesModule["getAiTaskPolicy"]>;
    assert.equal(reset.source, "default");
    assert.deepEqual(reset.providerChain, ["deepseek", "mock", "kimi"]);
    assert.equal(reset.timeoutMs, 8000);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("saveAiTaskPolicies batch update persists multiple runtime policies and resetAiTaskPolicy clears all overrides", async () => {
  const { mod, root, runtimeDir } = await loadAiTaskPoliciesModule({
    LLM_PROVIDER_CHAIN: "mock"
  });

  try {
    const policies = await mod.saveAiTaskPolicies(
      [
        {
          taskType: "probe",
          providerChain: ["seed", "seed", "mock"],
          timeoutMs: 6500,
          maxRetries: 3,
          budgetLimit: 10,
          minQualityScore: 5
        },
        {
          taskType: "learning_report",
          timeoutMs: 250,
          maxRetries: 8,
          budgetLimit: 2800,
          minQualityScore: -10
        }
      ],
      " ops "
    );

    const probe = policies.find((item) => item.taskType === "probe");
    const report = policies.find((item) => item.taskType === "learning_report");

    assert.ok(probe);
    assert.equal(probe?.source, "runtime");
    assert.deepEqual(probe?.providerChain, ["seedance", "mock"]);
    assert.equal(probe?.timeoutMs, 6500);
    assert.equal(probe?.maxRetries, 3);
    assert.equal(probe?.budgetLimit, 100);
    assert.equal(probe?.minQualityScore, 5);
    assert.equal(probe?.updatedBy, "ops");

    assert.ok(report);
    assert.equal(report?.source, "runtime");
    assert.deepEqual(report?.providerChain, ["mock"]);
    assert.equal(report?.timeoutMs, 500);
    assert.equal(report?.maxRetries, 5);
    assert.equal(report?.budgetLimit, 2800);
    assert.equal(report?.minQualityScore, 0);
    assert.equal(report?.updatedBy, "ops");

    const stored = await readJsonFile<Record<string, any>>(path.join(runtimeDir, "ai-task-policies.json"));
    assert.deepEqual(Object.keys(stored).sort(), ["learning_report", "probe"]);

    const resetAll = (await mod.resetAiTaskPolicy()) as ReturnType<AiTaskPoliciesModule["getAiTaskPolicies"]>;
    assert.equal(resetAll.filter((item) => item.source === "runtime").length, 0);
    assert.equal(mod.getAiTaskPolicy("probe").source, "default");
    assert.equal(mod.getAiTaskPolicy("learning_report").source, "default");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("recordAiCallLog and getAiCallMetricsSummary aggregate file-backed call metrics", async () => {
  const { mod, root, runtimeDir } = await loadAiTaskPoliciesModule();

  try {
    const longPolicyDetail = "q".repeat(220);
    const longErrorMessage = "e".repeat(320);

    mod.recordAiCallLog({
      taskType: "assist",
      provider: "deepseek",
      capability: "chat",
      ok: true,
      latencyMs: 100.4,
      fallbackCount: 0,
      timeout: false,
      requestChars: 101,
      responseChars: 201,
      qualityScore: 88.8,
      traceId: "trace-1"
    });

    mod.recordAiCallLog({
      taskType: "assist",
      provider: "deepseek",
      capability: "chat",
      ok: false,
      latencyMs: 200.7,
      fallbackCount: 1,
      timeout: true,
      requestChars: 120,
      responseChars: 0,
      qualityScore: 40,
      policyHit: "quality_threshold",
      policyDetail: longPolicyDetail,
      errorMessage: longErrorMessage,
      traceId: "trace-2"
    });

    mod.recordAiCallLog({
      taskType: "explanation",
      provider: "mock",
      capability: "vision",
      ok: false,
      latencyMs: 50,
      fallbackCount: 0,
      timeout: false,
      requestChars: 50,
      responseChars: 10,
      policyHit: "budget_limit",
      policyDetail: "budget",
      errorMessage: "rate limited",
      traceId: "trace-3"
    });

    const summary = await mod.getAiCallMetricsSummary(2);

    assert.equal(summary.totalCalls, 3);
    assert.equal(summary.successCalls, 1);
    assert.equal(summary.successRate, 33.33);
    assert.equal(summary.fallbackRate, 33.33);
    assert.equal(summary.timeoutRate, 33.33);
    assert.equal(summary.qualityRejectRate, 33.33);
    assert.equal(summary.budgetRejectRate, 33.33);
    assert.equal(summary.avgLatencyMs, 117);
    assert.equal(summary.p95LatencyMs, 201);
    assert.deepEqual(summary.rows.map((item) => item.key), ["assist:deepseek", "explanation:mock"]);
    assert.equal(summary.rows[0]?.calls, 2);
    assert.equal(summary.rows[0]?.successRate, 50);
    assert.equal(summary.rows[0]?.timeoutRate, 50);
    assert.equal(summary.rows[0]?.avgFallback, 0.5);
    assert.equal(summary.rows[0]?.qualityRejectRate, 50);
    assert.equal(summary.rows[0]?.avgLatencyMs, 150.5);
    assert.equal(summary.rows[0]?.p95LatencyMs, 201);
    assert.equal(summary.rows[0]?.avgRequestChars, 110.5);
    assert.equal(summary.rows[0]?.avgResponseChars, 100.5);
    assert.deepEqual(
      summary.recentFailures.map((item) => `${item.provider}:${item.policyHit}`),
      ["mock:budget_limit", "deepseek:quality_threshold"]
    );

    const stored = await readJsonFile<Array<Record<string, any>>>(path.join(runtimeDir, "ai-call-logs.json"));
    assert.equal(stored.length, 3);
    assert.equal(stored[1]?.latencyMs, 201);
    assert.equal(stored[1]?.policyDetail.length, 160);
    assert.equal(stored[1]?.errorMessage.length, 280);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed task policies ignore legacy json bootstrap when guardrails disable fallback", async () => {
  restoreEnv();

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-policy-guarded-"));
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

  await fs.writeFile(
    path.join(runtimeDir, "ai-task-policies.json"),
    JSON.stringify(
      {
        assist: {
          providerChain: ["deepseek"],
          timeoutMs: 19000,
          maxRetries: 4,
          budgetLimit: 4000,
          minQualityScore: 88,
          updatedAt: "2026-03-17T00:00:00.000Z",
          updatedBy: "legacy-json"
        }
      },
      null,
      2
    )
  );

  resetAiPolicyModules();

  const dbState = {
    policyRows: [] as Array<Record<string, unknown>>,
    inserts: [] as Array<{ taskType: string }>
  };

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
    queryOne?: (text: string, params?: unknown[]) => Promise<unknown>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM ai_task_policies")) {
      return dbState.policyRows;
    }
    if (text.includes("INSERT INTO ai_task_policies")) {
      dbState.inserts.push({ taskType: String(params[0]) });
      return [];
    }
    if (text.includes("FROM ai_call_logs")) {
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/ai-task-policies") as AiTaskPoliciesModule;

  try {
    await mod.refreshAiTaskPolicies();

    const assist = mod.getAiTaskPolicy("assist");
    assert.equal(assist.source, "default");
    assert.deepEqual(assist.providerChain, ["mock"]);
    assert.equal(assist.timeoutMs, 8000);
    assert.equal(dbState.inserts.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
