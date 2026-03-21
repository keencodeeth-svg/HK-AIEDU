import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("README documents the supported local demo and strict dev entrypoints", () => {
  const readmePath = path.join(process.cwd(), "README.md");
  const readme = fs.readFileSync(readmePath, "utf-8");

  assert.match(readme, /### 7\.1 本地启动（Local Demo \/ JSON 模式）/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /API_TEST_SCOPE=local-dev/);
  assert.match(readme, /npm run dev:strict/);
  assert.match(readme, /npm run verify:local-dev/);
  assert.match(readme, /以下账号默认可用于 `npm run dev` 的 local demo\/dev 启动/);
});
