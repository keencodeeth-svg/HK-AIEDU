import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

type PackageJson = {
  scripts?: Record<string, string | undefined>;
};

test("dev scripts preserve local json-mode and strict dev entrypoints", () => {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageJson;

  assert.equal(packageJson.scripts?.dev, "API_TEST_SCOPE=local-dev next dev");
  assert.equal(packageJson.scripts?.["dev:strict"], "next dev");
  assert.equal(
    packageJson.scripts?.["test:local-dev"],
    "API_TEST_SCOPE=local-dev API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER=true API_TEST_SERVER_MODE=dev API_TEST_FALLBACK_TO_DEV=0 node scripts/test-api-routes.mjs"
  );
  assert.equal(
    packageJson.scripts?.["test:browser:local-dev"],
    "PLAYWRIGHT_SERVER_MODE=dev API_TEST_SCOPE=local-dev playwright test tests/browser/local-dev.spec.ts"
  );
  assert.equal(
    packageJson.scripts?.["verify:local-dev"],
    "npm run test:local-dev && npm run test:browser:local-dev"
  );
});
