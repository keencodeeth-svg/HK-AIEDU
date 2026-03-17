import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type ClassesModule = typeof import("../../lib/classes");

type MockDbClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  school_id: string | null;
  teacher_id: string | null;
  created_at: string;
  join_code: string | null;
  join_mode: string | null;
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
  const targets = ["../../lib/classes", "../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function normalizeJoinCode(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : undefined;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-classes-"));
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
  const mod = require("../../lib/classes") as ClassesModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule(initialRows: MockDbClass[]) {
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
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM classes WHERE UPPER(join_code) = $1 AND school_id = $2")) {
      const code = normalizeJoinCode(String(params[0]));
      const schoolId = String(params[1]);
      return (
        dbState.rows.find(
          (item) => normalizeJoinCode(item.join_code) === code && (item.school_id ?? undefined) === schoolId
        ) ?? null
      );
    }

    if (text.includes("SELECT * FROM classes WHERE UPPER(join_code) = $1")) {
      const code = normalizeJoinCode(String(params[0]));
      return dbState.rows.find((item) => normalizeJoinCode(item.join_code) === code) ?? null;
    }

    if (text.includes("UPDATE classes")) {
      const index = dbState.rows.findIndex((item) => item.id === String(params[0]));
      if (index < 0) return null;
      dbState.rows[index] = {
        ...dbState.rows[index],
        join_code: params[1] === null ? null : String(params[1]),
        join_mode: params[2] === null ? dbState.rows[index]?.join_mode ?? null : String(params[2])
      };
      return dbState.rows[index];
    }

    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/classes") as ClassesModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed classes normalize legacy join codes for lookups and updates", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "classes.json"),
      JSON.stringify(
        [
          {
            id: "class-1",
            name: "七年级一班",
            subject: "math",
            grade: "G7",
            schoolId: "school-1",
            teacherId: "u-teacher-1",
            createdAt: "2026-03-17T00:00:00.000Z",
            joinCode: "ab12cd"
          }
        ],
        null,
        2
      )
    );

    const found = await mod.getClassByJoinCode(" AB12CD ");
    assert.equal(found?.id, "class-1");
    assert.equal(found?.joinCode, "AB12CD");
    assert.equal(found?.joinMode, "approval");

    const updated = await mod.updateClassSettings("class-1", {
      joinCode: " ef34ab ",
      joinMode: "auto"
    });

    assert.equal(updated?.joinCode, "EF34AB");
    assert.equal(updated?.joinMode, "auto");

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "classes.json"));
    assert.equal(stored[0]?.joinCode, "EF34AB");
    assert.equal(stored[0]?.joinMode, "auto");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed classes resolve join codes case-insensitively while preserving tenant scope", async () => {
  const { mod, root, dbState } = await loadDbBackedModule([
    {
      id: "class-1",
      name: "七年级一班",
      subject: "math",
      grade: "G7",
      school_id: "school-1",
      teacher_id: "u-teacher-1",
      created_at: "2026-03-17T00:00:00.000Z",
      join_code: "ab12cd",
      join_mode: null
    }
  ]);

  try {
    const found = await mod.getClassByJoinCode("AB12CD", { schoolId: "school-1" });
    assert.equal(found?.id, "class-1");
    assert.equal(found?.joinCode, "AB12CD");
    assert.equal(found?.joinMode, "approval");

    const hidden = await mod.getClassByJoinCode("ab12cd", { schoolId: "school-2" });
    assert.equal(hidden, null);

    const updated = await mod.updateClassSettings("class-1", {
      joinCode: " ef34ab "
    });

    assert.equal(updated?.joinCode, "EF34AB");
    assert.equal(dbState.rows[0]?.join_code, "EF34AB");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
