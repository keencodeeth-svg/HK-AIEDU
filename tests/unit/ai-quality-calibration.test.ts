import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AiQualityCalibrationModule = typeof import("../../lib/ai-quality-calibration");

type MockDbState = {
  runtimeRow: {
    id: string;
    config: Record<string, unknown>;
    updated_at: string;
    updated_by: string | null;
  } | null;
  historyRows: Array<{
    id: string;
    reason: string;
    created_at: string;
    created_by: string | null;
    config: Record<string, unknown>;
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

function resetCalibrationModules() {
  const targets = ["../../lib/ai-quality-calibration", "../../lib/storage", "../../lib/runtime-guardrails", "../../lib/db"];
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-quality-cal-"));
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
  delete process.env.REQUIRE_DATABASE;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.ALLOW_JSON_FALLBACK;

  resetCalibrationModules();
  const mod = require("../../lib/ai-quality-calibration") as AiQualityCalibrationModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = {
    runtimeRow: null,
    historyRows: []
  };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.REQUIRE_DATABASE;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.ALLOW_JSON_FALLBACK;

  resetCalibrationModules();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string) => {
    if (text.includes("FROM ai_quality_calibration_runtime")) {
      return dbState.runtimeRow;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM ai_quality_calibration_history")) {
      const limit = Number(params[0] ?? dbState.historyRows.length);
      return dbState.historyRows
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, limit);
    }

    if (text.includes("INSERT INTO ai_quality_calibration_runtime")) {
      dbState.runtimeRow = {
        id: String(params[0]),
        config: JSON.parse(String(params[1])) as Record<string, unknown>,
        updated_at: String(params[2]),
        updated_by: params[3] === null ? null : String(params[3])
      };
      return [];
    }

    if (text.includes("INSERT INTO ai_quality_calibration_history")) {
      const nextRow = {
        id: String(params[0]),
        reason: String(params[1]),
        created_at: String(params[2]),
        created_by: params[3] === null ? null : String(params[3]),
        config: JSON.parse(String(params[4])) as Record<string, unknown>
      };
      if (!dbState.historyRows.find((item) => item.id === nextRow.id)) {
        dbState.historyRows.push(nextRow);
      }
      return [];
    }

    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/ai-quality-calibration") as AiQualityCalibrationModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

afterEach(() => {
  resetCalibrationModules();
  restoreEnv();
});

test("file-backed calibration updates normalize values and rollback restores previous snapshot", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    const next = await mod.upsertAiQualityCalibration(
      {
        globalBias: 12.345,
        providerAdjustments: { " Kimi ": 1.234, invalid: Number.NaN },
        kindAdjustments: { assist: 2.345 },
        rolloutPercent: 40.6,
        rolloutSalt: "  Pilot "
      },
      { updatedBy: " admin " }
    );

    assert.equal(next.globalBias, 12.35);
    assert.deepEqual(next.providerAdjustments, { kimi: 1.23 });
    assert.equal(next.kindAdjustments.assist, 2.35);
    assert.equal(next.rolloutPercent, 40.6);
    assert.equal(next.rolloutSalt, "pilot");
    assert.equal(next.updatedBy, "admin");

    const storedConfig = await readJsonFile<Record<string, unknown>>(path.join(runtimeDir, "ai-quality-calibration.json"));
    assert.equal(storedConfig.globalBias, 12.35);
    assert.equal(storedConfig.rolloutSalt, "pilot");

    const snapshots = mod.listAiQualityCalibrationSnapshots(10);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0]?.reason, "manual_update");
    assert.equal(snapshots[0]?.config.globalBias, 0);

    const rolledBack = await mod.rollbackAiQualityCalibration(snapshots[0]!.id, {
      updatedBy: "ops",
      reason: "rollback_test"
    });

    assert.ok(rolledBack);
    assert.equal(rolledBack?.globalBias, 0);
    assert.equal(rolledBack?.updatedBy, "ops");
    assert.equal(mod.listAiQualityCalibrationSnapshots(10).length, 2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed calibration refresh seeds legacy file state and later reads prefer database snapshots", async () => {
  const { mod, root, runtimeDir, dbState } = await loadDbBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "ai-quality-calibration.json"),
      JSON.stringify(
        {
          globalBias: 6,
          providerAdjustments: { kimi: 3 },
          kindAdjustments: {
            assist: 2,
            coach: 0,
            explanation: 0,
            writing: 0,
            assignment_review: 0
          },
          enabled: true,
          rolloutPercent: 55,
          rolloutSalt: "seed",
          updatedAt: "2026-03-17T00:00:00.000Z",
          updatedBy: "seed-user"
        },
        null,
        2
      )
    );
    await fs.writeFile(
      path.join(runtimeDir, "ai-quality-calibration-history.json"),
      JSON.stringify(
        [
          {
            id: "snap-seed-1",
            reason: "seed_snapshot",
            createdAt: "2026-03-16T00:00:00.000Z",
            createdBy: "seed-user",
            config: {
              globalBias: 1,
              providerAdjustments: {},
              kindAdjustments: {
                assist: 0,
                coach: 0,
                explanation: 0,
                writing: 0,
                assignment_review: 0
              },
              enabled: true,
              rolloutPercent: 100,
              rolloutSalt: "default",
              updatedAt: "2026-03-16T00:00:00.000Z"
            }
          }
        ],
        null,
        2
      )
    );

    await mod.refreshAiQualityCalibrationState();

    assert.ok(dbState.runtimeRow);
    assert.equal(dbState.runtimeRow?.config.globalBias, 6);
    assert.equal(dbState.historyRows.length, 1);
    assert.equal(mod.getAiQualityCalibration().globalBias, 6);
    assert.equal(mod.listAiQualityCalibrationSnapshots(10)[0]?.id, "snap-seed-1");

    const updated = await mod.upsertAiQualityCalibration(
      {
        globalBias: 9,
        providerAdjustments: { deepseek: -2 }
      },
      { updatedBy: "db-admin", reason: "manual_update" }
    );

    assert.equal(updated.globalBias, 9);
    assert.equal(dbState.runtimeRow?.config.globalBias, 9);
    assert.equal(dbState.runtimeRow?.updated_by, "db-admin");
    assert.equal(dbState.historyRows.length, 2);

    dbState.runtimeRow = {
      id: "runtime",
      config: {
        globalBias: 4,
        providerAdjustments: { kimi: 1 },
        kindAdjustments: {
          assist: 0,
          coach: 0,
          explanation: 0,
          writing: 0,
          assignment_review: 0
        },
        enabled: false,
        rolloutPercent: 20,
        rolloutSalt: "db-only"
      },
      updated_at: "2026-03-18T00:00:00.000Z",
      updated_by: "remote-admin"
    };

    await mod.refreshAiQualityCalibrationState();
    const current = mod.getAiQualityCalibration();
    assert.equal(current.globalBias, 4);
    assert.equal(current.enabled, false);
    assert.equal(current.rolloutSalt, "db-only");
    assert.equal(current.updatedBy, "remote-admin");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("guarded db-backed calibration ignores legacy json bootstrap files", async () => {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = {
    runtimeRow: null,
    historyRows: []
  };

  process.env.NODE_ENV = "production";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.ALLOW_JSON_FALLBACK = "false";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";

  await fs.writeFile(
    path.join(runtimeDir, "ai-quality-calibration.json"),
    JSON.stringify(
      {
        globalBias: 6,
        providerAdjustments: { kimi: 3 },
        kindAdjustments: {
          assist: 2,
          coach: 0,
          explanation: 0,
          writing: 0,
          assignment_review: 0
        },
        enabled: true,
        rolloutPercent: 55,
        rolloutSalt: "seed",
        updatedAt: "2026-03-17T00:00:00.000Z",
        updatedBy: "legacy-json"
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(runtimeDir, "ai-quality-calibration-history.json"),
    JSON.stringify(
      [
        {
          id: "snap-legacy",
          reason: "legacy_seed",
          createdAt: "2026-03-16T00:00:00.000Z",
          createdBy: "legacy-json",
          config: {
            globalBias: 1,
            providerAdjustments: {},
            kindAdjustments: {
              assist: 0,
              coach: 0,
              explanation: 0,
              writing: 0,
              assignment_review: 0
            },
            enabled: true,
            rolloutPercent: 100,
            rolloutSalt: "default",
            updatedAt: "2026-03-16T00:00:00.000Z"
          }
        }
      ],
      null,
      2
    )
  );

  resetCalibrationModules();
  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string) => {
    if (text.includes("FROM ai_quality_calibration_runtime")) {
      return dbState.runtimeRow;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM ai_quality_calibration_history")) {
      const limit = Number(params[0] ?? dbState.historyRows.length);
      return dbState.historyRows
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, limit);
    }
    if (text.includes("INSERT INTO ai_quality_calibration_runtime")) {
      dbState.runtimeRow = {
        id: String(params[0]),
        config: JSON.parse(String(params[1])) as Record<string, unknown>,
        updated_at: String(params[2]),
        updated_by: params[3] === null ? null : String(params[3])
      };
      return [];
    }
    if (text.includes("INSERT INTO ai_quality_calibration_history")) {
      const nextRow = {
        id: String(params[0]),
        reason: String(params[1]),
        created_at: String(params[2]),
        created_by: params[3] === null ? null : String(params[3]),
        config: JSON.parse(String(params[4])) as Record<string, unknown>
      };
      if (!dbState.historyRows.find((item) => item.id === nextRow.id)) {
        dbState.historyRows.push(nextRow);
      }
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/ai-quality-calibration") as AiQualityCalibrationModule;

  try {
    await mod.refreshAiQualityCalibrationState();
    const current = mod.getAiQualityCalibration();

    assert.equal(current.globalBias, 0);
    assert.equal(current.rolloutPercent, 100);
    assert.equal(mod.listAiQualityCalibrationSnapshots(10).length, 0);
    assert.equal(dbState.runtimeRow?.config.globalBias, 0);
    assert.equal(dbState.historyRows.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
