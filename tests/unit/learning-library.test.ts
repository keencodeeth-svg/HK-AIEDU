import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type LearningLibraryModule = typeof import("../../lib/learning-library");
type AdminLibraryRouteModule = typeof import("../../app/api/admin/library/route");
type AdminLibraryBatchImportRouteModule = typeof import("../../app/api/admin/library/batch-import/route");
type LibraryRouteModule = typeof import("../../app/api/library/route");
type TeacherLibraryAiGenerateRouteModule = typeof import("../../app/api/teacher/library/ai-generate/route");

type RouteModule = {
  GET?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

type MockDbLibraryItem = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  subject: string;
  grade: string;
  owner_role: string;
  owner_id: string;
  class_id: string | null;
  access_scope: string;
  source_type: string;
  file_name: string | null;
  mime_type: string | null;
  size: number | null;
  content_base64: string | null;
  content_storage_provider: string | null;
  content_storage_key: string | null;
  link_url: string | null;
  text_content: string | null;
  knowledge_point_ids: string[] | null;
  extracted_knowledge_points: string[] | null;
  generated_by_ai: boolean | null;
  status: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
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
    "../../lib/learning-library",
    "../../lib/storage",
    "../../lib/runtime-guardrails",
    "../../lib/db",
    "../../lib/ai",
    "../../lib/ai-quality-control",
    "../../lib/admin-log",
    "../../lib/admin-step-up",
    "../../lib/auth",
    "../../lib/classes",
    "../../lib/content",
    "../../lib/file-text-extract",
    "../../lib/library-access",
    "../../lib/library-rag",
    "../../lib/error-tracker",
    "../../lib/guard",
    "../../lib/observability",
    "../../lib/object-storage",
    "../../lib/question-quality",
    "../../lib/request-context",
    "../../lib/api/http",
    "../../lib/api/route-factory",
    "../../lib/api/domains/index",
    "../../lib/api/domains/admin",
    "../../lib/api/domains/learning",
    "../../lib/api/domains/route",
    "../../app/api/admin/library/route",
    "../../app/api/admin/library/batch-import/route",
    "../../app/api/library/route",
    "../../app/api/teacher/library/ai-generate/route"
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

function installSupportMocks() {
  setMockModule("../../lib/ai", {
    extractKnowledgePointCandidates: async () => ({ points: [] })
  });
  setMockModule("../../lib/content", {
    getKnowledgePoints: async () => []
  });
  setMockModule("../../lib/file-text-extract", {
    extractReadableTextFromBase64: () => ""
  });
  setMockModule("../../lib/object-storage", {
    deleteObject: async () => {},
    getBase64Object: async () => null,
    putBase64Object: async () => ({ provider: "mock", key: "mock-key" })
  });
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-learning-library-"));
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
  installSupportMocks();

  const mod = require("../../lib/learning-library") as LearningLibraryModule;
  return { mod, root, runtimeDir, seedDir };
}

async function loadDbBackedModule(initialRows: MockDbLibraryItem[]) {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState = {
    rows: initialRows.map((row) => ({ ...row })),
    lookupParams: [] as string[]
  };

  process.env.NODE_ENV = "development";
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  installSupportMocks();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM learning_library_items")) {
      const shareToken = typeof params[0] === "string" ? String(params[0]) : null;
      return dbState.rows.filter((row) => (shareToken ? row.share_token?.trim().toLowerCase() === shareToken : true));
    }
    throw new Error(`unexpected query: ${text}`);
  };
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("WHERE lower(btrim(share_token)) = $1")) {
      const shareToken = String(params[0] ?? "");
      dbState.lookupParams.push(shareToken);
      return (
        dbState.rows.find(
          (row) =>
            row.share_token?.trim().toLowerCase() === shareToken &&
            row.status?.trim().toLowerCase() === "published"
        ) ?? null
      );
    }
    if (text.includes("WHERE id = $1")) {
      return dbState.rows.find((row) => row.id === String(params[0])) ?? null;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };

  const mod = require("../../lib/learning-library") as LearningLibraryModule;
  return { mod, root, runtimeDir, seedDir, dbState };
}

function createLibraryListRequest(search = "") {
  return new Request(`https://demo.test/api/library${search}`, {
    method: "GET"
  });
}

