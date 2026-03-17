import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type ExperimentsModule = typeof import("../../lib/experiments");
type ExperimentFlagsRouteModule = typeof import("../../app/api/admin/experiments/flags/route");

type MockDbExperimentFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout: number;
  updated_at: string;
};

const ENV_KEYS = [
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "NODE_ENV",
  "RUNTIME_GUARDRAILS_ENFORCE"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));
const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

type RouteModule = {
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

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

function resetModules() {
  const targets = [
    "../../app/api/admin/experiments/flags/route",
    "../../lib/admin-log",
    "../../lib/admin-step-up",
    "../../lib/experiments",
    "../../lib/storage",
    "../../lib/runtime-guardrails",
    "../../lib/db",
    "../../lib/auth",
    "../../lib/progress",
    "../../lib/guard",
    "../../lib/api/route-factory",
    "../../lib/api/domains/admin",
    "../../lib/api/domains/index",
    "../../lib/api/domains/route",
    "../../lib/api/http",
    "../../lib/error-tracker",
    "../../lib/observability",
    "../../lib/request-context"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function setMockModule(modulePath: string, exportsValue: Record<string, unknown>) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    path: path.dirname(resolved),
    paths: []
  } as unknown as NodeModule;
}

function normalizeExperimentKey(value: string) {
  return value.trim().toLowerCase();
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-experiments-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });
  return { root, runtimeDir, seedDir };
}

async function loadFileBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  setMockModule("../../lib/auth", { getUsers: async () => [] });
  setMockModule("../../lib/progress", { getAttempts: async () => [] });

  const mod = require("../../lib/experiments") as ExperimentsModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule(initialRows: MockDbExperimentFlag[]) {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState = {
    rows: initialRows.map((row) => ({ ...row }))
  };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  setMockModule("../../lib/auth", { getUsers: async () => [] });
  setMockModule("../../lib/progress", { getAttempts: async () => [] });

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM experiment_flags ORDER BY key ASC")) {
      return dbState.rows.slice().sort((left, right) => left.key.localeCompare(right.key));
    }

    if (text.includes("INSERT INTO experiment_flags")) {
      dbState.rows.push({
        id: String(params[0]),
        key: String(params[1]),
        name: String(params[2]),
        description: params[3] === null ? null : String(params[3]),
        enabled: Boolean(params[4]),
        rollout: Number(params[5]),
        updated_at: String(params[6])
      });
      return [];
    }

    throw new Error(`unexpected query: ${text}`);
  };

  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("UPDATE experiment_flags")) {
      const index = dbState.rows.findIndex((item) => item.id === String(params[0]));
      if (index < 0) return null;
      dbState.rows[index] = {
        ...dbState.rows[index],
        key: String(params[1]),
        name: String(params[2]),
        description: params[3] === null ? null : String(params[3]),
        enabled: Boolean(params[4]),
        rollout: Number(params[5]),
        updated_at: String(params[6])
      };
      return dbState.rows[index];
    }

    if (text.includes("INSERT INTO experiment_flags")) {
      const row = {
        id: String(params[0]),
        key: String(params[1]),
        name: String(params[2]),
        description: params[3] === null ? null : String(params[3]),
        enabled: Boolean(params[4]),
        rollout: Number(params[5]),
        updated_at: String(params[6])
      };
      dbState.rows.push(row);
      return row;
    }

    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/experiments") as ExperimentsModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

function createExperimentFlag(key: string, overrides?: Partial<{
  enabled: boolean;
  rollout: number;
}>){
  return {
    id: "exp-route-1",
    key,
    name: "挑战学习闭环 V2",
    description: "route test",
    enabled: overrides?.enabled ?? true,
    rollout: overrides?.rollout ?? 50,
    updatedAt: "2026-03-17T00:00:00.000Z"
  };
}

