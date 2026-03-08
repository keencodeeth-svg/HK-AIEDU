import fs from "fs";
import path from "path";
import { assertDatabaseEnabled } from "./db";

const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");

function assertJsonStorageAllowed(fileName: string) {
  assertDatabaseEnabled(`json storage fallback (${fileName})`);
}

function readFile<T>(dir: string, fileName: string, fallback: T): T {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function readJson<T>(fileName: string, fallback: T): T {
  assertJsonStorageAllowed(fileName);

  try {
    const runtimeFile = path.join(runtimeDir, fileName);
    if (fs.existsSync(runtimeFile)) {
      return readFile(runtimeDir, fileName, fallback);
    }

    return readFile(seedDir, fileName, fallback);
  } catch {
    return fallback;
  }
}

export function writeJson<T>(fileName: string, data: T) {
  assertJsonStorageAllowed(fileName);

  const filePath = path.join(runtimeDir, fileName);
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
