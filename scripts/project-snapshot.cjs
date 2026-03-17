const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".runtime-data",
  ".tmp-unit-tests",
  "node_modules",
  "test-results"
]);

const TEST_DECLARATION_PATTERN = /^\s*test\s*\(\s*["'`]/gm;

const PROJECT_SNAPSHOT_DOC_TARGETS = [
  {
    filePath: "docs/project-readiness-index.md",
    assertions: [
      {
        description: "current size snapshot",
        pattern:
          /当前规模：`(?<pageFileCount>\d+)` 个页面、`(?<apiRouteCount>\d+)` 个 API 路由、`(?<unitTestFileCount>\d+)` 个单测文件/u
      },
      {
        description: "current automation snapshot",
        pattern:
          /`test:unit` 当前为 `(?<unitTestCaseCount>\d+)` 条用例；`(?<browserSpecFileCount>\d+)` 个浏览器 smoke 文件，内含 `(?<browserSmokeCaseCount>\d+)` 条关键流程 smoke/u
      },
      {
        description: "current data snapshot",
        pattern:
          /当前工作树 `data\/` 目录下还有 `(?<dataJsonCount>\d+)` 个 JSON 文件/u
      }
    ]
  },
  {
    filePath: "docs/p0-productization-checklist.md",
    assertions: [
      {
        description: "baseline size snapshot",
        pattern:
          /当前规模：`(?<pageFileCount>\d+)` 个页面、`(?<apiRouteCount>\d+)` 个 API 路由、`(?<unitTestFileCount>\d+)` 个单测文件/u
      },
      {
        description: "baseline browser snapshot",
        pattern:
          /当前浏览器回归：`(?<browserSpecFileCount>\d+)` 个 smoke 文件、`(?<browserSmokeCaseCount>\d+)` 条关键流程 smoke/u
      },
      {
        description: "baseline unit test snapshot",
        pattern:
          /当前单测基线：`test:unit` 为 `(?<unitTestCaseCount>\d+)` 条用例/u
      },
      {
        description: "baseline data snapshot",
        pattern:
          /当前工作树 `data\/` 目录下还有 `(?<dataJsonCount>\d+)` 个 JSON 文件/u
      }
    ]
  },
  {
    filePath: "docs/api-domain-migration.md",
    assertions: [
      {
        description: "route factory migration count",
        pattern: /`create\*Route` 路由：`(?<apiRouteCount>\d+)`/u
      }
    ]
  }
];

function walkFiles(targetDir, predicate, options = {}) {
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const ignoredDirs = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      files.push(...walkFiles(nextPath, predicate, options));
      continue;
    }
    if (entry.isFile() && predicate(nextPath)) {
      files.push(nextPath);
    }
  }

  return files.sort();
}

function listTopLevelFiles(targetDir, predicate) {
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  return fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(targetDir, entry.name))
    .sort();
}

function countPatternInFiles(filePaths, pattern) {
  return filePaths.reduce((sum, filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    const matches = source.match(new RegExp(pattern.source, pattern.flags));
    return sum + (matches ? matches.length : 0);
  }, 0);
}

function normalizeSnapshot(snapshot) {
  return {
    pageFileCount: Number(snapshot.pageFileCount ?? 0),
    apiRouteCount: Number(snapshot.apiRouteCount ?? 0),
    unitTestFileCount: Number(snapshot.unitTestFileCount ?? 0),
    unitTestCaseCount: Number(snapshot.unitTestCaseCount ?? 0),
    browserSpecFileCount: Number(snapshot.browserSpecFileCount ?? 0),
    browserSmokeCaseCount: Number(snapshot.browserSmokeCaseCount ?? 0),
    dataJsonCount: Number(snapshot.dataJsonCount ?? 0)
  };
}

function collectProjectSnapshot(rootDir = process.cwd()) {
  const pageFiles = walkFiles(path.join(rootDir, "app"), (filePath) => filePath.endsWith(`${path.sep}page.tsx`));
  const apiRouteFiles = walkFiles(path.join(rootDir, "app", "api"), (filePath) => filePath.endsWith(`${path.sep}route.ts`));
  const unitTestFiles = walkFiles(path.join(rootDir, "tests", "unit"), (filePath) => filePath.endsWith(".test.ts"));
  const browserSpecFiles = walkFiles(path.join(rootDir, "tests", "browser"), (filePath) => filePath.endsWith(".spec.ts"));
  const dataJsonFiles = listTopLevelFiles(path.join(rootDir, "data"), (fileName) => fileName.endsWith(".json"));

  return normalizeSnapshot({
    pageFileCount: pageFiles.length,
    apiRouteCount: apiRouteFiles.length,
    unitTestFileCount: unitTestFiles.length,
    unitTestCaseCount: countPatternInFiles(unitTestFiles, TEST_DECLARATION_PATTERN),
    browserSpecFileCount: browserSpecFiles.length,
    browserSmokeCaseCount: countPatternInFiles(browserSpecFiles, TEST_DECLARATION_PATTERN),
    dataJsonCount: dataJsonFiles.length
  });
}

function formatProjectSnapshot(snapshot) {
  return [
    `pages: ${snapshot.pageFileCount}`,
    `apiRoutes: ${snapshot.apiRouteCount}`,
    `unitTestFiles: ${snapshot.unitTestFileCount}`,
    `unitTestCases: ${snapshot.unitTestCaseCount}`,
    `browserSpecFiles: ${snapshot.browserSpecFileCount}`,
    `browserSmokeCases: ${snapshot.browserSmokeCaseCount}`,
    `dataJsonFiles: ${snapshot.dataJsonCount}`
  ].join("\n");
}

function validateProjectSnapshotDocs(
  rootDir = process.cwd(),
  snapshot = collectProjectSnapshot(rootDir),
  docTargets = PROJECT_SNAPSHOT_DOC_TARGETS
) {
  const expectedSnapshot = normalizeSnapshot(snapshot);
  const failures = [];

  for (const target of docTargets) {
    const fullPath = path.join(rootDir, target.filePath);
    if (!fs.existsSync(fullPath)) {
      failures.push({
        filePath: target.filePath,
        description: "file missing",
        reason: `Missing ${target.filePath}`
      });
      continue;
    }

    const source = fs.readFileSync(fullPath, "utf8");
    for (const assertion of target.assertions) {
      const match = source.match(assertion.pattern);
      if (!match?.groups) {
        failures.push({
          filePath: target.filePath,
          description: assertion.description,
          reason: `Could not locate snapshot assertion "${assertion.description}" in ${target.filePath}`
        });
        continue;
      }

      for (const [key, rawActual] of Object.entries(match.groups)) {
        const actual = Number(rawActual);
        const expected = expectedSnapshot[key];
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
          failures.push({
            filePath: target.filePath,
            description: assertion.description,
            reason: `Invalid numeric snapshot for ${key} in ${target.filePath}`
          });
          continue;
        }
        if (actual !== expected) {
          failures.push({
            filePath: target.filePath,
            description: assertion.description,
            reason: `${target.filePath} records ${key}=${actual}, expected ${expected}`
          });
        }
      }
    }
  }

  return {
    ok: failures.length === 0,
    snapshot: expectedSnapshot,
    failures
  };
}

module.exports = {
  PROJECT_SNAPSHOT_DOC_TARGETS,
  collectProjectSnapshot,
  formatProjectSnapshot,
  validateProjectSnapshotDocs
};
