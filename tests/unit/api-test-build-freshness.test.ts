import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";

const tempRoots: string[] = [];

function loadBuildFreshnessModule() {
  const moduleUrl = pathToFileURL(path.join(process.cwd(), "scripts/api-test/build-freshness.mjs")).href;
  const importer = new Function("moduleUrl", "return import(moduleUrl);") as unknown as (
    moduleUrl: string
  ) => Promise<any>;
  return importer(moduleUrl);
}

function createTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "api-build-freshness-"));
  tempRoots.push(root);
  return root;
}

function writeFile(root: string, relativePath: string, content = "test") {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function setMtime(filePath: string, iso: string) {
  const date = new Date(iso);
  fs.utimesSync(filePath, date, date);
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) continue;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("getApiTestBuildFreshness reports missing build marker", async () => {
  const { createApiTestBuildFreshnessError, getApiTestBuildFreshness } = await loadBuildFreshnessModule();
  const root = createTempRoot();
  writeFile(root, "app/student/page.tsx");

  const freshness = getApiTestBuildFreshness(root);

  assert.equal(freshness.ok, false);
  assert.equal(freshness.reason, "missing_build");
  const error = createApiTestBuildFreshnessError(root, freshness);
  assert.match(error.message, /npm run build/);
});

test("getApiTestBuildFreshness reports stale build when source is newer than BUILD_ID", async () => {
  const { createApiTestBuildFreshnessError, getApiTestBuildFreshness } = await loadBuildFreshnessModule();
  const root = createTempRoot();
  const sourceFile = writeFile(root, "app/api/student/today-tasks/route.ts");
  const buildMarker = writeFile(root, ".next/BUILD_ID", "build-id");

  setMtime(buildMarker, "2026-03-12T08:00:00.000Z");
  setMtime(sourceFile, "2026-03-12T08:05:00.000Z");

  const freshness = getApiTestBuildFreshness(root);

  assert.equal(freshness.ok, false);
  assert.equal(freshness.reason, "stale_build");
  assert.equal(freshness.latestSourcePath, "app/api/student/today-tasks/route.ts");
  const error = createApiTestBuildFreshnessError(root, freshness);
  assert.match(error.message, /stale production build/);
  assert.match(error.message, /today-tasks\/route\.ts/);
});

test("getApiTestBuildFreshness accepts fresh build when BUILD_ID is newest", async () => {
  const { assertApiTestBuildFreshness, getApiTestBuildFreshness } = await loadBuildFreshnessModule();
  const root = createTempRoot();
  const sourceFile = writeFile(root, "lib/progress.ts");
  const buildMarker = writeFile(root, ".next/BUILD_ID", "build-id");

  setMtime(sourceFile, "2026-03-12T08:00:00.000Z");
  setMtime(buildMarker, "2026-03-12T08:10:00.000Z");

  const freshness = getApiTestBuildFreshness(root);

  assert.equal(freshness.ok, true);
  assert.equal(freshness.reason, "fresh_build");
  assert.equal(freshness.latestSourcePath, "lib/progress.ts");
  assert.doesNotThrow(() => assertApiTestBuildFreshness(root));
});
