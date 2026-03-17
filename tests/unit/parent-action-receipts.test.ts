import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type ParentActionReceiptsModule = typeof import("../../lib/parent-action-receipts");
type ParentActionReceiptRouteModule = typeof import("../../app/api/parent/action-items/receipt/route");

type MockDbParentActionReceipt = {
  id: string;
  parent_id: string;
  student_id: string;
  source: string;
  action_item_id: string;
  status: string;
  note: string | null;
  estimated_minutes: number;
  effect_score: number;
  completed_at: string;
  created_at: string;
  updated_at: string;
};

type RouteModule = {
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

const ENV_KEYS = [
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
  "API_TEST_SCOPE",
  "API_TEST_SUITE",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "NODE_ENV",
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

function resetModules() {
  const targets = [
    "../../lib/parent-action-receipts",
    "../../lib/storage",
    "../../lib/runtime-guardrails",
    "../../lib/db",
    "../../app/api/parent/action-items/receipt/route",
    "../../lib/auth",
    "../../lib/api/route-factory",
    "../../lib/api/domains/index",
    "../../lib/api/domains/learning",
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

function normalizeSource(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "assignment_plan" ? "assignment_plan" : "weekly_report";
}

function normalizeStatus(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "skipped" ? "skipped" : "done";
}

function normalizeActionItemId(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-parent-action-receipts-"));
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
  process.env.API_TEST_SUITE = "parent-action-receipts";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  const mod = require("../../lib/parent-action-receipts") as ParentActionReceiptsModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule(initialRows: MockDbParentActionReceipt[]) {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState = {
    rows: initialRows.map((row) => ({ ...row })),
    updates: [] as Array<{ id: string; source: string; actionItemId: string; status: string }>,
    inserts: [] as Array<{ source: string; actionItemId: string; status: string }>
  };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM parent_action_receipts")) {
      const parentId = String(params[0] ?? "");
      const studentId = String(params[1] ?? "");
      const source = typeof params[2] === "string" ? normalizeSource(String(params[2])) : null;

      return dbState.rows
        .filter((row) => row.parent_id === parentId && row.student_id === studentId)
        .filter((row) => (source ? normalizeSource(row.source) === source : true))
        .sort((left, right) => right.completed_at.localeCompare(left.completed_at));
    }

    throw new Error(`unexpected query: ${text}`);
  };

  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM parent_action_receipts")) {
      const parentId = String(params[0] ?? "");
      const studentId = String(params[1] ?? "");
      const source = normalizeSource(String(params[2] ?? ""));
      const actionItemId = normalizeActionItemId(String(params[3] ?? ""));
      return (
        dbState.rows.find(
          (row) =>
            row.parent_id === parentId &&
            row.student_id === studentId &&
            normalizeSource(row.source) === source &&
            normalizeActionItemId(row.action_item_id) === actionItemId
        ) ?? null
      );
    }

    if (text.includes("UPDATE parent_action_receipts")) {
      const index = dbState.rows.findIndex((row) => row.id === String(params[0]));
      if (index < 0) return null;

      dbState.rows[index] = {
        ...dbState.rows[index],
        source: String(params[1]),
        action_item_id: String(params[2]),
        status: String(params[3]),
        note: params[4] === null ? null : String(params[4]),
        estimated_minutes: Number(params[5]),
        effect_score: Number(params[6]),
        completed_at: String(params[7]),
        updated_at: String(params[8])
      };

      dbState.updates.push({
        id: String(params[0]),
        source: String(params[1]),
        actionItemId: String(params[2]),
        status: String(params[3])
      });

      return dbState.rows[index];
    }

    if (text.includes("INSERT INTO parent_action_receipts")) {
      const nextRow: MockDbParentActionReceipt = {
        id: String(params[0]),
        parent_id: String(params[1]),
        student_id: String(params[2]),
        source: String(params[3]),
        action_item_id: String(params[4]),
        status: String(params[5]),
        note: params[6] === null ? null : String(params[6]),
        estimated_minutes: Number(params[7]),
        effect_score: Number(params[8]),
        completed_at: String(params[9]),
        created_at: String(params[10]),
        updated_at: String(params[11])
      };
      dbState.rows.push(nextRow);
      dbState.inserts.push({
        source: nextRow.source,
        actionItemId: nextRow.action_item_id,
        status: nextRow.status
      });
      return nextRow;
    }

    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/parent-action-receipts") as ParentActionReceiptsModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

function createReceiptRequest(body: unknown) {
  return new Request("https://demo.test/api/parent/action-items/receipt", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createRouteReceipt(input: Record<string, unknown>) {
  return {
    id: "receipt-1",
    parentId: "parent-1",
    studentId: "student-1",
    source: String(input.source),
    actionItemId: String(input.actionItemId),
    status: String(input.status),
    note: input.note === undefined ? null : input.note,
    estimatedMinutes: Number(input.estimatedMinutes ?? 0),
    effectScore: Number(input.effectScore ?? 0),
    completedAt: "2026-03-17T00:00:00.000Z",
    createdAt: "2026-03-17T00:00:00.000Z",
    updatedAt: "2026-03-17T00:00:00.000Z"
  };
}

function loadReceiptRoute(overrides?: {
  upsertParentActionReceipt?: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const authMod = require("../../lib/auth") as {
    getCurrentUser: () => Promise<unknown>;
    getSessionCookieName: () => string;
  };
  authMod.getCurrentUser = async () => ({
    id: "parent-1",
    role: "parent",
    studentId: "student-1",
    email: "parent@example.com",
    name: "Parent"
  });
  authMod.getSessionCookieName = () => "mvp_session";

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

  const receiptsMod = require("../../lib/parent-action-receipts") as {
    listParentActionReceipts: () => Promise<unknown[]>;
    upsertParentActionReceipt: (input: Record<string, unknown>) => Promise<unknown>;
  };
  receiptsMod.listParentActionReceipts = async () => [];
  receiptsMod.upsertParentActionReceipt =
    overrides?.upsertParentActionReceipt ?? (async (input) => createRouteReceipt(input));

  return withAliasResolution(
    () => require("../../app/api/parent/action-items/receipt/route") as ParentActionReceiptRouteModule & RouteModule
  );
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed parent action receipts normalize legacy source, status, and action ids on read and update", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "parent-action-receipts.json"),
      JSON.stringify(
        [
          {
            id: "receipt-legacy-1",
            parentId: "parent-1",
            studentId: "student-1",
            source: " ASSIGNMENT_PLAN ",
            actionItemId: " Daily-Checklist ",
            status: " SKIPPED ",
            note: "later",
            estimatedMinutes: 400,
            effectScore: -999,
            completedAt: "2026-03-17T00:00:00.000Z",
            createdAt: "2026-03-16T00:00:00.000Z",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const listed = await mod.listParentActionReceipts({
      parentId: "parent-1",
      studentId: "student-1",
      source: "assignment_plan"
    });

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.source, "assignment_plan");
    assert.equal(listed[0]?.actionItemId, "daily-checklist");
    assert.equal(listed[0]?.status, "skipped");
    assert.equal(listed[0]?.estimatedMinutes, 240);
    assert.equal(listed[0]?.effectScore, -100);
    assert.equal(
      mod.buildParentActionReceiptKey({
        source: "assignment_plan",
        actionItemId: " DAILY-CHECKLIST "
      }),
      "assignment_plan:daily-checklist"
    );

    const updated = await mod.upsertParentActionReceipt({
      parentId: "parent-1",
      studentId: "student-1",
      source: " ASSIGNMENT_PLAN " as any,
      actionItemId: " DAILY-CHECKLIST ",
      status: " DONE " as any,
      note: "done",
      estimatedMinutes: 25,
      effectScore: 12
    });

    assert.equal(updated?.id, "receipt-legacy-1");
    assert.equal(updated?.source, "assignment_plan");
    assert.equal(updated?.actionItemId, "daily-checklist");
    assert.equal(updated?.status, "done");

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "parent-action-receipts.json"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.source, "assignment_plan");
    assert.equal(stored[0]?.actionItemId, "daily-checklist");
    assert.equal(stored[0]?.status, "done");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed parent action receipts reuse legacy mixed-case rows instead of inserting duplicates", async () => {
  const { mod, root, dbState } = await loadDbBackedModule([
    {
      id: "receipt-db-1",
      parent_id: "parent-1",
      student_id: "student-1",
      source: " ASSIGNMENT_PLAN ",
      action_item_id: " Daily-Checklist ",
      status: " SKIPPED ",
      note: "later",
      estimated_minutes: 30,
      effect_score: -10,
      completed_at: "2026-03-17T00:00:00.000Z",
      created_at: "2026-03-16T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z"
    }
  ]);

  try {
    const listed = await mod.listParentActionReceipts({
      parentId: "parent-1",
      studentId: "student-1",
      source: "assignment_plan"
    });

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.source, "assignment_plan");
    assert.equal(listed[0]?.actionItemId, "daily-checklist");
    assert.equal(listed[0]?.status, "skipped");

    const updated = await mod.upsertParentActionReceipt({
      parentId: "parent-1",
      studentId: "student-1",
      source: " ASSIGNMENT_PLAN " as any,
      actionItemId: " DAILY-CHECKLIST ",
      status: " DONE " as any,
      note: "done",
      estimatedMinutes: 20,
      effectScore: 8
    });

    assert.equal(updated?.id, "receipt-db-1");
    assert.equal(updated?.source, "assignment_plan");
    assert.equal(updated?.actionItemId, "daily-checklist");
    assert.equal(updated?.status, "done");
    assert.equal(dbState.updates.length, 1);
    assert.equal(dbState.inserts.length, 0);
    assert.equal(normalizeSource(dbState.rows[0]?.source), "assignment_plan");
    assert.equal(normalizeActionItemId(dbState.rows[0]?.action_item_id), "daily-checklist");
    assert.equal(normalizeStatus(dbState.rows[0]?.status), "done");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("parent action receipt route accepts mixed-case source, status, and action item ids", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const route = loadReceiptRoute({
    upsertParentActionReceipt: async (input) => {
      calls.push(input);
      return createRouteReceipt(input);
    }
  });

  const response = await route.POST?.(
    createReceiptRequest({
      source: " Assignment_Plan ",
      actionItemId: " DAILY-CHECKLIST ",
      status: " SKIPPED ",
      note: "later",
      estimatedMinutes: 18
    }),
    { params: {} }
  );

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.source, "assignment_plan");
  assert.equal(calls[0]?.actionItemId, "daily-checklist");
  assert.equal(calls[0]?.status, "skipped");
});