function createTeacherLibraryAiGenerateRequest(body: unknown) {
  return new Request("https://demo.test/api/teacher/library/ai-generate", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createAdminLibraryRequest(body: unknown) {
  return new Request("https://demo.test/api/admin/library", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createAdminLibraryBatchImportRequest(body: unknown) {
  return new Request("https://demo.test/api/admin/library/batch-import", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createMockLibraryItem(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lib-1",
    title: "几何课件",
    description: null,
    contentType: "courseware",
    subject: "math",
    grade: "7",
    ownerRole: "teacher",
    ownerId: "teacher-1",
    classId: "class-1",
    accessScope: "class",
    sourceType: "text",
    textContent: "课件正文",
    knowledgePointIds: [],
    extractedKnowledgePoints: [],
    generatedByAi: false,
    status: "published",
    createdAt: "2026-03-17T00:00:00.000Z",
    updatedAt: "2026-03-17T00:00:00.000Z",
    ...input
  };
}

function loadLibraryListRoute(overrides?: {
  listLearningLibraryItems?: (input: Record<string, unknown>) => Promise<unknown[]>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const listCalls: Array<Record<string, unknown>> = [];

  setMockModule("../../lib/auth", {
    getCurrentUser: async () => ({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
      name: "平台管理员"
    }),
    getSessionCookieName: () => "mvp_session"
  });
  setMockModule("../../lib/classes", {
    getClassesByTeacher: async () => [],
    getClassesByStudent: async () => []
  });
  setMockModule("../../lib/learning-library", {
    listLearningLibraryItems: async (input: Record<string, unknown>) => {
      listCalls.push({ ...input });
      if (overrides?.listLearningLibraryItems) {
        return overrides.listLearningLibraryItems(input);
      }
      return [createMockLibraryItem()];
    }
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

  const route = withAliasResolution(() => require("../../app/api/library/route") as LibraryRouteModule & RouteModule);
  return { route, listCalls };
}

function loadTeacherLibraryAiGenerateRoute(overrides?: {
  createLearningLibraryItem?: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const createCalls: Array<Record<string, unknown>> = [];

  setMockModule("../../lib/auth", {
    getCurrentUser: async () => ({
      id: "teacher-1",
      role: "teacher",
      email: "teacher@example.com",
      name: "王老师"
    }),
    getSessionCookieName: () => "mvp_session"
  });
  setMockModule("../../lib/classes", {
    getClassById: async (id: string) => ({
      id,
      name: "七年级一班",
      subject: "math",
      grade: "7",
      teacherId: "teacher-1"
    })
  });
  setMockModule("../../lib/content", {
    getKnowledgePoints: async () => []
  });
  setMockModule("../../lib/learning-library", {
    listLearningLibraryItems: async () => [],
    createLearningLibraryItem: async (input: Record<string, unknown>) => {
      createCalls.push({ ...input });
      if (overrides?.createLearningLibraryItem) {
        return overrides.createLearningLibraryItem(input);
      }
      return {
        id: "lib-ai-1",
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
        ...input
      };
    }
  });
  setMockModule("../../lib/library-access", {
    canAccessLearningLibraryItem: async () => true
  });
  setMockModule("../../lib/library-rag", {
    retrieveLibraryCitations: async () => [],
    summarizeCitationGovernance: () => ({
      total: 0,
      averageConfidence: 0,
      highTrustCount: 0,
      mediumTrustCount: 0,
      lowTrustCount: 0,
      riskLevel: "low",
      needsManualReview: false,
      manualReviewReason: ""
    }),
    toCitationPrompts: () => []
  });
  setMockModule("../../lib/ai", {
    generateLessonOutline: async () => ({
      objectives: ["掌握二次函数基本概念"],
      keyPoints: ["二次函数定义"],
      slides: [{ title: "导入", bullets: ["回顾一次函数"] }],
      blackboardSteps: ["定义", "图像", "例题"]
    })
  });
  setMockModule("../../lib/ai-quality-control", {
    assessAiQuality: () => ({
      score: 92,
      needsHumanReview: false,
      reasons: []
    })
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

  const route = withAliasResolution(
    () => require("../../app/api/teacher/library/ai-generate/route") as TeacherLibraryAiGenerateRouteModule & RouteModule
  );
  return { route, createCalls };
}

function loadAdminLibraryRoute(overrides?: {
  createLearningLibraryItem?: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const createCalls: Array<Record<string, unknown>> = [];
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
  setMockModule("../../lib/admin-step-up", {
    assertAdminStepUp: () => {}
  });
  setMockModule("../../lib/learning-library", {
    listLearningLibraryItems: async () => [],
    hydrateLearningLibraryItemContent: async (item: Record<string, unknown>) => item,
    createLearningLibraryItem: async (input: Record<string, unknown>) => {
      createCalls.push({ ...input });
      if (overrides?.createLearningLibraryItem) {
        return overrides.createLearningLibraryItem(input);
      }
      return {
        id: "lib-admin-1",
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
        ...input
      };
    }
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

  const route = withAliasResolution(
    () => require("../../app/api/admin/library/route") as AdminLibraryRouteModule & RouteModule
  );
  return { route, createCalls };
}

function loadAdminLibraryBatchImportRoute(overrides?: {
  createLearningLibraryItem?: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const createCalls: Array<Record<string, unknown>> = [];
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
  setMockModule("../../lib/admin-step-up", {
    assertAdminStepUp: () => {}
  });
  setMockModule("../../lib/admin-log", {
    addAdminLog: async () => {}
  });
  setMockModule("../../lib/content", {
    createKnowledgePoint: async () => null,
    createQuestion: async () => null,
    getKnowledgePoints: async () => [],
    getQuestions: async () => []
  });
  setMockModule("../../lib/question-quality", {
    attachQualityFields: (question: Record<string, unknown>) => question,
    evaluateAndUpsertQuestionQuality: async () => null
  });
  setMockModule("../../lib/learning-library", {
    createLearningLibraryItem: async (input: Record<string, unknown>) => {
      createCalls.push({ ...input });
      if (overrides?.createLearningLibraryItem) {
        return overrides.createLearningLibraryItem(input);
      }
      return {
        id: `lib-batch-${createCalls.length}`,
        title: String(input.title ?? ""),
        ...input
      };
    }
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

  const route = withAliasResolution(
    () => require("../../app/api/admin/library/batch-import/route") as AdminLibraryBatchImportRouteModule & RouteModule
  );
  return { route, createCalls };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed learning library normalizes legacy share tokens for list and public lookup", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "learning-library-items.json"),
      JSON.stringify(
        [
          {
            id: "lib-1",
            title: "几何复习",
            contentType: "textbook",
            subject: "math",
            grade: "7",
            ownerRole: "teacher",
            ownerId: "teacher-1",
            accessScope: "class",
            sourceType: "text",
            knowledgePointIds: ["kp-1", "kp-1"],
            extractedKnowledgePoints: ["三角形", "三角形"],
            generatedByAi: false,
            status: "published",
            shareToken: " A1B2C3D4 ",
            createdAt: "2026-03-17T00:00:00.000Z",
            updatedAt: "2026-03-17T00:00:00.000Z"
          },
          {
            id: "lib-2",
            title: "未发布草稿",
            contentType: "textbook",
            subject: "math",
            grade: "7",
            ownerRole: "teacher",
            ownerId: "teacher-1",
            accessScope: "class",
            sourceType: "text",
            knowledgePointIds: [],
            extractedKnowledgePoints: [],
            generatedByAi: false,
            status: "draft",
            shareToken: " D4C3B2A1 ",
            createdAt: "2026-03-17T00:00:00.000Z",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        ],
        null,
        2
      )
    );

    const listed = await mod.listLearningLibraryItems({ shareToken: "a1b2c3d4" });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.shareToken, "a1b2c3d4");
    assert.deepEqual(listed[0]?.knowledgePointIds, ["kp-1"]);
    assert.deepEqual(listed[0]?.extractedKnowledgePoints, ["三角形"]);

    const shared = await mod.getLearningLibraryItemByShareToken("A1B2C3D4");
    assert.equal(shared?.id, "lib-1");
    assert.equal(shared?.shareToken, "a1b2c3d4");

    const hiddenDraft = await mod.getLearningLibraryItemByShareToken("D4C3B2A1");
    assert.equal(hiddenDraft, null);

    const stored = await readJsonFile<Array<Record<string, unknown>>>(path.join(runtimeDir, "learning-library-items.json"));
    assert.equal(stored[0]?.shareToken, " A1B2C3D4 ");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed learning library share lookups are case-insensitive and preserve published-only visibility", async () => {
  const { mod, root, dbState } = await loadDbBackedModule([
    {
      id: "lib-db-1",
      title: "函数专题",
      description: null,
      content_type: "textbook",
      subject: "math",
      grade: "8",
      owner_role: "teacher",
      owner_id: "teacher-1",
      class_id: "class-1",
      access_scope: "class",
      source_type: "text",
      file_name: null,
      mime_type: null,
      size: null,
      content_base64: null,
      content_storage_provider: null,
      content_storage_key: null,
      link_url: null,
      text_content: "函数导学",
      knowledge_point_ids: ["kp-1"],
      extracted_knowledge_points: ["函数"],
      generated_by_ai: false,
      status: " PUBLISHED ",
      share_token: " FFEEDD11 ",
      created_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z"
    },
    {
      id: "lib-db-2",
      title: "草稿",
      description: null,
      content_type: "textbook",
      subject: "math",
      grade: "8",
      owner_role: "teacher",
      owner_id: "teacher-1",
      class_id: "class-1",
      access_scope: "class",
      source_type: "text",
      file_name: null,
      mime_type: null,
      size: null,
      content_base64: null,
      content_storage_provider: null,
      content_storage_key: null,
      link_url: null,
      text_content: "draft",
      knowledge_point_ids: ["kp-2"],
      extracted_knowledge_points: ["草稿"],
      generated_by_ai: false,
      status: " DRAFT ",
      share_token: " AABBCC22 ",
      created_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z"
    }
  ]);

  try {
    const shared = await mod.getLearningLibraryItemByShareToken("ffeedd11");
    assert.equal(shared?.id, "lib-db-1");
    assert.equal(shared?.shareToken, "ffeedd11");
    assert.deepEqual(dbState.lookupParams, ["ffeedd11"]);

    const hiddenDraft = await mod.getLearningLibraryItemByShareToken("AABBCC22");
    assert.equal(hiddenDraft, null);
    assert.deepEqual(dbState.lookupParams, ["ffeedd11", "aabbcc22"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("library list route normalizes mixed-case contentType filters before querying storage", async () => {
  const { route, listCalls } = loadLibraryListRoute();

  assert.ok(route.GET);
  const response = await route.GET(createLibraryListRequest("?contentType=%20COURSEWARE%20"), { params: {} });

  assert.equal(response.status, 200);
  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0]?.contentType, "courseware");

  const payload = (await response.json()) as {
    data?: Array<{ contentType?: string }>;
    summary?: { coursewareCount?: number; lessonPlanCount?: number };
  };
  assert.equal(payload.data?.[0]?.contentType, "courseware");
  assert.equal(payload.summary?.coursewareCount, 1);
  assert.equal(payload.summary?.lessonPlanCount, 0);
});

test("teacher library ai generate route normalizes mixed-case contentType before persisting item", async () => {
  const { route, createCalls } = loadTeacherLibraryAiGenerateRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createTeacherLibraryAiGenerateRequest({
      classId: "class-1",
      topic: "二次函数",
      contentType: " COURSEWARE ",
      knowledgePointIds: []
    }),
    { params: {} }
  );

  assert.equal(response.status, 200);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0]?.contentType, "courseware");
  assert.equal(createCalls[0]?.title, "二次函数 - 课件");

  const payload = (await response.json()) as {
    data?: {
      item?: {
        contentType?: string;
        title?: string;
      };
    };
  };
  assert.equal(payload.data?.item?.contentType, "courseware");
  assert.equal(payload.data?.item?.title, "二次函数 - 课件");
});

test("admin library route normalizes mixed-case contentType and sourceType before validation", async () => {
  const { route, createCalls } = loadAdminLibraryRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createAdminLibraryRequest({
      title: "函数资源",
      subject: "math",
      grade: "8",
      contentType: " COURSEWARE ",
      sourceType: " LINK ",
      linkUrl: "https://example.com/resource"
    }),
    { params: {} }
  );

  assert.equal(response.status, 200);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0]?.contentType, "courseware");
  assert.equal(createCalls[0]?.sourceType, "link");

  const payload = (await response.json()) as {
    data?: {
      contentType?: string;
      sourceType?: string;
    };
  };
  assert.equal(payload.data?.contentType, "courseware");
  assert.equal(payload.data?.sourceType, "link");
});

test("admin library batch import normalizes mixed-case textbook source and class scope", async () => {
  const { route, createCalls } = loadAdminLibraryBatchImportRoute();

  assert.ok(route.POST);
  const response = await route.POST(
    createAdminLibraryBatchImportRequest({
      textbooks: [
        {
          title: "代数教材",
          subject: "math",
          grade: "7",
          contentType: " TEXTBOOK ",
          sourceType: " FILE ",
          accessScope: " CLASS ",
          classId: " class-7-1 ",
          fileName: "algebra.pdf",
          mimeType: "application/pdf",
          size: 12,
          contentBase64: "ZGF0YQ=="
        }
      ]
    }),
    { params: {} }
  );

  assert.equal(response.status, 200);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0]?.contentType, "textbook");
  assert.equal(createCalls[0]?.sourceType, "file");
  assert.equal(createCalls[0]?.accessScope, "class");
  assert.equal(createCalls[0]?.classId, "class-7-1");

  const payload = (await response.json()) as {
    data?: {
      summary?: {
        textbooksImported?: number;
        textbooksFailed?: number;
      };
    };
  };
  assert.equal(payload.data?.summary?.textbooksImported, 1);
  assert.equal(payload.data?.summary?.textbooksFailed, 0);
});
