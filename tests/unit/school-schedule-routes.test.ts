import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type SchoolSchedulesRouteModule = typeof import("../../app/api/school/schedules/route");
type SchoolScheduleAiPreviewRouteModule = typeof import("../../app/api/school/schedules/ai-preview/route");
type SchoolScheduleAiPreviewApplyRouteModule = typeof import("../../app/api/school/schedules/ai-preview/[id]/apply/route");
type SchoolScheduleRollbackRouteModule = typeof import("../../app/api/school/schedules/ai-operations/rollback/route");
type _AuthModule = typeof import("../../lib/auth");
type _ObservabilityModule = typeof import("../../lib/observability");
type _ErrorTrackerModule = typeof import("../../lib/error-tracker");
type _RuntimeGuardrailsModule = typeof import("../../lib/runtime-guardrails");
type _ClassSchedulesModule = typeof import("../../lib/class-schedules");
type _ClassesModule = typeof import("../../lib/classes");
type _SchoolAdminModule = typeof import("../../lib/school-admin");
type _SchoolScheduleAiOperationsModule = typeof import("../../lib/school-schedule-ai-operations");

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

type RouteModule = {
  GET?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

type CurrentUser = {
  id: string;
  role: "admin" | "school_admin";
  schoolId?: string;
  email: string;
  name: string;
} | null;

const ENV_KEYS = [
  "API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER",
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

function setBaseEnv() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER = "true";
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;
}

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

function resetModules() {
  const targets = [
    "../../app/api/school/schedules/route",
    "../../app/api/school/schedules/ai-preview/route",
    "../../app/api/school/schedules/ai-preview/[id]/apply/route",
    "../../app/api/school/schedules/ai-operations/rollback/route",
    "../../lib/auth",
    "../../lib/api/route-factory",
    "../../lib/api/domains/route",
    "../../lib/api/domains/learning",
    "../../lib/api/domains/index",
    "../../lib/api/http",
    "../../lib/class-schedules",
    "../../lib/classes",
    "../../lib/error-tracker",
    "../../lib/observability",
    "../../lib/runtime-guardrails",
    "../../lib/guard",
    "../../lib/school-admin",
    "../../lib/school-schedule-ai-operations"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function installBaseMocks(user: CurrentUser) {
  setBaseEnv();
  resetModules();

  const authMod = require("../../lib/auth") as any;
  authMod.getCurrentUser = async () => user;

  const observabilityMod = require("../../lib/observability") as any;
  observabilityMod.recordApiRequest = async () => {};

  const errorTrackerMod = require("../../lib/error-tracker") as any;
  errorTrackerMod.reportApiServerError = async () => {};

  const runtimeGuardrailsMod = require("../../lib/runtime-guardrails") as any;
  runtimeGuardrailsMod.getRuntimeGuardrailIssues = () => [];
  runtimeGuardrailsMod.logRuntimeGuardrailIssues = () => {};
}

function createJsonRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://demo.test",
      cookie: "mvp_session=test-token"
    },
    body: body === undefined ? JSON.stringify({}) : JSON.stringify(body)
  });
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

function createUser(role: "admin" | "school_admin", schoolId?: string): Exclude<CurrentUser, null> {
  return {
    id: role === "admin" ? "admin-1" : "school-admin-1",
    role,
    schoolId,
    email: role === "admin" ? "admin@example.com" : "school-admin@example.com",
    name: role === "admin" ? "平台管理员" : "学校管理员"
  };
}

function loadSchedulesRoute(user: CurrentUser, overrides?: {
  listSchoolClasses?: () => Promise<unknown[]>;
  listClassScheduleSessions?: () => Promise<unknown[]>;
  getClassById?: (classId: string) => Promise<unknown>;
  createClassScheduleSession?: (input: unknown) => Promise<unknown>;
}) {
  installBaseMocks(user);

  const schoolAdminMod = require("../../lib/school-admin") as any;
  schoolAdminMod.listSchoolClasses = overrides?.listSchoolClasses ?? (async () => []);

  const schedulesMod = require("../../lib/class-schedules") as any;
  schedulesMod.listClassScheduleSessions = overrides?.listClassScheduleSessions ?? (async () => []);
  schedulesMod.createClassScheduleSession =
    overrides?.createClassScheduleSession ??
    (async (input: { classId: string }) => ({
      id: "sched-created-1",
      schoolId: "school-default",
      classId: input.classId,
      weekday: 1,
      startTime: "08:00",
      endTime: "08:45",
      locked: false,
      createdAt: "2026-03-17T08:00:00.000Z",
      updatedAt: "2026-03-17T08:00:00.000Z"
    }));

  const classesMod = require("../../lib/classes") as any;
  classesMod.getClassById =
    overrides?.getClassById ??
    (async (classId: string) => ({
      id: classId,
      schoolId: "school-default"
    }));

  return withAliasResolution(
    () => require("../../app/api/school/schedules/route") as SchoolSchedulesRouteModule & RouteModule
  );
}

