import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

type ProjectSnapshot = {
  pageFileCount: number;
  apiRouteCount: number;
  unitTestFileCount: number;
  unitTestCaseCount: number;
  browserSpecFileCount: number;
  browserSmokeCaseCount: number;
  dataJsonCount: number;
};

type ProjectSnapshotDocTarget = {
  filePath: string;
  assertions: Array<{
    description: string;
    pattern: RegExp;
  }>;
};

type ProjectSnapshotValidationFailure = {
  filePath: string;
  description: string;
  reason: string;
};

type ProjectSnapshotModule = {
  PROJECT_SNAPSHOT_DOC_TARGETS: ProjectSnapshotDocTarget[];
  collectProjectSnapshot: (rootDir?: string) => ProjectSnapshot;
  validateProjectSnapshotDocs: (
    rootDir?: string,
    snapshot?: ProjectSnapshot,
    docTargets?: ProjectSnapshotDocTarget[]
  ) => {
    ok: boolean;
    snapshot: ProjectSnapshot;
    failures: ProjectSnapshotValidationFailure[];
  };
};

const tempDirs: string[] = [];

async function loadProjectSnapshotModule(): Promise<ProjectSnapshotModule> {
  return require(path.join(process.cwd(), "scripts", "project-snapshot.cjs")) as ProjectSnapshotModule;
}

function createTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hk-ai-edu-snapshot-"));
  tempDirs.push(root);
  return root;
}

function ensureFile(root: string, relativePath: string, content = "") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

test("collectProjectSnapshot counts structural repo facts and ignores non-test .test calls", async () => {
  const mod = await loadProjectSnapshotModule();
  const root = createTempRepo();

  ensureFile(root, "app/page.tsx", "export default function Page() { return null; }\n");
  ensureFile(root, "app/student/page.tsx", "export default function StudentPage() { return null; }\n");
  ensureFile(root, "app/api/health/route.ts", "export const GET = () => null;\n");
  ensureFile(root, "tests/unit/example.test.ts", "import { test } from 'node:test';\ntest('unit case', () => {});\n");
  ensureFile(
    root,
    "tests/browser/smoke.spec.ts",
    "import { test } from '@playwright/test';\nconst matched = pathPattern.test(actualPath);\ntest('smoke case', async () => {});\n"
  );
  ensureFile(root, "data/users.json", "{}\n");
  ensureFile(root, "data/questions.json", "{}\n");

  const snapshot = mod.collectProjectSnapshot(root);

  assert.deepEqual(snapshot, {
    pageFileCount: 2,
    apiRouteCount: 1,
    unitTestFileCount: 1,
    unitTestCaseCount: 1,
    browserSpecFileCount: 1,
    browserSmokeCaseCount: 1,
    dataJsonCount: 2
  });
});

test("validateProjectSnapshotDocs reports mismatched counts", async () => {
  const mod = await loadProjectSnapshotModule();
  const root = createTempRepo();

  ensureFile(root, "app/page.tsx", "export default function Page() { return null; }\n");
  ensureFile(root, "app/api/health/route.ts", "export const GET = () => null;\n");
  ensureFile(root, "tests/unit/example.test.ts", "import { test } from 'node:test';\ntest('unit case', () => {});\n");
  ensureFile(root, "tests/browser/smoke.spec.ts", "import { test } from '@playwright/test';\ntest('smoke case', async () => {});\n");
  ensureFile(root, "data/users.json", "{}\n");

  ensureFile(
    root,
    "docs/project-readiness-index.md",
    [
      "- 当前规模：`2` 个页面、`1` 个 API 路由、`1` 个单测文件。",
      "- 当前自动化：`test:unit` 当前为 `99` 条用例；`1` 个浏览器 smoke 文件，内含 `1` 条关键流程 smoke。",
      "- 当前剩余文件态：当前工作树 `data/` 目录下还有 `1` 个 JSON 文件。"
    ].join("\n")
  );

  const snapshot = mod.collectProjectSnapshot(root);
  const result = mod.validateProjectSnapshotDocs(root, snapshot, [
    {
      filePath: "docs/project-readiness-index.md",
      assertions: mod.PROJECT_SNAPSHOT_DOC_TARGETS[0].assertions
    }
  ]);

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.reason.includes("unitTestCaseCount=99, expected 1")));
  assert.ok(!result.failures.some((failure) => failure.reason.includes("dataJsonCount=1, expected 1")));
});
