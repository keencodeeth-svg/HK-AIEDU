import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

type DiagnosticStartRouteModule = typeof import("../../app/api/diagnostic/start/route");

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
    "../../app/api/diagnostic/start/route",
    "../../lib/auth",
    "../../lib/progress",
    "../../lib/profiles",
    "../../lib/api/http",
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

function createDiagnosticStartRequest(body: unknown) {
  return new Request("https://demo.test/api/diagnostic/start", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function loadDiagnosticStartRoute() {
  resetModules();

  const progressCalls = [] as Array<{ subject: string; grade: string; count: number }>;

  setMockModule("../../lib/auth", {
    getCurrentUser: async () => ({
      id: "student-1",
      role: "student",
      grade: "7"
    })
  });

  setMockModule("../../lib/progress", {
    getDiagnosticQuestions: async (subject: string, grade: string, count: number) => {
      progressCalls.push({ subject, grade, count });
      return [
        {
          id: "q-1",
          stem: "诊断题示例",
          options: ["A", "B", "C", "D"],
          knowledgePointId: "kp-1"
        }
      ];
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
    unauthorized: () => {
      throw Object.assign(new Error("unauthorized"), { status: 401 });
    }
  });

  setMockModule("../../lib/api/domains", {
    createLearningRoute: (config: { handler: (context: { request: Request }) => Promise<unknown> }) => {
      return async (request: Request) => {
        const payload = await config.handler({ request });
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      };
    }
  });

  const route = withAliasResolution(
    () => require("../../app/api/diagnostic/start/route") as DiagnosticStartRouteModule & RouteModule
  );
  return { route, progressCalls };
}

afterEach(() => {
  resetModules();
});

test("diagnostic start route normalizes mixed-case subject before fetching questions", async () => {
  const { route, progressCalls } = loadDiagnosticStartRoute();

  assert.ok(route.POST);
  const response = await route.POST(createDiagnosticStartRequest({ subject: " ENGLISH ", grade: "7" }), {
    params: {}
  });

  assert.equal(response.status, 200);
  assert.deepEqual(progressCalls, [
    {
      subject: "english",
      grade: "7",
      count: 10
    }
  ]);

  const payload = (await response.json()) as {
    subject?: string;
    grade?: string;
    questions?: Array<{ id?: string }>;
  };
  assert.equal(payload.subject, "english");
  assert.equal(payload.grade, "7");
  assert.equal(payload.questions?.[0]?.id, "q-1");
});