function loadAiPreviewRoute(user: CurrentUser, overrides?: {
  previewSchoolAiScheduleOperation?: (input: unknown) => Promise<unknown>;
}) {
  installBaseMocks(user);

  const operationsMod = require("../../lib/school-schedule-ai-operations") as any;
  operationsMod.previewSchoolAiScheduleOperation =
    overrides?.previewSchoolAiScheduleOperation ??
    (async () => ({ previewId: "preview-1", applied: false }));

  return withAliasResolution(
    () => require("../../app/api/school/schedules/ai-preview/route") as SchoolScheduleAiPreviewRouteModule & RouteModule
  );
}

function loadAiApplyRoute(user: CurrentUser, overrides?: {
  applySchoolAiSchedulePreview?: (id: string, scope?: { schoolId?: string | null }) => Promise<unknown>;
}) {
  installBaseMocks(user);

  const operationsMod = require("../../lib/school-schedule-ai-operations") as any;
  operationsMod.applySchoolAiSchedulePreview =
    overrides?.applySchoolAiSchedulePreview ??
    (async (id: string) => ({ operationId: id, applied: true }));

  return withAliasResolution(
    () =>
      require("../../app/api/school/schedules/ai-preview/[id]/apply/route") as SchoolScheduleAiPreviewApplyRouteModule &
        RouteModule
  );
}

function loadRollbackRoute(user: CurrentUser, overrides?: {
  rollbackSchoolAiScheduleOperation?: (input: { schoolId?: string | null; operationId?: string }) => Promise<unknown>;
}) {
  installBaseMocks(user);

  const operationsMod = require("../../lib/school-schedule-ai-operations") as any;
  operationsMod.rollbackSchoolAiScheduleOperation =
    overrides?.rollbackSchoolAiScheduleOperation ??
    (async (input: { schoolId?: string | null; operationId?: string }) => ({
      operationId: input.operationId ?? "latest",
      restoredSessionCount: 2
    }));

  return withAliasResolution(
    () =>
      require("../../app/api/school/schedules/ai-operations/rollback/route") as SchoolScheduleRollbackRouteModule &
        RouteModule
  );
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("school schedules GET returns enriched sessions and summary", async () => {
  const route = loadSchedulesRoute(
    createUser("admin"),
    {
      listSchoolClasses: async () => [
        {
          id: "class-1",
          name: "七年级一班",
          subject: "math",
          grade: "7",
          teacherName: "张老师",
          teacherId: "teacher-1"
        },
        {
          id: "class-2",
          name: "七年级二班",
          subject: "english",
          grade: "7",
          teacherName: "李老师",
          teacherId: "teacher-2"
        }
      ],
      listClassScheduleSessions: async () => [
        {
          id: "sched-1",
          schoolId: "school-1",
          classId: "class-1",
          weekday: 1,
          startTime: "08:00",
          endTime: "08:45",
          locked: false,
          createdAt: "2026-03-17T08:00:00.000Z",
          updatedAt: "2026-03-17T08:00:00.000Z"
        },
        {
          id: "sched-orphan",
          schoolId: "school-1",
          classId: "class-missing",
          weekday: 2,
          startTime: "09:00",
          endTime: "09:45",
          locked: false,
          createdAt: "2026-03-17T09:00:00.000Z",
          updatedAt: "2026-03-17T09:00:00.000Z"
        }
      ]
    }
  );

  const response = await route.GET!(
    new Request("https://demo.test/api/school/schedules?schoolId=school-1"),
    { params: {} }
  );
  const payload = await readJson<{
    code: number;
    data: {
      summary: {
        totalSessions: number;
        activeClasses: number;
        classesWithoutScheduleCount: number;
        averageLessonsPerWeek: number;
      };
      sessions: Array<{ id: string; className: string; teacherId: string | null }>;
    };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.code, 0);
  assert.equal(payload.data.summary.totalSessions, 1);
  assert.equal(payload.data.summary.activeClasses, 1);
  assert.equal(payload.data.summary.classesWithoutScheduleCount, 1);
  assert.equal(payload.data.summary.averageLessonsPerWeek, 0.5);
  assert.equal(payload.data.sessions.length, 1);
  assert.equal(payload.data.sessions[0]?.id, "sched-1");
  assert.equal(payload.data.sessions[0]?.className, "七年级一班");
  assert.equal(payload.data.sessions[0]?.teacherId, "teacher-1");
});

test("school schedules POST blocks cross-school class creation for school admin", async () => {
  const route = loadSchedulesRoute(
    createUser("school_admin", "school-1"),
    {
      getClassById: async (classId: string) => ({
        id: classId,
        schoolId: "school-2"
      })
    }
  );

  const response = await route.POST!(
    createJsonRequest("https://demo.test/api/school/schedules", {
      classId: "class-1",
      weekday: 1,
      startTime: "08:00",
      endTime: "08:45"
    }),
    { params: {} }
  );
  const payload = await readJson<{ code: number; message: string }>(response);

  assert.equal(response.status, 403);
  assert.equal(payload.code, 403);
  assert.equal(payload.message, "跨学校访问已禁止");
});

test("school schedule AI preview uses school-admin scope and default values", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const route = loadAiPreviewRoute(
    createUser("school_admin", "school-1"),
    {
      previewSchoolAiScheduleOperation: async (input: unknown) => {
        capturedInput = input as Record<string, unknown>;
        return { previewId: "preview-1", applied: false };
      }
    }
  );

  const response = await route.POST!(
    createJsonRequest("https://demo.test/api/school/schedules/ai-preview", {
      classIds: ["class-1"],
      weeklyLessonsPerClass: 4,
      lessonDurationMinutes: 45,
      periodsPerDay: 6,
      weekdays: [1, 3, 5],
      dayStartTime: "08:00"
    }),
    { params: {} }
  );
  const payload = await readJson<{ code: number; data: { previewId: string } }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.code, 0);
  assert.equal(payload.data.previewId, "preview-1");
  assert.deepEqual(capturedInput, {
    schoolId: "school-1",
    classIds: ["class-1"],
    weeklyLessonsPerClass: 4,
    lessonDurationMinutes: 45,
    periodsPerDay: 6,
    weekdays: [1, 3, 5],
    dayStartTime: "08:00",
    shortBreakMinutes: 10,
    lunchBreakAfterPeriod: undefined,
    lunchBreakMinutes: 60,
    mode: "fill_missing",
    campus: undefined
  });
});

