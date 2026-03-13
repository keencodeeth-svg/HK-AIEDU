import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type ReviewTasksModule = typeof import("../../lib/review-tasks");

const ENV_KEYS = [
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "HIGH_FREQUENCY_STATE_REQUIRE_DB",
  "NODE_ENV",
  "RUNTIME_GUARDRAILS_ENFORCE",
  "UNIFIED_REVIEW_ENGINE"
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

function resetReviewTaskModules() {
  const targets = ["../../lib/review-tasks", "../../lib/storage", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function loadReviewTasksModule(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}
) {
  restoreEnv();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-review-tasks-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.UNIFIED_REVIEW_ENGINE = "true";
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.HIGH_FREQUENCY_STATE_REQUIRE_DB;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  resetReviewTaskModules();
  const mod = require("../../lib/review-tasks") as ReviewTasksModule;
  return { mod, root, runtimeDir, seedDir };
}

afterEach(() => {
  resetReviewTaskModules();
  restoreEnv();
});

test("UNIFIED_REVIEW_ENGINE=false disables review task store access", async () => {
  const { mod, root } = await loadReviewTasksModule({
    UNIFIED_REVIEW_ENGINE: "false"
  });

  try {
    assert.equal(mod.isUnifiedReviewTaskStoreEnabled(), false);
    const list = await mod.getReviewTasksByUser("user-1");
    assert.deepEqual(list, []);

    const result = await mod.upsertReviewTask({
      userId: "user-1",
      questionId: "q-1",
      sourceType: "wrong",
      status: "active"
    });
    assert.equal(result, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("upsertReviewTask creates and then merges JSON-backed task while keeping id and createdAt", async () => {
  const { mod, root } = await loadReviewTasksModule();

  try {
    const created = await mod.upsertReviewTask({
      userId: "user-1",
      questionId: "q-1",
      sourceType: "wrong",
      subject: "math",
      knowledgePointId: "kp-1",
      status: "active",
      intervalLevel: 1,
      nextReviewAt: "2026-03-12T08:00:00.000Z",
      lastReviewResult: "wrong",
      lastReviewAt: "2026-03-11T08:00:00.000Z",
      reviewCount: 1,
      originType: "practice",
      payload: { grade: "4" }
    });

    assert.ok(created);
    assert.equal(created?.status, "active");
    assert.equal(created?.subject, "math");
    assert.equal(created?.originType, "practice");

    const updated = await mod.upsertReviewTask({
      userId: "user-1",
      questionId: "q-1",
      sourceType: "wrong",
      subject: "math",
      knowledgePointId: "kp-1b",
      status: "completed",
      intervalLevel: 2,
      nextReviewAt: "2026-03-13T08:00:00.000Z",
      lastReviewResult: "correct",
      lastReviewAt: "2026-03-12T08:00:00.000Z",
      reviewCount: 2,
      originType: "exam",
      originPaperId: "paper-1",
      originSubmittedAt: "2026-03-11T09:00:00.000Z",
      payload: { grade: "5" }
    });

    assert.ok(updated);
    assert.equal(updated?.id, created?.id);
    assert.equal(updated?.createdAt, created?.createdAt);
    assert.equal(updated?.status, "completed");
    assert.equal(updated?.completedAt, "2026-03-12T08:00:00.000Z");
    assert.equal(updated?.knowledgePointId, "kp-1b");
    assert.equal(updated?.originType, "exam");
    assert.equal(updated?.originPaperId, "paper-1");
    assert.deepEqual(updated?.payload, { grade: "5" });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("getReviewTasksByUser sorts active tasks before completed tasks and filters by source type", async () => {
  const { mod, root, runtimeDir } = await loadReviewTasksModule();

  try {
    await writeJson(path.join(runtimeDir, "review-tasks.json"), [
      {
        id: "task-completed",
        userId: "user-1",
        questionId: "q-3",
        sourceType: "wrong",
        subject: "math",
        knowledgePointId: "kp-3",
        status: "completed",
        intervalLevel: 3,
        nextReviewAt: "2026-03-14T08:00:00.000Z",
        completedAt: "2026-03-14T08:00:00.000Z",
        lastReviewResult: "correct",
        lastReviewAt: "2026-03-14T08:00:00.000Z",
        reviewCount: 3,
        originType: "practice",
        originPaperId: null,
        originSubmittedAt: null,
        payload: null,
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-14T08:00:00.000Z"
      },
      {
        id: "task-memory",
        userId: "user-1",
        questionId: "q-2",
        sourceType: "memory",
        subject: "math",
        knowledgePointId: "kp-2",
        status: "active",
        intervalLevel: 1,
        nextReviewAt: "2026-03-13T08:00:00.000Z",
        completedAt: null,
        lastReviewResult: null,
        lastReviewAt: "2026-03-12T08:00:00.000Z",
        reviewCount: 1,
        originType: null,
        originPaperId: null,
        originSubmittedAt: null,
        payload: { grade: "4" },
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-12T08:00:00.000Z"
      },
      {
        id: "task-wrong",
        userId: "user-1",
        questionId: "q-1",
        sourceType: "wrong",
        subject: "math",
        knowledgePointId: "kp-1",
        status: "active",
        intervalLevel: 2,
        nextReviewAt: "2026-03-12T08:00:00.000Z",
        completedAt: null,
        lastReviewResult: "wrong",
        lastReviewAt: "2026-03-11T08:00:00.000Z",
        reviewCount: 2,
        originType: "practice",
        originPaperId: null,
        originSubmittedAt: null,
        payload: { grade: "4" },
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T09:00:00.000Z"
      }
    ]);

    const activeOnly = await mod.getReviewTasksByUser("user-1");
    assert.deepEqual(activeOnly.map((item) => item.id), ["task-wrong", "task-memory"]);

    const includeCompleted = await mod.getReviewTasksByUser("user-1", {
      includeCompleted: true
    });
    assert.deepEqual(includeCompleted.map((item) => item.id), ["task-wrong", "task-memory", "task-completed"]);

    const memoryOnly = await mod.getReviewTasksByUser("user-1", {
      includeCompleted: true,
      sourceTypes: ["memory"]
    });
    assert.deepEqual(memoryOnly.map((item) => item.id), ["task-memory"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("upsertReviewTask normalizes optional fields and derives completedAt from dueAt when needed", async () => {
  const { mod, root } = await loadReviewTasksModule();

  try {
    const task = await mod.upsertReviewTask({
      userId: "user-2",
      questionId: "q-4",
      sourceType: "memory",
      subject: "   ",
      knowledgePointId: "   ",
      status: "completed",
      intervalLevel: -3,
      nextReviewAt: "2026-03-20T08:00:00.000Z",
      lastReviewResult: "wrong",
      reviewCount: -2,
      originType: "wrong_book_review",
      originPaperId: "   ",
      originSubmittedAt: "   ",
      payload: null
    });

    assert.ok(task);
    assert.equal(task?.subject, null);
    assert.equal(task?.knowledgePointId, null);
    assert.equal(task?.intervalLevel, 0);
    assert.equal(task?.reviewCount, 0);
    assert.equal(task?.completedAt, "2026-03-20T08:00:00.000Z");
    assert.equal(task?.originPaperId, null);
    assert.equal(task?.originSubmittedAt, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
