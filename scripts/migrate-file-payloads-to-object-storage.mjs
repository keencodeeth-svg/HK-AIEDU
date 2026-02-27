import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split("\n")) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith("#")) continue;
    const equalIndex = cleaned.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = cleaned.slice(0, equalIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = cleaned.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseBooleanEnvValue(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  return null;
}

function envBoolean(key, defaultValue) {
  const parsed = parseBooleanEnvValue(process.env[key]);
  if (parsed === null) return defaultValue;
  return parsed;
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run")
  };
}

function sanitizeKeySegment(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function getObjectStorageRoot() {
  const configured = process.env.OBJECT_STORAGE_ROOT?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), ".runtime-data", "objects");
}

function buildObjectKey({ namespace, keyHint }) {
  const date = new Date().toISOString().slice(0, 10);
  const random = crypto.randomBytes(10).toString("hex");
  const safeNamespace = sanitizeKeySegment(namespace || "default") || "default";
  const safeHint = sanitizeKeySegment(keyHint || "file") || "file";
  return `${safeNamespace}/${date}/${random}-${safeHint}`;
}

async function putBase64Object({ namespace, base64, keyHint, dryRun }) {
  const key = buildObjectKey({ namespace, keyHint });
  const buffer = Buffer.from(base64, "base64");
  if (!dryRun) {
    const filePath = path.join(getObjectStorageRoot(), key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, buffer);
  }
  return {
    provider: "local",
    key,
    size: buffer.length
  };
}

function getRuntimeDataDir() {
  return path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
}

function getSeedDataDir() {
  return path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");
}

function resolveJsonReadPath(fileName) {
  const runtimePath = path.join(getRuntimeDataDir(), fileName);
  if (fs.existsSync(runtimePath)) return runtimePath;
  const seedPath = path.join(getSeedDataDir(), fileName);
  if (fs.existsSync(seedPath)) return seedPath;
  return null;
}

function readJsonArray(fileName) {
  const filePath = resolveJsonReadPath(fileName);
  if (!filePath) {
    return {
      filePath: null,
      data: []
    };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(raw)) {
    throw new Error(`${fileName} data format invalid, expected array`);
  }
  return {
    filePath,
    data: raw
  };
}

function writeRuntimeJson(fileName, data) {
  const runtimeDir = getRuntimeDataDir();
  fs.mkdirSync(runtimeDir, { recursive: true });
  const runtimeFilePath = path.join(runtimeDir, fileName);
  fs.writeFileSync(runtimeFilePath, JSON.stringify(data, null, 2), "utf-8");
  return runtimeFilePath;
}

