import fs from "fs";
import path from "path";
import { assertDatabaseEnabled, isDbEnabled } from "./db";
import {
  assertRuntimeGuardrails,
  requiresDatabaseBackedState,
  shouldEnforceRuntimeGuardrails,
  warnOnJsonFallbackUsage
} from "./runtime-guardrails";

const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");
const fileQueues = new Map<string, Promise<void>>();

function assertJsonStorageAllowed(fileName: string) {
  assertRuntimeGuardrails();
  if (requiresDatabaseBackedState(fileName)) {
    if (shouldEnforceRuntimeGuardrails()) {
      throw new Error(
        `[runtime-guardrails] ${fileName} cannot use JSON storage when runtime guardrails are enforced. Use the database-backed store for this state before serving traffic.`
      );
    }
    if (!isDbEnabled()) {
      throw new Error(
        `[runtime-guardrails] ${fileName} must use database-backed storage when runtime guardrails are enforced. Configure DATABASE_URL and run db:migrate before serving traffic.`
      );
    }
  }
  if (!requiresDatabaseBackedState(fileName) && !isDbEnabled() && shouldEnforceRuntimeGuardrails()) {
    throw new Error(
      `[runtime-guardrails] ${fileName} must use database-backed storage when runtime guardrails are enforced. Configure DATABASE_URL and run db:migrate before serving traffic.`
    );
  }
  warnOnJsonFallbackUsage(fileName);
  assertDatabaseEnabled(`json storage fallback (${fileName})`);
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function getRuntimeFilePath(fileName: string) {
  return path.join(runtimeDir, fileName);
}

function getRuntimeBackupPath(fileName: string) {
  return `${getRuntimeFilePath(fileName)}.bak`;
}

function readFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return cloneValue(fallback);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function writeJsonAtomic<T>(fileName: string, data: T) {
  const filePath = getRuntimeFilePath(fileName);
  const backupPath = getRuntimeBackupPath(fileName);
  fs.mkdirSync(runtimeDir, { recursive: true });

  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function recoverFromBackup<T>(fileName: string, fallback: T): T {
  const backupPath = getRuntimeBackupPath(fileName);
  if (!fs.existsSync(backupPath)) {
    return cloneValue(fallback);
  }

  try {
    const recovered = readFile<T>(backupPath, fallback);
    writeJsonAtomic(fileName, recovered);
    return recovered;
  } catch {
    return cloneValue(fallback);
  }
}

function readJsonFromDisk<T>(fileName: string, fallback: T): T {
  const runtimeFile = getRuntimeFilePath(fileName);
  if (fs.existsSync(runtimeFile)) {
    try {
      return readFile(runtimeFile, fallback);
    } catch (error) {
      console.error(`[storage] failed to parse runtime JSON "${fileName}", recovering from backup`, error);
      return recoverFromBackup(fileName, fallback);
    }
  }

  return readFile(path.join(seedDir, fileName), fallback);
}

async function withJsonLocks<T>(fileNames: string[], operation: () => Promise<T> | T): Promise<T> {
  const unique = Array.from(new Set(fileNames)).sort();

  async function runWithLock(index: number): Promise<T> {
    if (index >= unique.length) {
      return operation();
    }

    const fileName = unique[index];
    const previous = fileQueues.get(fileName) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    fileQueues.set(
      fileName,
      previous.catch(() => undefined).then(() => current)
    );

    await previous.catch(() => undefined);

    try {
      return await runWithLock(index + 1);
    } finally {
      release();
      if (fileQueues.get(fileName) === current) {
        fileQueues.delete(fileName);
      }
    }
  }

  return runWithLock(0);
}

export function readJson<T>(fileName: string, fallback: T): T {
  assertJsonStorageAllowed(fileName);

  try {
    return readJsonFromDisk(fileName, fallback);
  } catch {
    return cloneValue(fallback);
  }
}

export function writeJson<T>(fileName: string, data: T) {
  assertJsonStorageAllowed(fileName);
  writeJsonAtomic(fileName, data);
}

export async function updateJson<T>(
  fileName: string,
  fallback: T,
  updater: (current: T) => T | Promise<T> | void | Promise<void>
) {
  assertJsonStorageAllowed(fileName);

  return withJsonLocks([fileName], async () => {
    const current = readJsonFromDisk(fileName, fallback);
    const result = await updater(current);
    const next = result === undefined ? current : result;
    writeJsonAtomic(fileName, next);
    return next;
  });
}

export async function mutateJson<T, TResult>(
  fileName: string,
  fallback: T,
  handler: (current: T) => { next?: T; result: TResult } | Promise<{ next?: T; result: TResult }>
) {
  assertJsonStorageAllowed(fileName);

  return withJsonLocks([fileName], async () => {
    const current = readJsonFromDisk(fileName, fallback);
    const { next, result } = await handler(current);
    writeJsonAtomic(fileName, next ?? current);
    return result;
  });
}

export async function transactJsonFiles<TState extends Record<string, unknown>, TResult>(
  files: { [K in keyof TState]: { fileName: string; fallback: TState[K] } },
  handler: (state: TState) => TResult | Promise<TResult>
) {
  const fileNames = Object.values(files).map((item) => item.fileName);
  fileNames.forEach((fileName) => assertJsonStorageAllowed(fileName));

  return withJsonLocks(fileNames, async () => {
    const state = {} as TState;

    (Object.keys(files) as Array<keyof TState>).forEach((key) => {
      const definition = files[key];
      state[key] = readJsonFromDisk(definition.fileName, definition.fallback);
    });

    const result = await handler(state);

    (Object.keys(files) as Array<keyof TState>).forEach((key) => {
      const definition = files[key];
      writeJsonAtomic(definition.fileName, state[key]);
    });

    return result;
  });
}
