import fs from "node:fs";
import path from "node:path";

const DEFAULT_TRACKED_PATHS = [
  "app",
  "components",
  "lib",
  "middleware.ts",
  "middleware.js",
  "middleware.mjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "package.json",
  "tsconfig.json"
];

const IGNORED_DIRS = new Set([".git", ".next", ".tmp-unit-tests", "node_modules"]);

function formatTimestamp(value) {
  return new Date(value).toISOString();
}

function walkLatestFile(targetPath, rootDir) {
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  const stat = fs.statSync(targetPath);
  const relativePath = path.relative(rootDir, targetPath) || path.basename(targetPath);

  if (stat.isFile()) {
    return {
      path: relativePath,
      mtimeMs: stat.mtimeMs
    };
  }

  if (!stat.isDirectory() || IGNORED_DIRS.has(path.basename(targetPath))) {
    return null;
  }

  let latest = null;
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const candidate = walkLatestFile(path.join(targetPath, entry.name), rootDir);
    if (!candidate) continue;
    if (!latest || candidate.mtimeMs > latest.mtimeMs) {
      latest = candidate;
    }
  }

  return latest;
}

export function getApiTestBuildFreshness(rootDir, options = {}) {
  const buildDirName = options.buildDirName ?? ".next";
  const trackedPaths = options.trackedPaths ?? DEFAULT_TRACKED_PATHS;
  const buildMarkerPath = path.join(rootDir, buildDirName, "BUILD_ID");

  if (!fs.existsSync(buildMarkerPath)) {
    return {
      ok: false,
      reason: "missing_build",
      buildMarkerPath: path.relative(rootDir, buildMarkerPath)
    };
  }

  const buildMarkerStat = fs.statSync(buildMarkerPath);
  let latestSource = null;

  for (const trackedPath of trackedPaths) {
    const candidate = walkLatestFile(path.join(rootDir, trackedPath), rootDir);
    if (!candidate) continue;
    if (!latestSource || candidate.mtimeMs > latestSource.mtimeMs) {
      latestSource = candidate;
    }
  }

  if (latestSource && latestSource.mtimeMs > buildMarkerStat.mtimeMs) {
    return {
      ok: false,
      reason: "stale_build",
      buildMarkerPath: path.relative(rootDir, buildMarkerPath),
      buildMarkerMtimeMs: buildMarkerStat.mtimeMs,
      latestSourcePath: latestSource.path,
      latestSourceMtimeMs: latestSource.mtimeMs
    };
  }

  return {
    ok: true,
    reason: latestSource ? "fresh_build" : "no_tracked_sources",
    buildMarkerPath: path.relative(rootDir, buildMarkerPath),
    buildMarkerMtimeMs: buildMarkerStat.mtimeMs,
    latestSourcePath: latestSource?.path ?? null,
    latestSourceMtimeMs: latestSource?.mtimeMs ?? null
  };
}

export function createApiTestBuildFreshnessError(rootDir, freshness) {
  if (freshness.reason === "missing_build") {
    return new Error(
      `API start-mode tests require a production build. Missing ${freshness.buildMarkerPath}. Run \`npm run build\` before \`npm run test:api\`.`
    );
  }

  if (freshness.reason === "stale_build") {
    return new Error(
      `API start-mode tests detected a stale production build. Latest source change: ${freshness.latestSourcePath} (${formatTimestamp(
        freshness.latestSourceMtimeMs
      )}); build marker: ${freshness.buildMarkerPath} (${formatTimestamp(
        freshness.buildMarkerMtimeMs
      )}). Run \`npm run build\` before \`npm run test:api\`.`
    );
  }

  return new Error(`Unknown API build freshness state for ${rootDir}.`);
}

export function assertApiTestBuildFreshness(rootDir, options = {}) {
  const freshness = getApiTestBuildFreshness(rootDir, options);
  if (!freshness.ok) {
    throw createApiTestBuildFreshnessError(rootDir, freshness);
  }
  return freshness;
}