async function migrateRows(rows, config) {
  const {
    namespace,
    keepInline,
    dryRun,
    toBase64,
    getStorageKey,
    getKeyHint,
    applyUpdate
  } = config;
  const stats = {
    scanned: rows.length,
    migrated: 0,
    skippedNoContent: 0,
    skippedHasStorageKey: 0,
    errors: 0
  };

  for (const row of rows) {
    const storageKey = String(getStorageKey(row) ?? "").trim();
    if (storageKey) {
      stats.skippedHasStorageKey += 1;
      continue;
    }

    const contentBase64 = String(toBase64(row) ?? "").trim();
    if (!contentBase64) {
      stats.skippedNoContent += 1;
      continue;
    }

    try {
      const stored = await putBase64Object({
        namespace,
        base64: contentBase64,
        keyHint: getKeyHint(row),
        dryRun
      });
      await applyUpdate(row, stored, keepInline, dryRun);
      stats.migrated += 1;
    } catch (error) {
      stats.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${namespace}] row migration failed: ${message}`);
    }
  }

  return stats;
}

function printStats(scope, stats) {
  console.log(
    `${scope}: scanned=${stats.scanned}, migrated=${stats.migrated}, skippedNoContent=${stats.skippedNoContent}, skippedHasStorageKey=${stats.skippedHasStorageKey}, errors=${stats.errors}`
  );
}

async function migrateDatabase(dryRun) {
  const keepInlineLibrary = envBoolean("LIBRARY_INLINE_FILE_CONTENT", false);
  const keepInlineFile = envBoolean("FILE_INLINE_CONTENT", false);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  const client = await pool.connect();

  try {
    const summaries = {};

    const libraryRows = (
      await client.query(
        `SELECT id, title, file_name, source_type, content_base64, content_storage_key
         FROM learning_library_items
         WHERE source_type = 'file'`
      )
    ).rows;
    summaries.learning_library_items = await migrateRows(libraryRows, {
      namespace: "learning-library",
      keepInline: keepInlineLibrary,
      dryRun,
      toBase64: (row) => row.content_base64,
      getStorageKey: (row) => row.content_storage_key,
      getKeyHint: (row) => row.file_name || row.title || row.id,
      applyUpdate: async (row, stored, keepInline, dryRunMode) => {
        if (dryRunMode) return;
        await client.query(
          `UPDATE learning_library_items
           SET content_storage_provider = $2,
               content_storage_key = $3,
               content_base64 = CASE WHEN $4 THEN content_base64 ELSE NULL END,
               updated_at = now()
           WHERE id = $1`,
          [row.id, stored.provider, stored.key, keepInline]
        );
      }
    });

    const assignmentRows = (
      await client.query(
        `SELECT id, file_name, content_base64, content_storage_key
         FROM assignment_uploads`
      )
    ).rows;
    summaries.assignment_uploads = await migrateRows(assignmentRows, {
      namespace: "assignment-uploads",
      keepInline: keepInlineFile,
      dryRun,
      toBase64: (row) => row.content_base64,
      getStorageKey: (row) => row.content_storage_key,
      getKeyHint: (row) => row.file_name || row.id,
      applyUpdate: async (row, stored, keepInline, dryRunMode) => {
        if (dryRunMode) return;
        await client.query(
          `UPDATE assignment_uploads
           SET content_storage_provider = $2,
               content_storage_key = $3,
               content_base64 = CASE WHEN $4 THEN content_base64 ELSE NULL END
           WHERE id = $1`,
          [row.id, stored.provider, stored.key, keepInline]
        );
      }
    });

    const moduleRows = (
      await client.query(
        `SELECT id, title, file_name, resource_type, content_base64, content_storage_key
         FROM module_resources
         WHERE resource_type = 'file'`
      )
    ).rows;
    summaries.module_resources = await migrateRows(moduleRows, {
      namespace: "module-resources",
      keepInline: keepInlineFile,
      dryRun,
      toBase64: (row) => row.content_base64,
      getStorageKey: (row) => row.content_storage_key,
      getKeyHint: (row) => row.file_name || row.title || row.id,
      applyUpdate: async (row, stored, keepInline, dryRunMode) => {
        if (dryRunMode) return;
        await client.query(
          `UPDATE module_resources
           SET content_storage_provider = $2,
               content_storage_key = $3,
               content_base64 = CASE WHEN $4 THEN content_base64 ELSE NULL END
           WHERE id = $1`,
          [row.id, stored.provider, stored.key, keepInline]
        );
      }
    });

    const courseRows = (
      await client.query(
        `SELECT id, title, file_name, resource_type, content_base64, content_storage_key
         FROM course_files
         WHERE resource_type = 'file'`
      )
    ).rows;
    summaries.course_files = await migrateRows(courseRows, {
      namespace: "course-files",
      keepInline: keepInlineFile,
      dryRun,
      toBase64: (row) => row.content_base64,
      getStorageKey: (row) => row.content_storage_key,
      getKeyHint: (row) => row.file_name || row.title || row.id,
      applyUpdate: async (row, stored, keepInline, dryRunMode) => {
        if (dryRunMode) return;
        await client.query(
          `UPDATE course_files
           SET content_storage_provider = $2,
               content_storage_key = $3,
               content_base64 = CASE WHEN $4 THEN content_base64 ELSE NULL END
           WHERE id = $1`,
          [row.id, stored.provider, stored.key, keepInline]
        );
      }
    });

    return summaries;
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrateJson(dryRun) {
  const keepInlineLibrary = envBoolean("LIBRARY_INLINE_FILE_CONTENT", false);
  const keepInlineFile = envBoolean("FILE_INLINE_CONTENT", false);
  const summaries = {};

  const library = readJsonArray("learning-library-items.json");
  let libraryMutated = false;
  summaries.learning_library_items = await migrateRows(library.data, {
    namespace: "learning-library",
    keepInline: keepInlineLibrary,
    dryRun,
    toBase64: (row) => row.contentBase64,
    getStorageKey: (row) => row.contentStorageKey,
    getKeyHint: (row) => row.fileName || row.title || row.id,
    applyUpdate: async (row, stored, keepInline, dryRunMode) => {
      if (dryRunMode) return;
      row.contentStorageProvider = stored.provider;
      row.contentStorageKey = stored.key;
      if (!keepInline) {
        row.contentBase64 = undefined;
      }
      row.updatedAt = new Date().toISOString();
      libraryMutated = true;
    }
  });
  if (!dryRun && libraryMutated) {
    writeRuntimeJson("learning-library-items.json", library.data);
  }

  const uploads = readJsonArray("assignment-uploads.json");
  let uploadsMutated = false;
  summaries.assignment_uploads = await migrateRows(uploads.data, {
    namespace: "assignment-uploads",
    keepInline: keepInlineFile,
    dryRun,
    toBase64: (row) => row.contentBase64,
    getStorageKey: (row) => row.contentStorageKey,
    getKeyHint: (row) => row.fileName || row.id,
    applyUpdate: async (row, stored, keepInline, dryRunMode) => {
      if (dryRunMode) return;
      row.contentStorageProvider = stored.provider;
      row.contentStorageKey = stored.key;
      if (!keepInline) {
        row.contentBase64 = "";
      }
      uploadsMutated = true;
    }
  });
  if (!dryRun && uploadsMutated) {
    writeRuntimeJson("assignment-uploads.json", uploads.data);
  }

  const moduleResources = readJsonArray("module-resources.json");
  let moduleMutated = false;
  summaries.module_resources = await migrateRows(
    moduleResources.data.filter((row) => row.resourceType === "file"),
    {
      namespace: "module-resources",
      keepInline: keepInlineFile,
      dryRun,
      toBase64: (row) => row.contentBase64,
      getStorageKey: (row) => row.contentStorageKey,
      getKeyHint: (row) => row.fileName || row.title || row.id,
      applyUpdate: async (row, stored, keepInline, dryRunMode) => {
        if (dryRunMode) return;
        row.contentStorageProvider = stored.provider;
        row.contentStorageKey = stored.key;
        if (!keepInline) {
          row.contentBase64 = undefined;
        }
        moduleMutated = true;
      }
    }
  );
  if (!dryRun && moduleMutated) {
    writeRuntimeJson("module-resources.json", moduleResources.data);
  }

  const courseFiles = readJsonArray("course-files.json");
  let courseMutated = false;
  summaries.course_files = await migrateRows(
    courseFiles.data.filter((row) => row.resourceType === "file"),
    {
      namespace: "course-files",
      keepInline: keepInlineFile,
      dryRun,
      toBase64: (row) => row.contentBase64,
      getStorageKey: (row) => row.contentStorageKey,
      getKeyHint: (row) => row.fileName || row.title || row.id,
      applyUpdate: async (row, stored, keepInline, dryRunMode) => {
        if (dryRunMode) return;
        row.contentStorageProvider = stored.provider;
        row.contentStorageKey = stored.key;
        if (!keepInline) {
          row.contentBase64 = undefined;
        }
        courseMutated = true;
      }
    }
  );
  if (!dryRun && courseMutated) {
    writeRuntimeJson("course-files.json", courseFiles.data);
  }

  return summaries;
}

function printModeHeader(dryRun) {
  console.log(`Mode: ${process.env.DATABASE_URL ? "database" : "json-fallback"}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Object storage root: ${getObjectStorageRoot()}`);
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const { dryRun } = parseArgs(process.argv);
  printModeHeader(dryRun);

  const summaries = process.env.DATABASE_URL ? await migrateDatabase(dryRun) : await migrateJson(dryRun);
  printStats("learning_library_items", summaries.learning_library_items);
  printStats("assignment_uploads", summaries.assignment_uploads);
  printStats("module_resources", summaries.module_resources);
  printStats("course_files", summaries.course_files);

  const totals = Object.values(summaries).reduce(
    (acc, item) => {
      acc.scanned += item.scanned;
      acc.migrated += item.migrated;
      acc.skippedNoContent += item.skippedNoContent;
      acc.skippedHasStorageKey += item.skippedHasStorageKey;
      acc.errors += item.errors;
      return acc;
    },
    { scanned: 0, migrated: 0, skippedNoContent: 0, skippedHasStorageKey: 0, errors: 0 }
  );
  printStats("total", totals);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
