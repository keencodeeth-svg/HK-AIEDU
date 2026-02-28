import fs from "fs/promises";
import path from "path";
import pg from "pg";

const { Pool } = pg;

const DEFAULT_ROOT = "/Users/keencode/Desktop/高中教材";

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function detectSubject(input) {
  const text = normalizeWhitespace(input);
  if (!text) return null;
  if (text.includes("语文")) return "chinese";
  if (text.includes("数学")) return "math";
  if (text.includes("英语")) return "english";
  if (text.includes("物理")) return "physics";
  if (text.includes("化学")) return "chemistry";
  if (text.includes("生物")) return "biology";
  if (text.includes("历史")) return "history";
  if (text.includes("地理")) return "geography";
  if (text.includes("政治") || text.includes("思想政治")) return "politics";
  return null;
}

function detectGrade(input) {
  const text = normalizeWhitespace(input);
  if (!text) return "10";

  if (
    /选择性必修\s*第三册|选择性必修\s*第四册|选(择性)?必修\s*3|选(择性)?必修\s*4|选修\s*3|选修\s*4/i.test(text)
  ) {
    return "12";
  }
  if (/选择性必修\s*第二册|选(择性)?必修\s*2|选修\s*2/i.test(text)) {
    return "11";
  }
  if (
    /选择性必修\s*第一册|选(择性)?必修\s*1|选修\s*1|必修\s*第三册|必修\s*3|必修\s*4/i.test(text)
  ) {
    return "11";
  }
  if (/必修\s*第二册|必修\s*2|下册|纲要（下）|纲要\(下\)/i.test(text)) {
    return "10";
  }
  if (/必修\s*第一册|必修\s*1|上册|纲要（上）|纲要\(上\)/i.test(text)) {
    return "10";
  }
  return "10";
}

function makeDedupeKey(input) {
  return [
    normalizeWhitespace(input.title).toLowerCase(),
    normalizeWhitespace(input.subject),
    normalizeWhitespace(input.grade),
    normalizeWhitespace(input.fileName).toLowerCase(),
    Number(input.size) || 0
  ].join("|");
}

async function walkPdfFiles(rootDir) {
  const result = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".pdf")) continue;
      result.push(absolute);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

async function main() {
  const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000
  });
  const client = await pool.connect();

  try {
    const stat = await fs.stat(rootDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new Error(`Folder not found: ${rootDir}`);
    }

    const files = await walkPdfFiles(rootDir);
    if (!files.length) {
      throw new Error(`No PDF found in: ${rootDir}`);
    }
    console.log(`Found ${files.length} PDF files under: ${rootDir}`);

    const adminRes = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC NULLS LAST LIMIT 1"
    );
    const adminId = adminRes.rows[0]?.id;
    if (!adminId) {
      throw new Error("No admin user found in users table");
    }

    const existingRes = await client.query(
      `SELECT title, subject, grade, file_name, size
         FROM learning_library_items
        WHERE content_type = 'textbook' AND source_type = 'file'`
    );
    const existing = new Set(
      existingRes.rows.map((row) =>
        makeDedupeKey({
          title: row.title,
          subject: row.subject,
          grade: row.grade,
          fileName: row.file_name ?? "",
          size: row.size ?? 0
        })
      )
    );

    const summary = {
      rootDir,
      totalFiles: files.length,
      created: 0,
      skipped: 0,
      failed: 0
    };
    const failed = [];

    for (const filePath of files) {
      const rel = path.relative(rootDir, filePath);
      const fileName = path.basename(filePath);
      const title = fileName.replace(/\.pdf$/i, "");
      const subject = detectSubject(rel);

      if (!subject) {
        summary.failed += 1;
        failed.push({ file: rel, reason: "subject not recognized" });
        continue;
      }

      const grade = detectGrade(fileName);
      const buffer = await fs.readFile(filePath);
      const size = buffer.byteLength;
      const dedupeKey = makeDedupeKey({ title, subject, grade, fileName, size });
      if (existing.has(dedupeKey)) {
        summary.skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      const contentBase64 = buffer.toString("base64");

      try {
        await client.query(
          `INSERT INTO learning_library_items
             (id, title, description, content_type, subject, grade, owner_role, owner_id, class_id, access_scope,
              source_type, file_name, mime_type, size, content_base64, content_storage_provider, content_storage_key,
              link_url, text_content, knowledge_point_ids, extracted_knowledge_points, generated_by_ai, status,
              share_token, created_at, updated_at)
           VALUES
             ($1, $2, $3, 'textbook', $4, $5, 'admin', $6, NULL, 'global',
              'file', $7, 'application/pdf', $8, $9, NULL, NULL,
              NULL, NULL, $10, $11, FALSE, 'published',
              NULL, $12, $13)`,
          [
            `lib-${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-6)}`,
            title,
            "人教版高中教材（批量导入）",
            subject,
            grade,
            adminId,
            fileName,
            size,
            contentBase64,
            [],
            [],
            now,
            now
          ]
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.failed += 1;
        failed.push({ file: rel, reason: message.slice(0, 200) });
        continue;
      }

      existing.add(dedupeKey);
      summary.created += 1;
      if ((summary.created + summary.skipped + summary.failed) % 5 === 0) {
        console.log(
          `Progress ${summary.created + summary.skipped + summary.failed}/${summary.totalFiles} (created=${summary.created}, skipped=${summary.skipped}, failed=${summary.failed})`
        );
      }
    }

    const totalAfter = await client.query("SELECT COUNT(*)::int AS count FROM learning_library_items");
    console.log(
      JSON.stringify(
        {
          ...summary,
          totalAfterImport: totalAfter.rows[0]?.count ?? null,
          failedPreview: failed.slice(0, 20)
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
