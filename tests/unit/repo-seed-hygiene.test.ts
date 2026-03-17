import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { listHighFrequencyStateFiles } from "../../lib/runtime-guardrails";

test("repo seed data does not contain high-frequency runtime state files", () => {
  const seedDir = path.join(process.cwd(), "data");
  const existing = listHighFrequencyStateFiles().filter((fileName) => fs.existsSync(path.join(seedDir, fileName)));

  assert.deepEqual(existing, []);
});
