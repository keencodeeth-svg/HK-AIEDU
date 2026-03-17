import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type AiEvalGateModule = typeof import("../../lib/ai-eval-gate");

type MockDbState = {
  runtimeRow: {
    id: string;
    config: Record<string, unknown>;
    updated_at: string;
    updated_by: string | null;
  } | null;
  runRows: Array<{
    id: string;
    executed_at: string;
    config: Record<string, unknown>;
    report_summary: Record<string, unknown>;
    passed: boolean;
    failed_rules: string[];
    rollback: Record<string, unknown>;
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

function resetEvalGateModules() {
  const targets = [
    "../../lib/ai-eval-gate",
    "../../lib/ai-evals",
    "../../lib/ai-quality-calibration",
    "../../lib/storage",
    "../../lib/runtime-guardrails",
    "../../lib/db"
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

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-ai-eval-gate-"));
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

  resetEvalGateModules();

  setMockModule("../../lib/ai-evals", {
    runAiOfflineEval: () => ({
      generatedAt: "2026-03-17T10:00:00.000Z",
      datasets: [],
      summary: {
        totalCases: 12,
        passedCases: 7,
        passRate: 58.33,
        averageScore: 61.5,
        highRiskCount: 8,
        calibrationSuggestion: {
          sampleCount: 4,
          recommendedGlobalBias: 0,
          providerAdjustments: {},
          kindAdjustments: {
            assist: 0,
            coach: 0,
            explanation: 0,
            writing: 0,
            assignment_review: 0
          },
          note: "test"
        }
      }
    })
  });

  setMockModule("../../lib/ai-quality-calibration", {
    listAiQualityCalibrationSnapshots: () => [
      {
        id: "snap-1",
        reason: "baseline",
        createdAt: "2026-03-16T00:00:00.000Z",
        config: {
          globalBias: 0,
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
    rollbackAiQualityCalibration: async () => ({
      globalBias: 0,
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
      updatedAt: "2026-03-17T10:05:00.000Z",
      updatedBy: "reviewer"
    })
  });

  const mod = require("../../lib/ai-eval-gate") as AiEvalGateModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = {
    runtimeRow: null,
    runRows: []
  };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.REQUIRE_DATABASE;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
  delete process.env.ALLOW_JSON_FALLBACK;

  resetEvalGateModules();
  setMockModule("../../lib/ai-evals", {
    runAiOfflineEval: () => ({
      generatedAt: "2026-03-17T10:00:00.000Z",
      datasets: [],
      summary: {
        totalCases: 0,
        passedCases: 0,
        passRate: 0,
        averageScore: 0,
        highRiskCount: 0,
        calibrationSuggestion: {
          sampleCount: 0,
          recommendedGlobalBias: 0,
          providerAdjustments: {},
          kindAdjustments: {
            assist: 0,
            coach: 0,
            explanation: 0,
            writing: 0,
            assignment_review: 0
          },
          note: "test"
        }
      }
    })
  });
  setMockModule("../../lib/ai-quality-calibration", {
    listAiQualityCalibrationSnapshots: () => [],
    rollbackAiQualityCalibration: async () => null
  });

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string) => {
    if (text.includes("FROM ai_eval_gate_runtime")) {
      return dbState.runtimeRow;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM ai_eval_gate_runs")) {
      const limit = Number(params[0] ?? dbState.runRows.length);
      return dbState.runRows
        .slice()
        .sort((left, right) => right.executed_at.localeCompare(left.executed_at))
        .slice(0, limit);
    }

    if (text.includes("INSERT INTO ai_eval_gate_runtime")) {
      dbState.runtimeRow = {
        id: String(params[0]),
        config: JSON.parse(String(params[1])) as Record<string, unknown>,
        updated_at: String(params[2]),
        updated_by: params[3] === null ? null : String(params[3])
      };
      return [];
    }

    if (text.includes("INSERT INTO ai_eval_gate_runs")) {
      const nextRow = {
        id: String(params[0]),
        executed_at: String(params[1]),
        config: JSON.parse(String(params[2])) as Record<string, unknown>,
        report_summary: JSON.parse(String(params[3])) as Record<string, unknown>,
        passed: Boolean(params[4]),
        failed_rules: Array.isArray(params[5]) ? (params[5] as string[]) : [],
        rollback: JSON.parse(String(params[6])) as Record<string, unknown>
      };
      if (!dbState.runRows.find((item) => item.id === nextRow.id)) {
        dbState.runRows.push(nextRow);
      }
      return [];
    }

    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/ai-eval-gate") as AiEvalGateModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

afterEach(() => {
  resetEvalGateModules();
  restoreEnv();
});

test("file-backed eval gate normalizes config and records rollback-capable runs", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    const next = await mod.updateAiEvalGateConfig(
      {
        datasets: ["question_check", "writing_feedback", "question_check"],
        minPassRate: 70.8,
        minAverageScore: 65.2,
        maxHighRiskCount: 3.7,
        autoRollbackOnFail: true
      },
      { updatedBy: " admin " }
    );

    assert.deepEqual(next.datasets, ["question_check", "writing_feedback"]);
    assert.equal(next.minPassRate, 70.8);
    assert.equal(next.minAverageScore, 65.2);
    assert.equal(next.maxHighRiskCount, 4);
    assert.equal(next.autoRollbackOnFail, true);
    assert.equal(next.updatedBy, "admin");

    const storedConfig = await readJsonFile<Record<string, unknown>>(path.join(runtimeDir, "ai-eval-gate-config.json"));
    assert.deepEqual(storedConfig.datasets, ["question_check", "writing_feedback"]);
    assert.equal(storedConfig.autoRollbackOnFail, true);

    const result = await mod.runAiEvalGate({
      force: true,
      runBy: "reviewer"
    });

    assert.equal(result.run.passed, false);
    assert.deepEqual(result.run.failedRules, ["passRate 58.33 < 70.8", "averageScore 61.5 < 65.2", "highRiskCount 8 > 4"]);
    assert.equal(result.run.rollback.attempted, true);
    assert.equal(result.run.rollback.snapshotId, "snap-1");
    assert.equal(result.run.rollback.success, true);
    assert.equal(mod.listAiEvalGateRuns(10).length, 1);

    const storedRuns = await readJsonFile<Array<any>>(path.join(runtimeDir, "ai-eval-gate-history.json"));
    assert.equal(storedRuns.length, 1);
    assert.equal(storedRuns[0]?.rollback?.attempted, true);
    assert.deepEqual(storedRuns[0]?.config?.datasets, ["question_check", "writing_feedback"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed eval gate refresh seeds legacy file state and later updates persist to database", async () => {
  const { mod, root, runtimeDir, dbState } = await loadDbBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "ai-eval-gate-config.json"),
      JSON.stringify(
        {
          enabled: false,
          datasets: ["question_check"],
          minPassRate: 88,
          minAverageScore: 74,
          maxHighRiskCount: 2,
          autoRollbackOnFail: true,
          updatedAt: "2026-03-17T00:00:00.000Z",
          updatedBy: "legacy-json"
        },
        null,
        2
      )
    );
    await fs.writeFile(
      path.join(runtimeDir, "ai-eval-gate-history.json"),
      JSON.stringify(
        [
          {
            id: "legacy-run",
            executedAt: "2026-03-16T00:00:00.000Z",
            config: {
              enabled: true,
              datasets: ["explanation"],
              minPassRate: 75,
              minAverageScore: 68,
              maxHighRiskCount: 6,
              autoRollbackOnFail: false,
              updatedAt: "2026-03-16T00:00:00.000Z"
            },
            reportSummary: {
              totalCases: 12,
              passRate: 90,
              averageScore: 84,
              highRiskCount: 0
            },
            passed: true,
            failedRules: [],
            rollback: {
              attempted: false,
              snapshotId: null,
              success: false,
              message: "not_triggered"
            }
          }
        ],
        null,
        2
      )
    );

    await mod.refreshAiEvalGateState();

    assert.ok(dbState.runtimeRow);
    assert.equal(dbState.runtimeRow?.config.minPassRate, 88);
    assert.equal(dbState.runRows.length, 1);
    assert.equal(mod.getAiEvalGateConfig().updatedBy, "legacy-json");
    assert.equal(mod.listAiEvalGateRuns(10)[0]?.id, "legacy-run");

    const updated = await mod.updateAiEvalGateConfig(
      {
        enabled: true,
        minPassRate: 91
      },
      { updatedBy: "ops" }
    );

    assert.equal(updated.enabled, true);
    assert.equal(updated.minPassRate, 91);
    assert.equal(dbState.runtimeRow?.config.minPassRate, 91);
    assert.equal(dbState.runtimeRow?.updated_by, "ops");

    dbState.runtimeRow = {
      id: "runtime",
      config: {
        enabled: true,
        datasets: ["writing_feedback"],
        minPassRate: 95,
        minAverageScore: 78,
        maxHighRiskCount: 1,
        autoRollbackOnFail: false
      },
      updated_at: "2026-03-18T00:00:00.000Z",
      updated_by: "remote-admin"
    };
    dbState.runRows = [
      {
        id: "remote-run",
        executed_at: "2026-03-18T00:00:00.000Z",
        config: {
          enabled: true,
          datasets: ["writing_feedback"],
          minPassRate: 95,
          minAverageScore: 78,
          maxHighRiskCount: 1,
          autoRollbackOnFail: false,
          updatedAt: "2026-03-18T00:00:00.000Z"
        },
        report_summary: {
          totalCases: 8,
          passRate: 96,
          averageScore: 88,
          highRiskCount: 0
        },
        passed: true,
        failed_rules: [],
        rollback: {
          attempted: false,
          snapshotId: null,
          success: false,
          message: "not_triggered"
        }
      }
    ];

    await mod.refreshAiEvalGateState();
    const current = mod.getAiEvalGateConfig();
    assert.deepEqual(current.datasets, ["writing_feedback"]);
    assert.equal(current.minPassRate, 95);
    assert.equal(current.updatedBy, "remote-admin");
    assert.equal(mod.listAiEvalGateRuns(10)[0]?.id, "remote-run");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("guarded db-backed eval gate ignores legacy json bootstrap files", async () => {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = {
    runtimeRow: null,
    runRows: []
  };

  process.env.NODE_ENV = "production";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.ALLOW_JSON_FALLBACK = "false";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";

  await fs.writeFile(
    path.join(runtimeDir, "ai-eval-gate-config.json"),
    JSON.stringify(
      {
        enabled: false,
        datasets: ["question_check"],
        minPassRate: 88,
        minAverageScore: 74,
        maxHighRiskCount: 2,
        autoRollbackOnFail: true,
        updatedAt: "2026-03-17T00:00:00.000Z",
        updatedBy: "legacy-json"
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(runtimeDir, "ai-eval-gate-history.json"),
    JSON.stringify(
      [
        {
          id: "legacy-run",
          executedAt: "2026-03-16T00:00:00.000Z",
          config: {
            enabled: true,
            datasets: ["explanation"],
            minPassRate: 75,
            minAverageScore: 68,
            maxHighRiskCount: 6,
            autoRollbackOnFail: false,
            updatedAt: "2026-03-16T00:00:00.000Z"
          },
          reportSummary: {
            totalCases: 12,
            passRate: 90,
            averageScore: 84,
            highRiskCount: 0
          },
          passed: true,
          failedRules: [],
          rollback: {
            attempted: false,
            snapshotId: null,
            success: false,
            message: "not_triggered"
          }
        }
      ],
      null,
      2
    )
  );

  resetEvalGateModules();
  setMockModule("../../lib/ai-evals", {
    runAiOfflineEval: () => ({
      generatedAt: "2026-03-17T10:00:00.000Z",
      datasets: [],
      summary: {
        totalCases: 0,
        passedCases: 0,
        passRate: 0,
        averageScore: 0,
        highRiskCount: 0,
        calibrationSuggestion: {
          sampleCount: 0,
          recommendedGlobalBias: 0,
          providerAdjustments: {},
          kindAdjustments: {
            assist: 0,
            coach: 0,
            explanation: 0,
            writing: 0,
            assignment_review: 0
          },
          note: "test"
        }
      }
    })
  });
  setMockModule("../../lib/ai-quality-calibration", {
    listAiQualityCalibrationSnapshots: () => [],
    rollbackAiQualityCalibration: async () => null
  });

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string) => {
    if (text.includes("FROM ai_eval_gate_runtime")) {
      return dbState.runtimeRow;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM ai_eval_gate_runs")) {
      const limit = Number(params[0] ?? dbState.runRows.length);
      return dbState.runRows
        .slice()
        .sort((left, right) => right.executed_at.localeCompare(left.executed_at))
        .slice(0, limit);
    }
    if (text.includes("INSERT INTO ai_eval_gate_runtime")) {
      dbState.runtimeRow = {
        id: String(params[0]),
        config: JSON.parse(String(params[1])) as Record<string, unknown>,
        updated_at: String(params[2]),
        updated_by: params[3] === null ? null : String(params[3])
      };
      return [];
    }
    if (text.includes("INSERT INTO ai_eval_gate_runs")) {
      const nextRow = {
        id: String(params[0]),
        executed_at: String(params[1]),
        config: JSON.parse(String(params[2])) as Record<string, unknown>,
        report_summary: JSON.parse(String(params[3])) as Record<string, unknown>,
        passed: Boolean(params[4]),
        failed_rules: Array.isArray(params[5]) ? (params[5] as string[]) : [],
        rollback: JSON.parse(String(params[6])) as Record<string, unknown>
      };
      if (!dbState.runRows.find((item) => item.id === nextRow.id)) {
        dbState.runRows.push(nextRow);
      }
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/ai-eval-gate") as AiEvalGateModule;

  try {
    await mod.refreshAiEvalGateState();
    const current = mod.getAiEvalGateConfig();

    assert.equal(current.enabled, true);
    assert.deepEqual(current.datasets, [
      "explanation",
      "homework_review",
      "knowledge_points_generate",
      "writing_feedback",
      "lesson_outline",
      "question_check"
    ]);
    assert.equal(current.minPassRate, 75);
    assert.equal(mod.listAiEvalGateRuns(10).length, 0);
    assert.equal(dbState.runtimeRow?.config.minPassRate, 75);
    assert.equal(dbState.runRows.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
