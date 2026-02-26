import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

export function createRuntime(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
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
    const { json, useCookies = true, timeoutMs = 20000, ...rest } = options;
    const headers = new Headers(rest.headers ?? {});

    if (json !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (useCookies) {
      const cookie = buildCookieHeader();
      if (cookie) {
        headers.set("cookie", cookie);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...rest,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
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
    const server = spawn("npm", ["run", mode, "--", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
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
    cookieJar,
    apiFetch,
    waitForServerReady,
    stopServer,
    startServer
  };
}
