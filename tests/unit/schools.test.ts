import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type SchoolsModule = typeof import("../../lib/schools");

type MockDbSchool = {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
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
  const targets = ["../../lib/schools", "../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function normalizeSchoolCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-schools-"));
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
  const mod = require("../../lib/schools") as SchoolsModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule(initialRows: MockDbSchool[]) {
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
    if (text.includes("SELECT * FROM schools ORDER BY created_at ASC")) {
      return dbState.rows.slice().sort((left, right) => left.created_at.localeCompare(right.created_at));
    }
    throw new Error(`unexpected query: ${text}`);
  };

  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT * FROM schools WHERE upper(code) = $1")) {
      const code = normalizeSchoolCode(String(params[0] ?? ""));
      return dbState.rows.find((item) => normalizeSchoolCode(item.code) === code) ?? null;
    }

    if (text.includes("UPDATE schools")) {
      const index = dbState.rows.findIndex((item) => item.id === String(params[0]));
      if (index < 0) return null;
      dbState.rows[index] = {
        ...dbState.rows[index],
        name: String(params[1]),
        code: String(params[2]),
        updated_at: String(params[3])
      };
      return dbState.rows[index];
    }

    if (text.includes("INSERT INTO schools")) {
      const row = {
        id: String(params[0]),
        name: String(params[1]),
        code: String(params[2]),
        status: "active",
        created_at: String(params[3]),
        updated_at: String(params[4])
      };
      dbState.rows.push(row);
      return row;
    }

    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/schools") as SchoolsModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed schools normalize legacy codes and reuse existing school records case-insensitively", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "schools.json"),
      JSON.stringify(
        [
          {
            id: "school-1",
            name: "旧校名",
            code: "hk demo 01",
            status: "active",
            createdAt: "2026-03-17T00:00:00.000Z",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const schools = await mod.getSchools();
    assert.equal(schools.length, 1);
    assert.equal(schools[0]?.code, "HKDEMO01");

    const resolved = await mod.getSchoolByCode(" hk-demo-01 ");
    assert.equal(resolved?.id, "school-1");
    assert.equal(resolved?.code, "HKDEMO01");

    const updated = await mod.createSchool({
      name: "新校名",
      code: "HK-DEMO-01"
    });

    assert.equal(updated.id, "school-1");
    assert.equal(updated.code, "HKDEMO01");
    assert.equal(updated.name, "新校名");

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "schools.json"));
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.code, "HKDEMO01");
    assert.equal(stored[0]?.name, "新校名");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed schools reuse legacy mixed-case codes instead of inserting duplicate tenants", async () => {
  const { mod, root, dbState } = await loadDbBackedModule([
    {
      id: "school-1",
      name: "旧校名",
      code: "hkDemo01",
      status: "active",
      created_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z"
    }
  ]);

  try {
    const resolved = await mod.getSchoolByCode("HK-DEMO-01");
    assert.equal(resolved?.id, "school-1");
    assert.equal(resolved?.code, "HKDEMO01");

    const updated = await mod.createSchool({
      name: "新校名",
      code: " HK-DEMO-01 "
    });

    assert.equal(updated.id, "school-1");
    assert.equal(updated.code, "HKDEMO01");
    assert.equal(updated.name, "新校名");
    assert.equal(dbState.rows.length, 1);
    assert.equal(dbState.rows[0]?.code, "HKDEMO01");
    assert.equal(dbState.rows[0]?.name, "新校名");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