test("school schedule AI preview apply forwards school scope for school admin", async () => {
  let captured: { id: string; scope?: { schoolId?: string | null } } | null = null;
  const route = loadAiApplyRoute(
    createUser("school_admin", "school-1"),
    {
      applySchoolAiSchedulePreview: async (id, scope) => {
        captured = { id, scope };
        return { operationId: "op-1", applied: true };
      }
    }
  );

  const response = await route.POST!(
    createJsonRequest("https://demo.test/api/school/schedules/ai-preview/preview-1/apply"),
    { params: { id: "preview-1" } }
  );
  const payload = await readJson<{ code: number; data: { operationId: string } }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.data.operationId, "op-1");
  assert.deepEqual(captured, {
    id: "preview-1",
    scope: { schoolId: "school-1" }
  });
});

test("school schedule rollback requires schoolId for platform admin when operationId is missing", async () => {
  const route = loadRollbackRoute(createUser("admin"));

  const response = await route.POST!(
    createJsonRequest("https://demo.test/api/school/schedules/ai-operations/rollback", {}),
    { params: {} }
  );
  const payload = await readJson<{ code: number; message: string }>(response);

  assert.equal(response.status, 400);
  assert.equal(payload.code, 400);
  assert.equal(payload.message, "schoolId required for platform admin");
});

test("school schedule rollback forwards school-admin scope and operation id", async () => {
  let capturedInput: { schoolId?: string | null; operationId?: string } | null = null;
  const route = loadRollbackRoute(
    createUser("school_admin", "school-1"),
    {
      rollbackSchoolAiScheduleOperation: async (input) => {
        capturedInput = input;
        return { operationId: "op-1", restoredSessionCount: 3 };
      }
    }
  );

  const response = await route.POST!(
    createJsonRequest("https://demo.test/api/school/schedules/ai-operations/rollback", {
      operationId: "op-1"
    }),
    { params: {} }
  );
  const payload = await readJson<{ code: number; data: { operationId: string; restoredSessionCount: number } }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.data.operationId, "op-1");
  assert.equal(payload.data.restoredSessionCount, 3);
  assert.deepEqual(capturedInput, {
    schoolId: "school-1",
    operationId: "op-1"
  });
});
