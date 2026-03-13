import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type ErrorTrackerModule = typeof import("../../lib/error-tracker");
type RequestContextModule = typeof import("../../lib/request-context");

const ENV_KEYS = ["ERROR_TRACKING_APP", "ERROR_TRACKING_TOKEN", "ERROR_TRACKING_WEBHOOK_URL", "NODE_ENV"] as const;
const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));
const ORIGINAL_FETCH = global.fetch;

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
  for (const target of ["../../lib/error-tracker", "../../lib/request-context"]) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadModules() {
  resetModules();
  return {
    tracker: require("../../lib/error-tracker") as ErrorTrackerModule,
    requestContext: require("../../lib/request-context") as RequestContextModule
  };
}

afterEach(() => {
  resetModules();
  restoreEnv();
  global.fetch = ORIGINAL_FETCH;
});

test("reportTrackedError stays disabled without webhook config", async () => {
  delete process.env.ERROR_TRACKING_WEBHOOK_URL;
  delete process.env.ERROR_TRACKING_TOKEN;
  process.env.NODE_ENV = "test";

  let called = false;
  global.fetch = (async () => {
    called = true;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  const { tracker } = loadModules();
  const result = await tracker.reportTrackedError({
    source: "api",
    message: "disabled test",
    traceId: "trace-disabled"
  });

  assert.equal(result.enabled, false);
  assert.equal(result.reported, false);
  assert.equal(result.reason, "disabled");
  assert.equal(called, false);
  assert.equal(tracker.getErrorTrackingStatus().enabled, false);
});

test("reportApiServerError sends webhook payload with trace context and sanitized details", async () => {
  process.env.ERROR_TRACKING_WEBHOOK_URL = "https://tracker.example.test/events";
  process.env.ERROR_TRACKING_TOKEN = "secret-token";
  process.env.ERROR_TRACKING_APP = "hk-ai-edu-pilot";
  process.env.NODE_ENV = "production";

  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  global.fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  const { tracker, requestContext } = loadModules();
  const result = await requestContext.runWithRequestContext(
    {
      requestId: "req-1",
      traceId: "trace-1"
    },
    async () => {
      requestContext.updateRequestContext({
        userId: "admin-1",
        userRole: "admin",
        apiDomain: "admin",
        pathname: "/api/admin/observability/metrics",
        method: "GET"
      });

      return tracker.reportApiServerError({
        error: new Error("boom"),
        status: 500,
        details: {
          nested: {
            note: "x".repeat(1200)
          }
        }
      });
    }
  );

  assert.equal(result.enabled, true);
  assert.equal(result.reported, true);
  assert.equal(result.statusCode, 202);
  assert.equal(result.traceId, "trace-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://tracker.example.test/events");
  assert.equal((calls[0]?.init?.headers as Headers).get("authorization"), "Bearer secret-token");

  const payload = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(payload.app, "hk-ai-edu-pilot");
  assert.equal(payload.environment, "production");
  assert.equal(payload.source, "api");
  assert.equal(payload.traceId, "trace-1");
  assert.equal(payload.requestId, "req-1");
  assert.equal(payload.request.method, "GET");
  assert.equal(payload.request.path, "/api/admin/observability/metrics");
  assert.equal(payload.request.domain, "admin");
  assert.equal(payload.request.status, 500);
  assert.equal(payload.user.id, "admin-1");
  assert.equal(payload.user.role, "admin");
  assert.equal(payload.error.message, "boom");
  assert.equal(payload.details.nested.note.length, 600);
});
