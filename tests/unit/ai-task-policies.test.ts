import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type AiTaskPoliciesModule = typeof import("../../lib/ai-task-policies");
type AiPoliciesRouteModule = typeof import("../../app/api/admin/ai/policies/route");

type RouteModule = {
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

const ENV_KEYS = [
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
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

function withAliasResolution<T>(fn: () => T): T {
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      return originalResolveFilename.call(this, path.resolve(projectRoot, request.slice(2)), parent, isMain, options);
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  try {
    return fn();
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }
}

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

function resetAiPolicyRouteModules() {
  const targets = [
    "../../app/api/admin/ai/policies/route",
    "../../lib/admin-log",
    "../../lib/admin-step-up",
    "../../lib/auth",
    "../../lib/guard",
    "../../lib/api/route-factory",
    "../../lib/api/domains/admin",
    "../../lib/api/domains/index",
    "../../lib/api/domains/route",
    "../../lib/api/http",
    "../../lib/error-tracker",
    "../../lib/observability",
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
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {},
  options?: {
    runtimeFiles?: Record<string, unknown>;
  }
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

  if (options?.runtimeFiles) {
    await Promise.all(
      Object.entries(options.runtimeFiles).map(([fileName, value]) =>
        fs.writeFile(path.join(runtimeDir, fileName), JSON.stringify(value, null, 2))
      )
    );
  }

  resetAiPolicyModules();
  const mod = require("../../lib/ai-task-policies") as AiTaskPoliciesModule;
  return { mod, root, runtimeDir, seedDir };
}

function createPolicy(taskType: string) {
  return {
    taskType,
    label: taskType,
    description: `${taskType} policy`,
    providerChain: ["mock"],
    timeoutMs: 8000,
    maxRetries: 1,
    budgetLimit: 1800,
    minQualityScore: 65,
    source: "runtime" as const,
    updatedAt: "2026-03-17T00:00:00.000Z",
    updatedBy: "admin-1"
  };
}

function createAdminPolicyRequest(body: unknown) {
  return new Request("https://demo.test/api/admin/ai/policies", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function loadAiPoliciesRoute(overrides?: {
  saveAiTaskPolicy?: (input: Record<string, unknown>) => Promise<unknown>;
  saveAiTaskPolicies?: (items: Array<Record<string, unknown>>, updatedBy?: string) => Promise<unknown>;
  resetAiTaskPolicy?: (taskType?: string) => Promise<unknown>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetAiPolicyModules();
  resetAiPolicyRouteModules();

  const authMod = require("../../lib/auth") as {
    getCurrentUser: () => Promise<unknown>;
    getSessionCookieName: () => string;
  };
  authMod.getCurrentUser = async () => ({
    id: "admin-1",
    role: "admin",
    email: "admin@example.com",
    name: "平台管理员"
  });
  authMod.getSessionCookieName = () => "mvp_session";

  const guardMod = require("../../lib/guard") as {
    requireRole: (role: string) => Promise<unknown>;
  };
  guardMod.requireRole = async (role: string) =>
    role === "admin"
      ? {
          id: "admin-1",
          role: "admin",
          email: "admin@example.com",
          name: "平台管理员"
        }
      : null;

  const stepUpMod = require("../../lib/admin-step-up") as {
    assertAdminStepUp: (user: { id: string; role?: string }) => void;
  };
  stepUpMod.assertAdminStepUp = () => {};

  const adminLogMod = require("../../lib/admin-log") as {
    addAdminLog: (input: Record<string, unknown>) => Promise<unknown>;
  };
  adminLogMod.addAdminLog = async (input) => input;

  const observabilityMod = require("../../lib/observability") as {
    recordApiRequest: (input: Record<string, unknown>) => Promise<void>;
  };
  observabilityMod.recordApiRequest = async () => {};

  const errorTrackerMod = require("../../lib/error-tracker") as {
    reportApiServerError: (input: Record<string, unknown>) => Promise<void>;
  };
  errorTrackerMod.reportApiServerError = async () => {};

  const runtimeGuardrailsMod = require("../../lib/runtime-guardrails") as {
    getRuntimeGuardrailIssues: () => unknown[];
    logRuntimeGuardrailIssues: (issues: unknown[]) => void;
  };
  runtimeGuardrailsMod.getRuntimeGuardrailIssues = () => [];
  runtimeGuardrailsMod.logRuntimeGuardrailIssues = () => {};

  const aiPoliciesMod = require("../../lib/ai-task-policies") as {
    getAiTaskPolicies: () => unknown[];
    listAiTaskOptions: () => Array<{ taskType: string; label: string; description: string }>;
    refreshAiTaskPolicies: () => Promise<void>;
    resetAiTaskPolicy: (taskType?: string) => Promise<unknown>;
    saveAiTaskPolicies: (items: Array<Record<string, unknown>>, updatedBy?: string) => Promise<unknown>;
    saveAiTaskPolicy: (input: Record<string, unknown>) => Promise<unknown>;
  };

  aiPoliciesMod.listAiTaskOptions = () => [
    { taskType: "assist", label: "AI辅导", description: "学生问答与学习陪练。" },
    { taskType: "writing_feedback", label: "作文批改", description: "写作结构语法词汇反馈。" },
    { taskType: "probe", label: "模型探测", description: "模型链连通性探测。" }
  ];
  aiPoliciesMod.getAiTaskPolicies = () => [createPolicy("assist"), createPolicy("writing_feedback"), createPolicy("probe")];
  aiPoliciesMod.refreshAiTaskPolicies = async () => {};
  aiPoliciesMod.resetAiTaskPolicy =
    overrides?.resetAiTaskPolicy ??
    (async (taskType?: string) => (taskType ? createPolicy(taskType) : [createPolicy("assist")]));
  aiPoliciesMod.saveAiTaskPolicies =
    overrides?.saveAiTaskPolicies ??
    (async (items: Array<Record<string, unknown>>) =>
      items.map((item) => createPolicy(String(item.taskType ?? "assist"))));
  aiPoliciesMod.saveAiTaskPolicy =
    overrides?.saveAiTaskPolicy ??
    (async (input: Record<string, unknown>) => createPolicy(String(input.taskType ?? "assist")));

  return withAliasResolution(
    () => require("../../app/api/admin/ai/policies/route") as AiPoliciesRouteModule & RouteModule
  );
}

afterEach(() => {
  resetAiPolicyModules();
  resetAiPolicyRouteModules();
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

test("file-backed task policies load legacy mixed-case taskType keys and rewrite saves to canonical keys", async () => {
  const { mod, root, runtimeDir } = await loadAiTaskPoliciesModule(
    {
      LLM_PROVIDER_CHAIN: "mock"
    },
    {
      runtimeFiles: {
        "ai-task-policies.json": {
          ASSIST: {
            providerChain: ["GLM"],
            timeoutMs: 9100,
            maxRetries: 2,
            budgetLimit: 2500,
            minQualityScore: 77,
            updatedAt: "2026-03-17T00:00:00.000Z",
            updatedBy: " Legacy Ops "
          }
        }
      }
    }
  );

  try {
    const assist = mod.getAiTaskPolicy("assist");
    assert.equal(assist.source, "runtime");
    assert.deepEqual(assist.providerChain, ["zhipu"]);
    assert.equal(assist.timeoutMs, 9100);
    assert.equal(assist.updatedBy, "Legacy Ops");

    const saved = await (mod.saveAiTaskPolicy as any)({
      taskType: "ASSIST",
      providerChain: ["Kimi"],
      updatedBy: " admin "
    });

    assert.equal(saved.taskType, "assist");
    assert.deepEqual(saved.providerChain, ["kimi"]);

    const stored = await readJsonFile<Record<string, any>>(path.join(runtimeDir, "ai-task-policies.json"));
    assert.deepEqual(Object.keys(stored), ["assist"]);
    assert.equal(stored.assist.updatedBy, "admin");
    assert.ok(!("ASSIST" in stored));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed task policies accept legacy mixed-case task_type rows and canonicalize runtime writes", async () => {
  restoreEnv();

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-policy-db-normalize-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.LLM_PROVIDER_CHAIN = "mock";
  delete process.env.REQUIRE_DATABASE;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.LLM_PROVIDER;

  resetAiPolicyModules();

  const dbState = {
    policyRows: [
      {
        task_type: "ASSIST",
        provider_chain: ["GLM"],
        timeout_ms: 9200,
        max_retries: 2,
        budget_limit: 2600,
        min_quality_score: 78,
        updated_at: "2026-03-17T00:00:00.000Z",
        updated_by: "legacy-db"
      }
    ] as Array<Record<string, unknown>>,
    writes: [] as Array<{ taskType: string; providerChain: string[] }>
  };

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM ai_task_policies")) {
      return dbState.policyRows;
    }
    if (text.includes("INSERT INTO ai_task_policies")) {
      dbState.writes.push({
        taskType: String(params[0]),
        providerChain: Array.isArray(params[1]) ? (params[1] as string[]) : []
      });
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
    assert.equal(assist.source, "runtime");
    assert.deepEqual(assist.providerChain, ["zhipu"]);
    assert.equal(assist.timeoutMs, 9200);
    assert.equal(assist.updatedBy, "legacy-db");

    const saved = await (mod.saveAiTaskPolicy as any)({
      taskType: "ASSIST",
      providerChain: ["Kimi"],
      updatedBy: " admin "
    });

    assert.equal(saved.taskType, "assist");
    assert.deepEqual(saved.providerChain, ["kimi"]);
    assert.equal(dbState.writes.length, 1);
    assert.equal(dbState.writes[0]?.taskType, "assist");
    assert.deepEqual(dbState.writes[0]?.providerChain, ["kimi"]);
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

test("admin ai policies route accepts mixed-case taskType for single policy updates", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const route = loadAiPoliciesRoute({
    saveAiTaskPolicy: async (input) => {
      calls.push(input);
      return createPolicy(String(input.taskType ?? "assist"));
    }
  });

  const response = await route.POST?.(
    createAdminPolicyRequest({
      taskType: " Writing_Feedback ",
      providerChain: ["mock"]
    }),
    { params: {} }
  );

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.taskType, "writing_feedback");

  const payload = (await response.json()) as { code: number; data?: { policies?: Array<{ taskType: string }> } };
  assert.equal(payload.code, 0);
  assert.ok(payload.data?.policies?.some((item) => item.taskType === "writing_feedback"));
});

test("admin ai policies route accepts mixed-case taskType for batch policy updates", async () => {
  const calls: Array<{ items: Array<Record<string, unknown>>; updatedBy?: string }> = [];
  const route = loadAiPoliciesRoute({
    saveAiTaskPolicies: async (items, updatedBy) => {
      calls.push({ items, updatedBy });
      return items.map((item) => createPolicy(String(item.taskType ?? "assist")));
    }
  });

  const response = await route.POST?.(
    createAdminPolicyRequest({
      policies: [
        { taskType: " ASSIST ", providerChain: ["mock"] },
        { taskType: " ProBe ", timeoutMs: 6500 }
      ]
    }),
    { params: {} }
  );

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(
    calls[0]?.items.map((item) => item.taskType),
    ["assist", "probe"]
  );
  assert.equal(calls[0]?.updatedBy, "admin-1");
});
