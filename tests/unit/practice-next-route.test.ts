import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type PracticeNextRouteModule = typeof import("../../app/api/practice/next/route");

type RouteModule = {
  POST?: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
};

const projectRoot = path.resolve(__dirname, "../..");
const originalResolveFilename = Module._resolveFilename;

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
    "../../app/api/practice/next/route",
    "../../lib/progress",
    "../../lib/review-scheduler",
    "../../lib/content",
    "../../lib/mastery",
    "../../lib/profiles",
    "../../lib/api/http",
    "../../lib/api/validation",
    "../../lib/api/domains",
    "../../lib/api/domains/index"
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

function createPracticeNextRequest(body: unknown) {
  return new Request("https://demo.test/api/practice/next", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "q-1",
    subject: "math",
    grade: "7",
    knowledgePointId: "kp-1",
    stem: "1 + 1 = ?",
    options: ["1", "2", "3", "4"],
    answer: "2",
    explanation: "基础加法",
    ...overrides
  };
}

function loadPracticeNextRoute() {
  resetModules();

  const progressCalls = {
    getPracticeQuestions: [] as Array<{ subject: string; grade: string; knowledgePointId?: string }>,
    getWrongQuestionIds: [] as string[]
  };
  const masteryCalls = {
    getMasteryRecordsByUser: [] as Array<{ userId: string; subject?: string }>,
    getWeaknessRankMap: [] as Array<{ subject?: string }>
  };

  setMockModule("../../lib/progress", {
    getAdaptiveQuestions: async () => [],
    getPracticeQuestions: async (subject: string, grade: string, knowledgePointId?: string) => {
      progressCalls.getPracticeQuestions.push({ subject, grade, knowledgePointId });
      return [createQuestion({ subject })];
    },
    getWrongQuestionIds: async (userId: string) => {
      progressCalls.getWrongQuestionIds.push(userId);
      return ["q-1"];
    }
  });

  setMockModule("../../lib/review-scheduler", {
    getUnifiedReviewQuestionCandidates: async () => []
  });

  setMockModule("../../lib/content", {
    getQuestions: async () => [createQuestion()]
  });

  setMockModule("../../lib/mastery", {
    getMasteryRecordsByUser: async (userId: string, subject?: string) => {
      masteryCalls.getMasteryRecordsByUser.push({ userId, subject });
      return [];
    },
    getWeaknessRankMap: (_records: unknown[], subject?: string) => {
      masteryCalls.getWeaknessRankMap.push({ subject });
      return new Map([["kp-1", 1]]);
    }
  });

  setMockModule("../../lib/profiles", {
    getStudentProfile: async () => ({
      id: "profile-1",
      userId: "student-1",
      grade: "7"
    })
  });

  setMockModule("../../lib/api/http", {
    notFound: (message: string) => {
      throw Object.assign(new Error(message), { status: 404 });
    },
    unauthorized: () => {
      throw Object.assign(new Error("unauthorized"), { status: 401 });
    }
  });

  setMockModule("../../lib/api/domains", {
    createLearningRoute: (config: {
      handler: (context: { request: Request; user: Record<string, unknown> }) => Promise<unknown>;
    }) => {
      return async (request: Request) => {
        const payload = await config.handler({
          request,
          user: {
            id: "student-1",
            role: "student",
            grade: "7"
          }
        });
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      };
    }
  });

  const route = withAliasResolution(() => require("../../app/api/practice/next/route") as PracticeNextRouteModule & RouteModule);
  return { route, progressCalls, masteryCalls };
}

afterEach(() => {
  resetModules();
});

test("practice next route normalizes mixed-case subject for wrong-mode filtering", async () => {
  const { route, progressCalls } = loadPracticeNextRoute();

  assert.ok(route.POST);
  const response = await route.POST(createPracticeNextRequest({ mode: "wrong", subject: " MATH ", grade: "7" }), {
    params: {}
  });

  assert.equal(response.status, 200);
  assert.deepEqual(progressCalls.getPracticeQuestions, [
    {
      subject: "math",
      grade: "7",
      knowledgePointId: undefined
    }
  ]);

  const payload = (await response.json()) as {
    question?: { id?: string };
  };
  assert.equal(payload.question?.id, "q-1");
});

test("practice next route forwards normalized subject to practice and mastery services", async () => {
  const { route, progressCalls, masteryCalls } = loadPracticeNextRoute();

  assert.ok(route.POST);
  const response = await route.POST(createPracticeNextRequest({ subject: " English ", grade: "7" }), {
    params: {}
  });

  assert.equal(response.status, 200);
  assert.deepEqual(progressCalls.getPracticeQuestions, [
    {
      subject: "english",
      grade: "7",
      knowledgePointId: undefined
    }
  ]);
  assert.deepEqual(masteryCalls.getMasteryRecordsByUser, [
    {
      userId: "student-1",
      subject: "english"
    }
  ]);
  assert.deepEqual(masteryCalls.getWeaknessRankMap, [{ subject: "english" }]);

  const payload = (await response.json()) as {
    question?: { id?: string; recommendation?: { reason?: string } };
  };
  assert.equal(payload.question?.id, "q-1");
  assert.equal(payload.question?.recommendation?.reason, "知识点薄弱度第 1 位");
});
