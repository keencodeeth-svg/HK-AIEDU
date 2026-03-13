import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

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
    command: `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120_000,
    env: {
      ADMIN_INVITE_CODE: "PW-ADMIN-2026",
      API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER: "true",
      DATA_DIR: ".runtime-data/playwright",
      OBJECT_STORAGE_ROOT: ".runtime-data/playwright-objects",
      RUNTIME_GUARDRAILS_ENFORCE: "false",
      TEACHER_INVITE_CODES: "PW-TEACH-2026"
    }
  }
});
