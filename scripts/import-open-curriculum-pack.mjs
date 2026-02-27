import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const runtimeDir = path.resolve(rootDir, process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(rootDir, process.env.DATA_SEED_DIR ?? "data");

const defaultPackPath = path.resolve(rootDir, "docs/chinese-open-curriculum-pack.json");
const packPath = process.argv[2] ? path.resolve(rootDir, process.argv[2]) : defaultPackPath;

const ALLOWED_SUBJECTS = new Set([
  "math",
  "chinese",
  "english",
  "science",
  "physics",
  "chemistry",
  "biology",
  "history",
  "geography",
  "politics"
]);

function readJsonFromDir(dir, fileName, fallback) {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function readJson(fileName, fallback) {
  const runtimeFile = path.join(runtimeDir, fileName);
  if (fs.existsSync(runtimeFile)) {
    return readJsonFromDir(runtimeDir, fileName, fallback);
  }
  return readJsonFromDir(seedDir, fileName, fallback);
}

function writeRuntimeJson(fileName, data) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, fileName), JSON.stringify(data, null, 2));
}

function normalizeContentType(value) {
  return value === "courseware" || value === "lesson_plan" || value === "textbook"
    ? value
    : "textbook";
}

function normalizeSourceType(value) {
  return value === "file" || value === "link" || value === "text" ? value : "text";
}

function normalizeAccessScope(value) {
  return value === "class" ? "class" : "global";
}

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  const next = [];
  const seen = new Set();
  for (const raw of values) {
    const value = trim(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }
  return next;
}

function makeDedupeKey(item) {
  return [
    trim(item.title).toLowerCase(),
    trim(item.subject),
    trim(item.grade),
    normalizeContentType(item.contentType),
    normalizeSourceType(item.sourceType),
    trim(item.linkUrl).toLowerCase(),
    trim(item.fileName).toLowerCase(),
    trim(item.textContent).slice(0, 128)
  ].join("|");
}

if (!fs.existsSync(packPath)) {
  console.error(`Pack file not found: ${packPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(packPath, "utf-8"));
const textbooks = Array.isArray(payload?.textbooks) ? payload.textbooks : [];

if (!textbooks.length) {
  console.error("No textbooks found in pack.");
  process.exit(1);
}

const users = readJson("users.json", []);
const adminUser = users.find((item) => item?.role === "admin");
if (!adminUser?.id) {
  console.error("No admin user found in users.json");
  process.exit(1);
}

const existing = readJson("learning-library-items.json", []);
const dedupe = new Set(existing.map((item) => makeDedupeKey(item)));

let created = 0;
let skipped = 0;
const failed = [];

for (const [index, item] of textbooks.entries()) {
  const title = trim(item?.title);
  const subject = trim(item?.subject);
  const grade = trim(item?.grade);

  if (!title || !subject || !grade) {
    failed.push({ index, reason: "missing fields" });
    continue;
  }

  if (!ALLOWED_SUBJECTS.has(subject)) {
    failed.push({ index, reason: "invalid subject" });
    continue;
  }

  const sourceType = normalizeSourceType(trim(item?.sourceType));
  const contentType = normalizeContentType(trim(item?.contentType));

  if (sourceType === "link" && !trim(item?.linkUrl)) {
    failed.push({ index, reason: "missing link" });
    continue;
  }
  if (sourceType === "file" && !trim(item?.contentBase64)) {
    failed.push({ index, reason: "missing file content" });
    continue;
  }
  if (sourceType === "text" && !trim(item?.textContent)) {
    failed.push({ index, reason: "missing text content" });
    continue;
  }

  const key = makeDedupeKey(item);
  if (dedupe.has(key)) {
    skipped += 1;
    continue;
  }

  const now = new Date().toISOString();
  const next = {
    id: `lib-${crypto.randomBytes(8).toString("hex")}`,
    title,
    description: trim(item?.description) || undefined,
    contentType,
    subject,
    grade,
    ownerRole: "admin",
    ownerId: adminUser.id,
    classId: trim(item?.classId) || undefined,
    accessScope: normalizeAccessScope(trim(item?.accessScope)),
    sourceType,
    fileName: trim(item?.fileName) || undefined,
    mimeType: trim(item?.mimeType) || undefined,
    size: Number.isFinite(Number(item?.size)) ? Number(item.size) : undefined,
    contentBase64: trim(item?.contentBase64) || undefined,
    linkUrl: trim(item?.linkUrl) || undefined,
    textContent: item?.textContent,
    knowledgePointIds: uniqueStrings(item?.knowledgePointIds),
    extractedKnowledgePoints: [],
    generatedByAi: false,
    status: "published",
    shareToken: undefined,
    createdAt: now,
    updatedAt: now
  };

  existing.unshift(next);
  dedupe.add(key);
  created += 1;
}

writeRuntimeJson("learning-library-items.json", existing);

const summary = {
  packPath,
  total: textbooks.length,
  created,
  skipped,
  failed: failed.length,
  totalAfterImport: existing.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) {
  console.log("failedDetails:");
  console.log(JSON.stringify(failed.slice(0, 20), null, 2));
}
