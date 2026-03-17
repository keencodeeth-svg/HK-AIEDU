import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

export function createRuntime(port) {
  const configuredBaseUrl = process.env.API_TEST_BASE_URL?.trim();
  const baseUrl = configuredBaseUrl
    ? configuredBaseUrl.replace(/\/+$/, "")
    : `http://127.0.0.1:${port}`;
  const baseOrigin = new URL(baseUrl).origin;
  const allowCustomOriginHeader = process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER === "true";
  const isRemote = Boolean(configuredBaseUrl);
  const readinessToken = process.env.API_TEST_READINESS_TOKEN?.trim() || process.env.READINESS_PROBE_TOKEN?.trim() || "";
  const cookieJar = new Map();
  let activeServer = null;
  let activeMode = null;
  let serverLog = "";

  function parseJsonSafely(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function updateCookieJar(response) {
    const getSetCookie = response.headers.getSetCookie;
    const rawCookies =
      typeof getSetCookie === "function"
        ? getSetCookie.call(response.headers)
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie")]
          : [];

    rawCookies.forEach((raw) => {
      const first = String(raw).split(";")[0]?.trim();
      if (!first || !first.includes("=")) return;
      const [name, ...rest] = first.split("=");
      cookieJar.set(name, rest.join("="));
    });
  }

  function buildCookieHeader() {
    return Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function apiFetch(path, options = {}) {
    const { json, useCookies = true, timeoutMs = 20000, referrer, ...rest } = options;
    const headers = new Headers(rest.headers ?? {});
    const explicitTestOrigin = headers.has("x-test-origin");
    const method = String(rest.method ?? "GET").toUpperCase();
    const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";

    if (json !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (path === "/api/health/readiness" && readinessToken && !headers.has("x-readiness-token")) {
      headers.set("x-readiness-token", readinessToken);
    }
    if (useCookies) {
      const cookie = buildCookieHeader();
      if (cookie) {
        headers.set("cookie", cookie);
      }
    }
    if (allowCustomOriginHeader && !headers.has("x-test-origin")) {
      headers.set("x-test-origin", baseOrigin);
    }
    if (!safeMethod && !explicitTestOrigin) {
      if (!headers.has("origin")) {
        headers.set("origin", baseOrigin);
      }
      if (!headers.has("referer")) {
        headers.set("referer", typeof referrer === "string" && referrer.trim() ? referrer.trim() : `${baseUrl}/api-test`);
      }
    }
    const requestReferrer =
      typeof referrer === "string" && referrer.trim()
        ? referrer.trim()
        : !safeMethod && !explicitTestOrigin
          ? `${baseUrl}/api-test`
          : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...rest,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
        referrer: requestReferrer,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms: ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    updateCookieJar(response);
    const text = await response.text();
    const body = parseJsonSafely(text);
    return { status: response.status, body, raw: text };
  }

  async function waitForServerReady(timeoutMs = 90000) {
    const start = Date.now();
    let fallbackAttempted = false;
    while (Date.now() - start < timeoutMs) {
      if (isRemote) {
        try {
          const response = await fetch(`${baseUrl}/api/health`);
          if (response.ok) return;
        } catch {
          // retry
        }
        await delay(500);
        continue;
      }
      if (activeServer && activeServer.exitCode !== null) {
        if (
          !fallbackAttempted &&
          activeMode === "start" &&
          process.env.API_TEST_FALLBACK_TO_DEV !== "0"
        ) {
          fallbackAttempted = true;
          activeMode = "dev";
          activeServer = spawnServer(activeMode);
          continue;
        }
        throw new Error(`Server exited before ready with code ${activeServer.exitCode} (${activeMode})`);
      }
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) return;
      } catch {
        // retry
      }
      await delay(500);
    }
    throw new Error(`Server not ready in ${timeoutMs}ms`);
  }

  async function stopServer(server) {
    if (isRemote) return;
    const target = activeServer ?? server;
    if (!target || target.exitCode !== null) return;
    target.kill("SIGTERM");
    try {
      await Promise.race([once(target, "exit"), delay(5000)]);
    } catch {
      // ignore
    }
    if (target.exitCode === null) {
      target.kill("SIGKILL");
      await once(target, "exit");
    }
  }

  function spawnServer(mode) {
    const runtimeEnv = {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      REQUIRE_DATABASE: process.env.REQUIRE_DATABASE ?? "false",
      ALLOW_JSON_FALLBACK: process.env.ALLOW_JSON_FALLBACK ?? "true"
    };
    const server = spawn("npm", ["run", mode, "--", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: process.cwd(),
      env: runtimeEnv,
      stdio: ["ignore", "pipe", "pipe"]
    });
    server.stdout.on("data", (chunk) => {
      serverLog += `[${mode}] ${chunk.toString()}`;
    });
    server.stderr.on("data", (chunk) => {
      serverLog += `[${mode}] ${chunk.toString()}`;
    });
    return server;
  }

  function startServer() {
    if (isRemote) {
      return {
        server: null,
        getServerLog: () => ""
      };
    }
    const requestedMode = process.env.API_TEST_SERVER_MODE;
    activeMode = requestedMode === "start" ? "start" : "dev";
    activeServer = spawnServer(activeMode);

    return {
      server: activeServer,
      getServerLog: () => serverLog
    };
  }

  return {
    baseUrl,
    isRemote,
    cookieJar,
    apiFetch,
    waitForServerReady,
    stopServer,
    startServer
  };
}
