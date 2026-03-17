import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type StudentPersonasModule = typeof import("../../lib/student-personas");

type MockDbState = {
  rows: Array<{
    id: string;
    user_id: string;
    preferred_name: string | null;
    gender: string | null;
    height_cm: number | null;
    eyesight_level: string | null;
    seat_preference: string | null;
    personality: string | null;
    focus_support: string | null;
    peer_support: string | null;
    strengths: string | null;
    support_notes: string | null;
    updated_at: string;
  }>;
};

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
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

function resetStudentPersonaModules() {
  const targets = ["../../lib/student-personas", "../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
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

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-student-persona-"));
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
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetStudentPersonaModules();
  const mod = require("../../lib/student-personas") as StudentPersonasModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = { rows: [] };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetStudentPersonaModules();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT id FROM student_personas LIMIT 1")) {
      const first = dbState.rows[0];
      return first ? { id: first.id } : null;
    }
    if (text.includes("SELECT * FROM student_personas WHERE user_id = $1")) {
      return dbState.rows.find((item) => item.user_id === String(params[0])) ?? null;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM student_personas ORDER BY updated_at DESC")) {
      return dbState.rows.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    }
    if (text.includes("SELECT * FROM student_personas WHERE user_id = ANY($1)")) {
      const userIds = Array.isArray(params[0]) ? new Set(params[0] as string[]) : new Set<string>();
      return dbState.rows.filter((item) => userIds.has(item.user_id));
    }
    if (text.includes("INSERT INTO student_personas")) {
      const nextRow = {
        id: String(params[0]),
        user_id: String(params[1]),
        preferred_name: params[2] === null ? null : String(params[2]),
        gender: params[3] === null ? null : String(params[3]),
        height_cm: params[4] === null ? null : Number(params[4]),
        eyesight_level: params[5] === null ? null : String(params[5]),
        seat_preference: params[6] === null ? null : String(params[6]),
        personality: params[7] === null ? null : String(params[7]),
        focus_support: params[8] === null ? null : String(params[8]),
        peer_support: params[9] === null ? null : String(params[9]),
        strengths: params[10] === null ? null : String(params[10]),
        support_notes: params[11] === null ? null : String(params[11]),
        updated_at: String(params[12])
      };
      const existingIndex = dbState.rows.findIndex((item) => item.user_id === nextRow.user_id);
      if (existingIndex >= 0) {
        const existing = dbState.rows[existingIndex];
        if (text.includes("DO UPDATE SET")) {
          dbState.rows[existingIndex] = {
            ...existing,
            ...nextRow
          };
        }
      } else {
        dbState.rows.push(nextRow);
      }
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/student-personas") as StudentPersonasModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

afterEach(() => {
  resetStudentPersonaModules();
  restoreEnv();
});

test("file-backed student personas normalize updates and filter by requested user ids", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    const first = await mod.upsertStudentPersona({
      userId: "student-1",
      preferredName: "  小航  ",
      gender: "male",
      heightCm: 168,
      strengths: "  几何直觉强 ",
      supportNotes: "  靠窗会分心 "
    });

    assert.equal(first.preferredName, "小航");
    assert.equal(first.strengths, "几何直觉强");
    assert.equal(first.supportNotes, "靠窗会分心");

    const second = await mod.upsertStudentPersona({
      userId: "student-2",
      preferredName: "小科",
      seatPreference: "front"
    });

    const updated = await mod.upsertStudentPersona({
      userId: "student-1",
      preferredName: "",
      gender: null,
      supportNotes: "  "
    });

    assert.equal(updated.id, first.id);
    assert.equal(updated.preferredName, undefined);
    assert.equal(updated.gender, undefined);
    assert.equal(updated.supportNotes, undefined);
    assert.equal(updated.heightCm, 168);

    const filtered = await mod.listStudentPersonasByUserIds(["student-2", "student-1"]);
    assert.deepEqual(
      filtered.map((item) => item.userId).sort(),
      ["student-1", "student-2"]
    );

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "student-personas.json"));
    assert.equal(stored.length, 2);
    assert.equal(stored.find((item) => item.userId === "student-2")?.id, second.id);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed student personas import legacy file state and persist later updates to database", async () => {
  const { mod, root, runtimeDir, dbState } = await loadDbBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "student-personas.json"),
      JSON.stringify(
        [
          {
            id: "persona-legacy-1",
            userId: "student-1",
            preferredName: "小航",
            gender: "male",
            heightCm: 170,
            eyesightLevel: "front_preferred",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const list = await mod.getStudentPersonas();
    assert.equal(list.length, 1);
    assert.equal(list[0]?.userId, "student-1");
    assert.equal(dbState.rows.length, 1);
    assert.equal(dbState.rows[0]?.preferred_name, "小航");

    const updated = await mod.upsertStudentPersona({
      userId: "student-1",
      preferredName: "小航同学",
      peerSupport: "can_support",
      supportNotes: "安排在前排中央"
    });

    assert.equal(updated.preferredName, "小航同学");
    assert.equal(updated.peerSupport, "can_support");
    assert.equal(dbState.rows[0]?.peer_support, "can_support");
    assert.equal(dbState.rows[0]?.support_notes, "安排在前排中央");

    const filtered = await mod.listStudentPersonasByUserIds(["student-1", "student-3"]);
    assert.deepEqual(filtered.map((item) => item.userId), ["student-1"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("guarded db-backed student personas ignore legacy json bootstrap files", async () => {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = { rows: [] };

  process.env.NODE_ENV = "production";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.ALLOW_JSON_FALLBACK = "false";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";

  await fs.writeFile(
    path.join(runtimeDir, "student-personas.json"),
    JSON.stringify(
      [
        {
          id: "persona-legacy-1",
          userId: "student-1",
          preferredName: "小航",
          gender: "male",
          heightCm: 170,
          eyesightLevel: "front_preferred",
          updatedAt: "2026-03-17T00:00:00.000Z"
        }
      ],
      null,
      2
    )
  );

  resetStudentPersonaModules();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT id FROM student_personas LIMIT 1")) {
      const first = dbState.rows[0];
      return first ? { id: first.id } : null;
    }
    if (text.includes("SELECT * FROM student_personas WHERE user_id = $1")) {
      return dbState.rows.find((item) => item.user_id === String(params[0])) ?? null;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM student_personas ORDER BY updated_at DESC")) {
      return dbState.rows.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    }
    if (text.includes("SELECT * FROM student_personas WHERE user_id = ANY($1)")) {
      const userIds = Array.isArray(params[0]) ? new Set(params[0] as string[]) : new Set<string>();
      return dbState.rows.filter((item) => userIds.has(item.user_id));
    }
    if (text.includes("INSERT INTO student_personas")) {
      const nextRow = {
        id: String(params[0]),
        user_id: String(params[1]),
        preferred_name: params[2] === null ? null : String(params[2]),
        gender: params[3] === null ? null : String(params[3]),
        height_cm: params[4] === null ? null : Number(params[4]),
        eyesight_level: params[5] === null ? null : String(params[5]),
        seat_preference: params[6] === null ? null : String(params[6]),
        personality: params[7] === null ? null : String(params[7]),
        focus_support: params[8] === null ? null : String(params[8]),
        peer_support: params[9] === null ? null : String(params[9]),
        strengths: params[10] === null ? null : String(params[10]),
        support_notes: params[11] === null ? null : String(params[11]),
        updated_at: String(params[12])
      };
      const existingIndex = dbState.rows.findIndex((item) => item.user_id === nextRow.user_id);
      if (existingIndex >= 0) {
        dbState.rows[existingIndex] = {
          ...dbState.rows[existingIndex],
          ...nextRow
        };
      } else {
        dbState.rows.push(nextRow);
      }
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/student-personas") as StudentPersonasModule;

  try {
    const list = await mod.getStudentPersonas();
    assert.deepEqual(list, []);
    assert.equal(dbState.rows.length, 0);
    assert.equal(await mod.getStudentPersona("student-1"), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
