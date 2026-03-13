import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type ReadinessProbeModule = typeof import("../../lib/readiness-probe");

const ENV_KEYS = ["API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER", "NODE_ENV", "READINESS_PROBE_TOKEN"] as const;
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
  for (const target of ["../../lib/readiness-probe", "../../lib/auth"]) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadModule() {
  resetModules();
  return require("../../lib/readiness-probe") as ReadinessProbeModule;
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("readiness probe bypasses authorization outside production", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.READINESS_PROBE_TOKEN;

  const mod = loadModule();
  const access = await mod.assertReadinessProbeAccess(new Request("https://demo.test/api/health/readiness"));
  assert.equal(access.mode, "bypass");
});

test("readiness probe accepts matching token in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.READINESS_PROBE_TOKEN = "probe-secret";
  delete process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER;

  const mod = loadModule();
  const access = await mod.assertReadinessProbeAccess(
    new Request("https://demo.test/api/health/readiness", {
      headers: {
        "x-readiness-token": "probe-secret"
      }
    })
  );

  assert.equal(access.mode, "token");
});

test("readiness probe rejects missing token in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.READINESS_PROBE_TOKEN = "probe-secret";
  delete process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER;

  const mod = loadModule();

  await assert.rejects(
    mod.assertReadinessProbeAccess(new Request("https://demo.test/api/health/readiness")),
    /readiness authorization required/
  );
});
