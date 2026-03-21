import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const IS_PRODUCTION_LIKE = process.env.PLAYWRIGHT_FORCE_PRODUCTION_LIKE === "true";
const PLAYWRIGHT_SERVER_MODE = process.env.PLAYWRIGHT_SERVER_MODE === "dev" ? "dev" : "start";

function compactEnv(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

const webServerEnv = compactEnv({
  ADMIN_INVITE_CODE: process.env.ADMIN_INVITE_CODE ?? "PW-ADMIN-2026",
  API_TEST_SCOPE: process.env.API_TEST_SCOPE ?? "playwright",
  API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER: process.env.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER ?? "true",
  ALLOW_JSON_FALLBACK: process.env.ALLOW_JSON_FALLBACK,
  DATA_DIR: process.env.DATA_DIR ?? ".runtime-data/playwright",
  DATA_SEED_DIR: process.env.DATA_SEED_DIR,
  DATABASE_URL: process.env.DATABASE_URL,
  DB_SSL: process.env.DB_SSL,
  FILE_INLINE_CONTENT: process.env.FILE_INLINE_CONTENT ?? "false",
  FILE_OBJECT_STORAGE_ENABLED: process.env.FILE_OBJECT_STORAGE_ENABLED ?? "true",
  LIBRARY_INLINE_FILE_CONTENT: process.env.LIBRARY_INLINE_FILE_CONTENT ?? "false",
  LIBRARY_OBJECT_STORAGE_ENABLED: process.env.LIBRARY_OBJECT_STORAGE_ENABLED ?? "true",
  OBJECT_STORAGE_ROOT: process.env.OBJECT_STORAGE_ROOT ?? ".runtime-data/playwright-objects",
  READINESS_PROBE_TOKEN: process.env.READINESS_PROBE_TOKEN,
  REQUIRE_DATABASE: process.env.REQUIRE_DATABASE,
  RUNTIME_GUARDRAILS_ENFORCE: process.env.RUNTIME_GUARDRAILS_ENFORCE ?? (IS_PRODUCTION_LIKE ? "true" : "false"),
  SCHOOL_ADMIN_INVITE_CODE: process.env.SCHOOL_ADMIN_INVITE_CODE ?? "PW-SCHOOL-2026",
  TEACHER_INVITE_CODES: process.env.TEACHER_INVITE_CODES ?? "PW-TEACH-2026"
});

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["line"]] : [["line"]],
  projects: [
    {
      name: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "true" ? "chrome-smoke" : "chromium-smoke",
      use:
        process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "true"
          ? { browserName: "chromium", channel: "chrome" }
          : { browserName: "chromium" }
    }
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command:
      PLAYWRIGHT_SERVER_MODE === "dev"
        ? `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`
        : `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120_000,
    env: webServerEnv
  }
});