function createExperimentFlagsRequest(body: unknown) {
  return new Request("https://demo.test/api/admin/experiments/flags", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function loadExperimentFlagsRoute(overrides?: {
  getExperimentFlag?: (key: string) => Promise<unknown>;
  listExperimentFlags?: () => Promise<unknown[]>;
  upsertExperimentFlag?: (input: Record<string, unknown>) => Promise<unknown>;
  addAdminLog?: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  setMockModule("../../lib/auth", {
    getCurrentUser: async () => ({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
      name: "平台管理员"
    }),
    getSessionCookieName: () => "mvp_session",
    getUsers: async () => []
  });
  setMockModule("../../lib/progress", { getAttempts: async () => [] });
  setMockModule("../../lib/guard", {
    requireRole: async (role: string) =>
      role === "admin"
        ? {
            id: "admin-1",
            role: "admin",
            email: "admin@example.com",
            name: "平台管理员"
          }
        : null
  });
  setMockModule("../../lib/admin-step-up", {
    assertAdminStepUp: () => {}
  });

  const logCalls: Array<Record<string, unknown>> = [];
  setMockModule("../../lib/admin-log", {
    addAdminLog: async (input: Record<string, unknown>) => {
      logCalls.push(input);
      return overrides?.addAdminLog ? overrides.addAdminLog(input) : input;
    }
  });
  setMockModule("../../lib/error-tracker", {
    reportApiServerError: async () => {}
  });
  setMockModule("../../lib/observability", {
    recordApiRequest: async () => {}
  });
  setMockModule("../../lib/runtime-guardrails", {
    getRuntimeGuardrailIssues: () => [],
    logRuntimeGuardrailIssues: () => {}
  });

  const experimentCalls = {
    get: [] as string[],
    upsert: [] as Array<Record<string, unknown>>
  };
  setMockModule("../../lib/experiments", {
    getExperimentFlag: async (key: string) => {
      experimentCalls.get.push(key);
      return overrides?.getExperimentFlag
        ? overrides.getExperimentFlag(key)
        : createExperimentFlag(normalizeExperimentKey(key));
    },
    listExperimentFlags: async () =>
      overrides?.listExperimentFlags
        ? overrides.listExperimentFlags()
        : [createExperimentFlag("challenge_learning_loop_v2", { enabled: false, rollout: 18 })],
    upsertExperimentFlag: async (input: Record<string, unknown>) => {
      experimentCalls.upsert.push(input);
      return overrides?.upsertExperimentFlag
        ? overrides.upsertExperimentFlag(input)
        : createExperimentFlag(String(input.key ?? "challenge_learning_loop_v2"), {
            enabled: Boolean(input.enabled),
            rollout: Number(input.rollout ?? 0)
          });
    },
    CHALLENGE_EXPERIMENT_KEY: "challenge_learning_loop_v2"
  });

  const route = withAliasResolution(
    () => require("../../app/api/admin/experiments/flags/route") as ExperimentFlagsRouteModule & RouteModule
  );
  return { route, logCalls, experimentCalls };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed experiments normalize legacy keys, dedupe defaults, and keep bucketing stable across key casing", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "experiment-flags.json"),
      JSON.stringify(
        [
          {
            id: "exp-legacy-1",
            key: " Challenge_Learning_Loop_V2 ",
            name: "挑战学习闭环 V2",
            description: "legacy",
            enabled: false,
            rollout: 23,
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const flags = await mod.listExperimentFlags();
    assert.equal(flags.length, 1);
    assert.equal(flags[0]?.key, mod.CHALLENGE_EXPERIMENT_KEY);
    assert.equal(flags[0]?.rollout, 23);

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "experiment-flags.json"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.key, mod.CHALLENGE_EXPERIMENT_KEY);

    const lower = await mod.assignExperimentVariant({
      key: mod.CHALLENGE_EXPERIMENT_KEY,
      userId: "u-student-001",
      flag: flags[0] ?? null
    });
    const upper = await mod.assignExperimentVariant({
      key: mod.CHALLENGE_EXPERIMENT_KEY.toUpperCase(),
      userId: "u-student-001",
      flag: flags[0] ?? null
    });

    assert.equal(lower.key, mod.CHALLENGE_EXPERIMENT_KEY);
    assert.equal(upper.key, mod.CHALLENGE_EXPERIMENT_KEY);
    assert.equal(lower.bucket, upper.bucket);
    assert.equal(lower.variant, upper.variant);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed experiment upserts reuse legacy rows with mixed-case keys instead of creating duplicates", async () => {
  const { mod, root, dbState } = await loadDbBackedModule([
    {
      id: "exp-db-1",
      key: "CHALLENGE_LEARNING_LOOP_V2",
      name: "挑战学习闭环 V2",
      description: "legacy",
      enabled: true,
      rollout: 50,
      updated_at: "2026-03-17T00:00:00.000Z"
    }
  ]);

  try {
    const current = await mod.getExperimentFlag(mod.CHALLENGE_EXPERIMENT_KEY);
    assert.equal(current?.id, "exp-db-1");
    assert.equal(current?.key, mod.CHALLENGE_EXPERIMENT_KEY);

    const updated = await mod.upsertExperimentFlag({
      key: " challenge_learning_LOOP_v2 ",
      enabled: false,
      rollout: 12
    });

    assert.equal(updated.key, mod.CHALLENGE_EXPERIMENT_KEY);
    assert.equal(updated.id, "exp-db-1");
    assert.equal(dbState.rows.length, 1);
    assert.equal(normalizeExperimentKey(dbState.rows[0]?.key ?? ""), mod.CHALLENGE_EXPERIMENT_KEY);
    assert.equal(dbState.rows[0]?.enabled, false);
    assert.equal(dbState.rows[0]?.rollout, 12);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("admin experiments flags route normalizes mixed-case keys before update and audit logging", async () => {
  const { route, logCalls, experimentCalls } = loadExperimentFlagsRoute({
    getExperimentFlag: async (key) => createExperimentFlag(key, { enabled: true, rollout: 50 }),
    listExperimentFlags: async () => [createExperimentFlag("challenge_learning_loop_v2", { enabled: false, rollout: 12 })],
    upsertExperimentFlag: async (input) =>
      createExperimentFlag(String(input.key ?? "challenge_learning_loop_v2"), {
        enabled: Boolean(input.enabled),
        rollout: Number(input.rollout ?? 0)
      })
  });

  const response = await route.POST?.(
    createExperimentFlagsRequest({
      key: " Challenge_Learning_Loop_V2 ",
      enabled: false,
      rollout: 12
    }),
    { params: {} }
  );

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.deepEqual(experimentCalls.get, ["challenge_learning_loop_v2"]);
  assert.equal(experimentCalls.upsert.length, 1);
  assert.equal(experimentCalls.upsert[0]?.key, "challenge_learning_loop_v2");
  assert.equal(logCalls.length, 1);
  assert.equal(logCalls[0]?.entityId, "challenge_learning_loop_v2");

  const detail = JSON.parse(String(logCalls[0]?.detail ?? "{}")) as { meta?: { key?: string } };
  assert.equal(detail.meta?.key, "challenge_learning_loop_v2");

  const payload = (await response.json()) as {
    code: number;
    data?: { key?: string };
    flags?: Array<{ key: string }>;
  };
  assert.equal(payload.code, 0);
  assert.equal(payload.data?.key, "challenge_learning_loop_v2");
  assert.equal(payload.flags?.[0]?.key, "challenge_learning_loop_v2");
});
