import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const outDir = path.join(rootDir, ".tmp-unit-tests");
const tscCliPath = path.join(rootDir, "node_modules", "typescript", "lib", "tsc.js");

function collectTestFiles(startDir) {
  if (!fs.existsSync(startDir)) return [];
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(nextPath));
      continue;
    }
    if (entry.isFile() && nextPath.endsWith(".test.js")) {
      files.push(nextPath);
    }
  }
  return files.sort();
}

function run() {
  fs.rmSync(outDir, { recursive: true, force: true });

  execFileSync(process.execPath, [tscCliPath, "-p", "tsconfig.unit.json", "--pretty", "false"], {
    cwd: rootDir,
    stdio: "inherit"
  });

  const testFiles = collectTestFiles(path.join(outDir, "tests", "unit"));
  if (!testFiles.length) {
    throw new Error("No compiled unit tests found under .tmp-unit-tests/tests/unit");
  }

  execFileSync(process.execPath, ["--test", ...testFiles], {
    cwd: rootDir,
    stdio: "inherit"
  });
}

try {
  run();
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
