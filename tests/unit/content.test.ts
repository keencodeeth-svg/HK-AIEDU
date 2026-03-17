import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type ContentModule = typeof import("../../lib/content");
type AdminQuestionsRouteModule = typeof import("../../app/api/admin/questions/route");

type RouteModule = {
  GET?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

type MockDbQuestion = {
  id: string;
  subject: string;
  grade: string;
  knowledge_point_id: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string | null;
  question_type: string | null;
  tags: string[] | null;
  abilities: string[] | null;
};

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

const ENV_KEYS = [
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
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
    "../../lib/content",
    "../../lib/storage",
    "../../lib/db",
    "../../lib/auth",
    "../../lib/guard",
    "../../lib/question-quality",
    "../../lib/admin-log",
    "../../lib/admin-step-up",
    "../../lib/api/http",
    "../../lib/api/route-factory",
    "../../lib/api/domains/index",
    "../../lib/api/domains/admin",
    "../../lib/api/domains/route",
    "../../lib/error-tracker",
    "../../lib/observability",
    "../../lib/request-context",
    "../../lib/runtime-guardrails",
    "../../app/api/admin/questions/route"
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-content-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });
  return { root, runtimeDir, seedDir };
}

async function loadFileBackedContentModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  const mod = require("../../lib/content") as ContentModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedContentModule(initialRows: MockDbQuestion[]) {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState = {
    rows: initialRows.map((row) => ({ ...row })),
    inserts: [] as string[],
    updates: [] as string[]
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
  dbMod.query = async (text: string) => {
    if (text.includes("SELECT * FROM questions")) {
      return dbState.rows.map((row) => ({ ...row }));
    }
    throw new Error(`unexpected query: ${text}`);
  };
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("INSERT INTO questions")) {
      const row: MockDbQuestion = {
        id: String(params[0]),
        subject: String(params[1]),
        grade: String(params[2]),
        knowledge_point_id: String(params[3]),
        stem: String(params[4]),
        options: params[5] as string[],
        answer: String(params[6]),
        explanation: String(params[7]),
        difficulty: String(params[8]),
        question_type: String(params[9]),
        tags: params[10] as string[],
        abilities: params[11] as string[]
      };
      dbState.rows.push(row);
      dbState.inserts.push(row.question_type ?? "");
      return row;
    }

    if (text.includes("UPDATE questions")) {
      const index = dbState.rows.findIndex((row) => row.id === String(params[0]));
      if (index < 0) return null;
      const current = dbState.rows[index];
      const nextRow: MockDbQuestion = {
        ...current,
        subject: params[1] === null ? current.subject : String(params[1]),
        grade: params[2] === null ? current.grade : String(params[2]),
        knowledge_point_id: params[3] === null ? current.knowledge_point_id : String(params[3]),
        stem: params[4] === null ? current.stem : String(params[4]),
        options: params[5] === null ? current.options : (params[5] as string[]),
        answer: params[6] === null ? current.answer : String(params[6]),
        explanation: params[7] === null ? current.explanation : String(params[7]),
        difficulty: params[8] === null ? current.difficulty : String(params[8]),
        question_type: params[9] === null ? current.question_type : String(params[9]),
        tags: params[10] === null ? current.tags : (params[10] as string[]),
        abilities: params[11] === null ? current.abilities : (params[11] as string[])
      };
      dbState.rows[index] = nextRow;
      dbState.updates.push(nextRow.question_type ?? "");
      return nextRow;
    }

    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/content") as ContentModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

function createAdminQuestionsGetRequest(search = "") {
  return new Request(`https://demo.test/api/admin/questions${search}`, {
    method: "GET"
  });
}

function loadAdminQuestionsRoute() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const adminUser = {
    id: "admin-1",
    role: "admin",
    email: "admin@example.com",
    name: "平台管理员"
  };

  setMockModule("../../lib/auth", {
    getCurrentUser: async () => adminUser,
    getSessionCookieName: () => "mvp_session"
  });
  setMockModule("../../lib/guard", {
    requireRole: async () => adminUser
  });
  setMockModule("../../lib/db", {
    isDbEnabled: () => false,
    query: async () => [],
    queryOne: async () => null
  });
  setMockModule("../../lib/content", {
    normalizeQuestionType: (value?: string | null) => {
      const normalized = value?.trim().toLowerCase();
      return normalized || "choice";
    },
    getQuestions: async () => [
      {
        id: "q-choice",
        subject: "math",
        grade: "7",
        knowledgePointId: "kp-1",
        stem: "选择题题干",
        options: ["A", "B"],
        answer: "A",
        explanation: "",
        difficulty: "medium",
        questionType: "choice",
        tags: [],
        abilities: []
      },
      {
        id: "q-fill",
        subject: "math",
        grade: "7",
        knowledgePointId: "kp-1",
        stem: "填空题题干",
        options: ["1"],
        answer: "1",
        explanation: "",
        difficulty: "medium",
        questionType: "fill",
        tags: [],
        abilities: []
      }
    ],
    getKnowledgePoints: async () => [
      {
        id: "kp-1",
        subject: "math",
        grade: "7",
        title: "有理数",
        chapter: "第一章",
        unit: "第一单元"
      }
    ],
    createQuestion: async () => null
  });
  setMockModule("../../lib/question-quality", {
    attachQualityFields: (question: Record<string, unknown>) => question,
    evaluateAndUpsertQuestionQuality: async () => null,
    listQuestionQualityMetrics: async () => []
  });
  setMockModule("../../lib/admin-log", {
    addAdminLog: async () => {}
  });
  setMockModule("../../lib/admin-step-up", {
    assertAdminStepUp: () => {}
  });
  setMockModule("../../lib/observability", {
    recordApiRequest: async () => {}
  });
  setMockModule("../../lib/error-tracker", {
    reportApiServerError: async () => {}
  });
  setMockModule("../../lib/runtime-guardrails", {
    getRuntimeGuardrailIssues: () => [],
    logRuntimeGuardrailIssues: () => {}
  });

  return withAliasResolution(
    () => require("../../app/api/admin/questions/route") as AdminQuestionsRouteModule & RouteModule
  );
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed content normalizes legacy question types on read and canonicalizes create and update writes", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedContentModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "questions.json"),
      JSON.stringify(
        [
          {
            id: "q-legacy-1",
            subject: "math",
            grade: "7",
            knowledgePointId: "kp-1",
            stem: "旧题",
            options: ["A", "B"],
            answer: "A",
            explanation: "",
            difficulty: "medium",
            questionType: " CHOICE ",
            tags: [],
            abilities: []
          }
        ],
        null,
        2
      )
    );

    const listed = await mod.getQuestions();
    assert.equal(listed[0]?.questionType, "choice");

    const created = await mod.createQuestion({
      subject: "math",
      grade: "7",
      knowledgePointId: "kp-1",
      stem: "新题",
      options: ["1"],
      answer: "1",
      explanation: "",
      difficulty: "medium",
      questionType: " Fill ",
      tags: [],
      abilities: []
    });
    assert.equal(created?.questionType, "fill");

    const updated = await mod.updateQuestion("q-legacy-1", {
      questionType: " Essay "
    });
    assert.equal(updated?.questionType, "essay");

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "questions.json"));
    assert.equal(stored[0]?.questionType, "essay");
    assert.equal(stored[1]?.questionType, "fill");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed content normalizes legacy question_type rows and canonicalizes create and update writes", async () => {
  const { mod, root, dbState } = await loadDbBackedContentModule([
    {
      id: "q-db-1",
      subject: "math",
      grade: "8",
      knowledge_point_id: "kp-1",
      stem: "旧题",
      options: ["A", "B"],
      answer: "A",
      explanation: "",
      difficulty: "medium",
      question_type: " CHOICE ",
      tags: [],
      abilities: []
    }
  ]);

  try {
    const listed = await mod.getQuestions();
    assert.equal(listed[0]?.questionType, "choice");

    const created = await mod.createQuestion({
      subject: "math",
      grade: "8",
      knowledgePointId: "kp-1",
      stem: "新增题",
      options: ["1"],
      answer: "1",
      explanation: "",
      difficulty: "medium",
      questionType: " Fill ",
      tags: [],
      abilities: []
    });
    assert.equal(created?.questionType, "fill");

    const updated = await mod.updateQuestion("q-db-1", {
      questionType: " Essay "
    });
    assert.equal(updated?.questionType, "essay");
    assert.deepEqual(dbState.inserts, ["fill"]);
    assert.deepEqual(dbState.updates, ["essay"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("admin questions route normalizes mixed-case questionType filters", async () => {
  const route = loadAdminQuestionsRoute();

  assert.ok(route.GET);
  const response = await route.GET(createAdminQuestionsGetRequest("?questionType=%20CHOICE%20"), { params: {} });
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data?: Array<{ id?: string; questionType?: string }>;
    filters?: { questionType?: string | null };
    facets?: { questionTypes?: Array<{ value?: string; count?: number }> };
  };
  assert.equal(payload.data?.length, 1);
  assert.equal(payload.data?.[0]?.id, "q-choice");
  assert.equal(payload.data?.[0]?.questionType, "choice");
  assert.equal(payload.filters?.questionType, "choice");
  assert.deepEqual(payload.facets?.questionTypes, [{ value: "choice", count: 1 }]);
});
