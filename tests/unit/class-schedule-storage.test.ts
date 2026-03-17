import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type ClassScheduleModule = typeof import("../../lib/class-schedules");

type MockDbState = {
  sessions: Array<{
    id: string;
    school_id: string | null;
    class_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    slot_label: string | null;
    room: string | null;
    campus: string | null;
    note: string | null;
    focus_summary: string | null;
    locked: boolean;
    locked_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
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

function resetModules() {
  const targets = [
    "../../lib/class-schedules",
    "../../lib/classes",
    "../../lib/db",
    "../../lib/runtime-guardrails",
    "../../lib/teacher-schedule-rules",
    "../../lib/teacher-unavailability"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-class-schedule-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });
  return { root, runtimeDir, seedDir };
}

function upsertDbSession(state: MockDbState, params: unknown[]) {
  const nextRow = {
    id: String(params[0]),
    school_id: params[1] === null ? null : String(params[1]),
    class_id: String(params[2]),
    weekday: Number(params[3]),
    start_time: String(params[4]),
    end_time: String(params[5]),
    slot_label: params[6] === null ? null : String(params[6]),
    room: params[7] === null ? null : String(params[7]),
    campus: params[8] === null ? null : String(params[8]),
    note: params[9] === null ? null : String(params[9]),
    focus_summary: params[10] === null ? null : String(params[10]),
    locked: params[11] === true,
    locked_at: params[12] === null ? null : String(params[12]),
    created_at: String(params[13]),
    updated_at: String(params[14])
  };

  const index = state.sessions.findIndex((item) => item.id === nextRow.id);
  if (index >= 0) {
    state.sessions[index] = nextRow;
  } else {
    state.sessions.push(nextRow);
  }
}

async function loadDbBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = { sessions: [] };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.REQUIRE_DATABASE;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.ALLOW_JSON_FALLBACK;

  resetModules();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };
  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string) => {
    if (text.includes("SELECT id FROM class_schedule_sessions LIMIT 1")) {
      const first = dbState.sessions[0];
      return first ? { id: first.id } : null;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM class_schedule_sessions")) {
      return dbState.sessions
        .slice()
        .sort((left, right) => {
          if (left.weekday !== right.weekday) return left.weekday - right.weekday;
          if (left.start_time !== right.start_time) return left.start_time.localeCompare(right.start_time);
          if (left.end_time !== right.end_time) return left.end_time.localeCompare(right.end_time);
          return left.class_id.localeCompare(right.class_id, "zh-CN");
        });
    }

    if (text.includes("INSERT INTO class_schedule_sessions")) {
      upsertDbSession(dbState, params);
      return [];
    }

    if (text.includes("DELETE FROM class_schedule_sessions WHERE id = ANY($1)")) {
      const ids = new Set(Array.isArray(params[0]) ? (params[0] as string[]) : []);
      dbState.sessions = dbState.sessions.filter((item) => !ids.has(item.id));
      return [];
    }

    if (text.includes("DELETE FROM class_schedule_sessions WHERE id = $1")) {
      const id = String(params[0]);
      dbState.sessions = dbState.sessions.filter((item) => item.id !== id);
      return [];
    }

    throw new Error(`unexpected query: ${text}`);
  };

  const classesMod = require("../../lib/classes") as {
    getClassById: (classId: string) => Promise<unknown>;
  };
  classesMod.getClassById = async (classId: string) => ({
    id: classId,
    schoolId: "school-default",
    teacherId: "teacher-1"
  });

  const rulesMod = require("../../lib/teacher-schedule-rules") as {
    getTeacherScheduleRule: () => Promise<unknown>;
    findTeacherScheduleRuleViolation: () => string | null;
  };
  rulesMod.getTeacherScheduleRule = async () => null;
  rulesMod.findTeacherScheduleRuleViolation = () => null;

  const unavailableMod = require("../../lib/teacher-unavailability") as {
    listTeacherUnavailableSlots: () => Promise<unknown[]>;
  };
  unavailableMod.listTeacherUnavailableSlots = async () => [];

  const mod = require("../../lib/class-schedules") as ClassScheduleModule;
  return { mod, root, runtimeDir, dbState };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("db-backed class schedules import legacy file state into an empty table", async () => {
  const { mod, root, runtimeDir, dbState } = await loadDbBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "class-schedules.json"),
      JSON.stringify(
        [
          {
            id: "sched-seed-1",
            schoolId: "school-default",
            classId: "class-1",
            weekday: 1,
            startTime: "08:00",
            endTime: "08:45",
            slotLabel: "第1节",
            room: "101",
            campus: "主校区",
            note: "seeded",
            focusSummary: "知识梳理",
            locked: false,
            createdAt: "2026-03-16T08:00:00.000Z",
            updatedAt: "2026-03-16T08:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const sessions = await mod.listClassScheduleSessions({ schoolId: "school-default" });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.id, "sched-seed-1");
    assert.equal(dbState.sessions.length, 1);
    assert.equal(dbState.sessions[0]?.id, "sched-seed-1");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed class schedules support create, update, unlock, and delete flows", async () => {
  const { mod, root, dbState } = await loadDbBackedModule();

  try {
    const created = await mod.createClassScheduleSession({
      classId: "class-1",
      weekday: 2,
      startTime: "09:00",
      endTime: "09:45",
      room: "201"
    });

    assert.equal(dbState.sessions.length, 1);
    assert.equal(created.room, "201");

    const locked = await mod.updateClassScheduleSession(created.id, {
      room: "202",
      locked: true
    });
    assert.equal(locked?.room, "202");
    assert.equal(locked?.locked, true);
    assert.equal(dbState.sessions[0]?.room, "202");

    await assert.rejects(
      () => mod.deleteClassScheduleSession(created.id),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("节次已锁定，请先解锁后再删除")
    );

    const unlocked = await mod.updateClassScheduleSession(created.id, { locked: false });
    assert.equal(unlocked?.locked, false);

    const removed = await mod.deleteClassScheduleSession(created.id);
    assert.equal(removed?.id, created.id);
    assert.equal(dbState.sessions.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
