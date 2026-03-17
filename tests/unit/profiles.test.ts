import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type ProfilesModule = typeof import("../../lib/profiles");

type MockDbProfile = {
  id: string;
  user_id: string;
  grade: string;
  subjects: string[];
  target: string | null;
  school: string | null;
  observer_code: string | null;
  updated_at: string;
};

const ENV_KEYS = [
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

function resetModules() {
  const targets = ["../../lib/profiles", "../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function normalizeObserverCode(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : undefined;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-profiles-"));
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
  const mod = require("../../lib/profiles") as ProfilesModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule(initialRows: MockDbProfile[]) {
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

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string) => {
    if (text.includes("SELECT * FROM student_profiles")) {
      return dbState.rows.slice();
    }
    throw new Error(`unexpected query: ${text}`);
  };
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT id FROM student_profiles WHERE UPPER(observer_code) = $1")) {
      const observerCode = normalizeObserverCode(String(params[0]));
      const row = dbState.rows.find((item) => normalizeObserverCode(item.observer_code) === observerCode);
      return row ? { id: row.id } : null;
    }

    if (text.includes("SELECT * FROM student_profiles WHERE user_id = $1")) {
      return dbState.rows.find((item) => item.user_id === String(params[0])) ?? null;
    }

    if (text.includes("SELECT * FROM student_profiles WHERE UPPER(observer_code) = $1")) {
      const observerCode = normalizeObserverCode(String(params[0]));
      return dbState.rows.find((item) => normalizeObserverCode(item.observer_code) === observerCode) ?? null;
    }

    if (text.includes("INSERT INTO student_profiles")) {
      const nextRow: MockDbProfile = {
        id: String(params[0]),
        user_id: String(params[1]),
        grade: String(params[2]),
        subjects: Array.isArray(params[3]) ? (params[3] as string[]) : [],
        target: params[4] === null ? null : String(params[4]),
        school: params[5] === null ? null : String(params[5]),
        observer_code: params[6] === null ? null : String(params[6]),
        updated_at: String(params[7])
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

      return dbState.rows.find((item) => item.user_id === nextRow.user_id) ?? null;
    }

    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/profiles") as ProfilesModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed student profiles normalize observer codes and keep them stable on updates", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "student-profiles.json"),
      JSON.stringify(
        [
          {
            id: "sp-legacy-1",
            userId: "student-1",
            grade: "G7",
            subjects: ["math"],
            target: "",
            school: "",
            observerCode: " hkbind7 ",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const found = await mod.getStudentProfileByObserverCode("hkbind7");
    assert.equal(found?.userId, "student-1");
    assert.equal(found?.observerCode, "HKBIND7");

    const updated = await mod.upsertStudentProfile({
      userId: "student-1",
      grade: "G8",
      subjects: ["math", "english"],
      target: "",
      school: ""
    });

    assert.equal(updated?.observerCode, "HKBIND7");

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "student-profiles.json"));
    assert.equal(stored[0]?.observerCode, "HKBIND7");
    assert.equal(stored[0]?.grade, "G8");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed student profiles resolve observer codes case-insensitively and normalize legacy rows on update", async () => {
  const { mod, root, dbState } = await loadDbBackedModule([
    {
      id: "sp-db-1",
      user_id: "student-1",
      grade: "G7",
      subjects: ["math"],
      target: "",
      school: "",
      observer_code: "hkdb09",
      updated_at: "2026-03-17T00:00:00.000Z"
    }
  ]);

  try {
    const found = await mod.getStudentProfileByObserverCode("HKDB09");
    assert.equal(found?.userId, "student-1");
    assert.equal(found?.observerCode, "HKDB09");

    const updated = await mod.upsertStudentProfile({
      userId: "student-1",
      grade: "G8",
      subjects: ["math", "physics"],
      target: "冲刺",
      school: "示范校"
    });

    assert.equal(updated?.observerCode, "HKDB09");
    assert.equal(dbState.rows[0]?.observer_code, "HKDB09");
    assert.equal(dbState.rows[0]?.grade, "G8");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
