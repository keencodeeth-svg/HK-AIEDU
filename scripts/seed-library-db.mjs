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

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const DEFAULT_PACKS = [
  "docs/chinese-open-curriculum-pack.json",
  "docs/chinese-download-first-pack.json"
];

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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

const trim = (value) => (typeof value === "string" ? value.trim() : "");

function normalizeContentType(value) {
  if (value === "textbook" || value === "courseware" || value === "lesson_plan") {
    return value;
  }
  return "textbook";
}

function normalizeSourceType(value) {
  if (value === "file" || value === "link" || value === "text") {
    return value;
  }
  return "text";
}

function normalizeAccessScope(value) {
  return value === "class" ? "class" : "global";
}

function makeDedupeKey(input) {
  return [
    trim(input.title).toLowerCase(),
    trim(input.subject),
    trim(input.grade),
    normalizeContentType(trim(input.contentType)),
    normalizeSourceType(trim(input.sourceType)),
    normalizeAccessScope(trim(input.accessScope)),
    trim(input.classId),
    trim(input.linkUrl).toLowerCase(),
    trim(input.fileName).toLowerCase(),
    trim(input.textContent).slice(0, 128)
  ].join("|");
}

function readPack(packFilePath) {
  const raw = fs.readFileSync(packFilePath, "utf-8");
  const json = JSON.parse(raw);
  const textbooks = Array.isArray(json?.textbooks) ? json.textbooks : [];
  return textbooks.map((item, index) => ({ ...item, __index: index }));
}

const packArgs = process.argv.slice(2).filter(Boolean);
const packFiles = (packArgs.length ? packArgs : DEFAULT_PACKS).map((item) =>
  path.resolve(process.cwd(), item)
);

for (const filePath of packFiles) {
  if (!fs.existsSync(filePath)) {
    console.error(`Pack file not found: ${filePath}`);
    process.exit(1);
  }
}

const client = await pool.connect();

try {
  await client.query("BEGIN");

  const adminRow = await client.query(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC NULLS LAST LIMIT 1"
  );
  const adminId = adminRow.rows[0]?.id;
  if (!adminId) {
    throw new Error("No admin user found in users table. Please run seed:base first.");
  }

  const existingRows = await client.query(
    `SELECT title, subject, grade, content_type, source_type, access_scope, class_id, link_url, file_name, text_content
     FROM learning_library_items`
  );
  const seen = new Set(
    existingRows.rows.map((row) =>
      makeDedupeKey({
        title: row.title,
        subject: row.subject,
        grade: row.grade,
        contentType: row.content_type,
        sourceType: row.source_type,
        accessScope: row.access_scope,
        classId: row.class_id ?? "",
        linkUrl: row.link_url ?? "",
        fileName: row.file_name ?? "",
        textContent: row.text_content ?? ""
      })
    )
  );

  const summary = {
    packs: [],
    created: 0,
    skipped: 0,
    failed: 0
  };

  const failedDetails = [];

  for (const packFilePath of packFiles) {
    const textbooks = readPack(packFilePath);
    const itemSummary = {
      packPath: packFilePath,
      total: textbooks.length,
      created: 0,
      skipped: 0,
      failed: 0
    };

    for (const item of textbooks) {
      const title = trim(item.title);
      const subject = trim(item.subject);
      const grade = trim(item.grade);
      const contentType = normalizeContentType(trim(item.contentType));
      const sourceType = normalizeSourceType(trim(item.sourceType));
      const accessScope = normalizeAccessScope(trim(item.accessScope));
      const classId = trim(item.classId) || null;
      const linkUrl = trim(item.linkUrl) || null;
      const textContent = item.textContent ?? null;
      const fileName = trim(item.fileName) || null;
      const mimeType = trim(item.mimeType) || null;
      const contentBase64 = trim(item.contentBase64) || null;
      const size = Number.isFinite(Number(item.size)) ? Number(item.size) : null;

      if (!title || !subject || !grade) {
        itemSummary.failed += 1;
        summary.failed += 1;
        failedDetails.push({
          packPath: packFilePath,
          index: Number(item.__index ?? -1),
          reason: "missing fields"
        });
        continue;
      }

      if (!ALLOWED_SUBJECTS.has(subject)) {
        itemSummary.failed += 1;
        summary.failed += 1;
        failedDetails.push({
          packPath: packFilePath,
          index: Number(item.__index ?? -1),
          reason: "invalid subject"
        });
        continue;
      }

      if (sourceType === "link" && !linkUrl) {
        itemSummary.failed += 1;
        summary.failed += 1;
        failedDetails.push({
          packPath: packFilePath,
          index: Number(item.__index ?? -1),
          reason: "missing link"
        });
        continue;
      }
      if (sourceType === "text" && !trim(textContent ?? "")) {
        itemSummary.failed += 1;
        summary.failed += 1;
        failedDetails.push({
          packPath: packFilePath,
          index: Number(item.__index ?? -1),
          reason: "missing text content"
        });
        continue;
      }
      if (sourceType === "file" && !contentBase64) {
        itemSummary.failed += 1;
        summary.failed += 1;
        failedDetails.push({
          packPath: packFilePath,
          index: Number(item.__index ?? -1),
          reason: "missing file content"
        });
        continue;
      }

      const key = makeDedupeKey({
        title,
        subject,
        grade,
        contentType,
        sourceType,
        accessScope,
        classId: classId ?? "",
        linkUrl: linkUrl ?? "",
        fileName: fileName ?? "",
        textContent: textContent ?? ""
      });

      if (seen.has(key)) {
        itemSummary.skipped += 1;
        summary.skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO learning_library_items
         (id, title, description, content_type, subject, grade, owner_role, owner_id, class_id, access_scope,
          source_type, file_name, mime_type, size, content_base64, link_url, text_content, knowledge_point_ids,
          extracted_knowledge_points, generated_by_ai, status, share_token, created_at, updated_at)
         VALUES
         ($1, $2, $3, $4, $5, $6, 'admin', $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17,
          $18, FALSE, 'published', NULL, $19, $20)`,
        [
          `lib-${crypto.randomBytes(8).toString("hex")}`,
          title,
          trim(item.description) || null,
          contentType,
          subject,
          grade,
          adminId,
          classId,
          accessScope,
          sourceType,
          fileName,
          mimeType,
          size,
          contentBase64,
          linkUrl,
          textContent,
          [],
          [],
          now,
          now
        ]
      );

      seen.add(key);
      itemSummary.created += 1;
      summary.created += 1;
    }

    summary.packs.push(itemSummary);
  }

  await client.query("COMMIT");

  const totalAfter = await client.query("SELECT COUNT(*)::int AS count FROM learning_library_items");
  console.log(
    JSON.stringify(
      {
        ...summary,
        totalAfterImport: totalAfter.rows[0]?.count ?? null
      },
      null,
      2
    )
  );
  if (failedDetails.length) {
    console.log("failedDetails:");
    console.log(JSON.stringify(failedDetails.slice(0, 30), null, 2));
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
