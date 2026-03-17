import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type PlanRouteModule = typeof import("../../app/api/plan/route");
type PlanRefreshRouteModule = typeof import("../../app/api/plan/refresh/route");

type RouteModule = {
  GET?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

const ENV_KEYS = [
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
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
    "../../app/api/plan/route",
    "../../app/api/plan/refresh/route",
    "../../lib/auth",
    "../../lib/progress",
    "../../lib/mastery",
    "../../lib/plan-enrichment",
    "../../lib/profiles",
    "../../lib/api/http",
    "../../lib/api/route-factory",
    "../../lib/api/domains/index",
    "../../lib/api/domains/learning",
    "../../lib/api/domains/route",
    "../../lib/error-tracker",
    "../../lib/observability",
    "../../lib/request-context",
    "../../lib/runtime-guardrails"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function createPlanRequest(search = "") {
  return new Request(`https://demo.test/api/plan${search}`, {
    method: "GET"
  });
}

function createRefreshPlanRequest(body: unknown) {
  return new Request("https://demo.test/api/plan/refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createPlan(subject: string) {
  return {
    id: `plan-${subject}`,
    userId: "student-1",
    subject,
    createdAt: "2026-03-17T00:00:00.000Z",
    items: [{ knowledgePointId: `kp-${subject}`, targetCount: 3, dueDate: "2026-03-18" }]
  };
}

function installCommonMocks() {
  const authMod = require("../../lib/auth") as {
    getCurrentUser: () => Promise<unknown>;
    getSessionCookieName: () => string;
  };
  authMod.getCurrentUser = async () => ({
    id: "student-1",
    role: "student",
    email: "student@example.com",
    name: "学生"
  });
  authMod.getSessionCookieName = () => "mvp_session";

  const profilesMod = require("../../lib/profiles") as {
    getStudentProfile: (userId: string) => Promise<unknown>;
  };
  profilesMod.getStudentProfile = async () => ({
    id: "profile-1",
    userId: "student-1",
    grade: "7",
    subjects: [" MATH ", " ENGLISH "],
    updatedAt: "2026-03-17T00:00:00.000Z"
  });

  const masteryMod = require("../../lib/mastery") as {
    getMasteryRecordsByUser: (userId: string, subject?: string) => Promise<unknown[]>;
    getWeaknessRankMap: (records: unknown[], subject?: string) => Map<string, number>;
    indexMasteryByKnowledgePoint: (records: unknown[]) => Map<string, unknown>;
  };
  masteryMod.getMasteryRecordsByUser = async () => [];
  masteryMod.getWeaknessRankMap = () => new Map();
  masteryMod.indexMasteryByKnowledgePoint = () => new Map();

  const enrichmentMod = require("../../lib/plan-enrichment") as {
    enrichPlanWithMastery: (plan: Record<string, unknown>) => Record<string, unknown>;
  };
  enrichmentMod.enrichPlanWithMastery = (plan) => plan;

  const observabilityMod = require("../../lib/observability") as {
    recordApiRequest: (input: Record<string, unknown>) => Promise<void>;
  };
  observabilityMod.recordApiRequest = async () => {};

  const errorTrackerMod = require("../../lib/error-tracker") as {
    reportApiServerError: (input: Record<string, unknown>) => Promise<void>;
  };
  errorTrackerMod.reportApiServerError = async () => {};

  const runtimeGuardrailsMod = require("../../lib/runtime-guardrails") as {
    getRuntimeGuardrailIssues: () => unknown[];
    logRuntimeGuardrailIssues: (issues: unknown[]) => void;
  };
  runtimeGuardrailsMod.getRuntimeGuardrailIssues = () => [];
  runtimeGuardrailsMod.logRuntimeGuardrailIssues = () => {};
}

function loadPlanRoute() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  installCommonMocks();

  const progressCalls = {
    getStudyPlans: [] as Array<{ userId: string; subjects: string[] }>,
    getStudyPlan: [] as Array<{ userId: string; subject: string }>
  };

  const progressMod = require("../../lib/progress") as {
    generateStudyPlan: (userId: string, subject: string) => Promise<unknown>;
    generateStudyPlans: (userId: string, subjects: string[]) => Promise<unknown[]>;
    getStudyPlan: (userId: string, subject: string) => Promise<unknown>;
    getStudyPlans: (userId: string, subjects: string[]) => Promise<unknown[]>;
  };
  progressMod.getStudyPlans = async (userId, subjects) => {
    progressCalls.getStudyPlans.push({ userId, subjects: [...subjects] });
    return [];
  };
  progressMod.generateStudyPlans = async (_userId, subjects) => subjects.map((subject) => createPlan(subject));
  progressMod.getStudyPlan = async (userId, subject) => {
    progressCalls.getStudyPlan.push({ userId, subject });
    return createPlan(subject);
  };
  progressMod.generateStudyPlan = async (_userId, subject) => createPlan(subject);

  const route = withAliasResolution(() => require("../../app/api/plan/route") as PlanRouteModule & RouteModule);
  return { route, progressCalls };
}

function loadRefreshPlanRoute() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  installCommonMocks();

  const progressCalls = {
    refreshStudyPlan: [] as Array<{ userId: string; subject: string }>
  };
  const masteryCalls = [] as Array<{ userId: string; subject?: string }>;

  const progressMod = require("../../lib/progress") as {
    refreshStudyPlan: (userId: string, subject: string) => Promise<unknown>;
  };
  progressMod.refreshStudyPlan = async (userId, subject) => {
    progressCalls.refreshStudyPlan.push({ userId, subject });
    return createPlan(subject);
  };

  const masteryMod = require("../../lib/mastery") as {
    getMasteryRecordsByUser: (userId: string, subject?: string) => Promise<unknown[]>;
  };
  masteryMod.getMasteryRecordsByUser = async (userId, subject) => {
    masteryCalls.push({ userId, subject });
    return [];
  };

  const route = withAliasResolution(
    () => require("../../app/api/plan/refresh/route") as PlanRefreshRouteModule & RouteModule
  );
  return { route, progressCalls, masteryCalls };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("plan route treats mixed-case ALL as the aggregate multi-subject scope", async () => {
  const { route, progressCalls } = loadPlanRoute();

  assert.ok(route.GET);
  const response = await route.GET(createPlanRequest("?subject=%20ALL%20"), { params: {} });

  assert.equal(response.status, 200);
  assert.deepEqual(progressCalls.getStudyPlans, [
    {
      userId: "student-1",
      subjects: ["math", "english"]
    }
  ]);
  assert.equal(progressCalls.getStudyPlan.length, 0);

  const payload = (await response.json()) as {
    data?: { plans?: Array<{ subject?: string }> };
  };
  assert.deepEqual(
    payload.data?.plans?.map((plan) => plan.subject),
    ["math", "english"]
  );
});

test("plan refresh route normalizes mixed-case subject before refresh and mastery lookup", async () => {
  const { route, progressCalls, masteryCalls } = loadRefreshPlanRoute();

  assert.ok(route.POST);
  const response = await route.POST(createRefreshPlanRequest({ subject: " MATH " }), { params: {} });

  assert.equal(response.status, 200);
  assert.deepEqual(progressCalls.refreshStudyPlan, [{ userId: "student-1", subject: "math" }]);
  assert.deepEqual(masteryCalls, [{ userId: "student-1", subject: "math" }]);

  const payload = (await response.json()) as {
    data?: { subject?: string };
  };
  assert.equal(payload.data?.subject, "math");
});
