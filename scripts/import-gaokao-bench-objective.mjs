import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import pg from "pg";

const execFileAsync = promisify(execFile);
const { Pool } = pg;

const GITHUB_LIST_URL = "https://api.github.com/repos/OpenLMLab/GAOKAO-Bench/contents/Data/Objective_Questions?ref=main";
const DEFAULT_CACHE_DIR = path.resolve(".runtime-data/gaokao-bench/objective");
const DEFAULT_GRADE = "12";

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeStemForKey(value) {
  return normalizeWhitespace(value).replace(/\s+/g, "").toLowerCase();
}

function fileToSubject(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("math")) return "math";
  if (lower.includes("english")) return "english";
  if (lower.includes("physics")) return "physics";
  if (lower.includes("chemistry")) return "chemistry";
  if (lower.includes("biology")) return "biology";
  if (lower.includes("history")) return "history";
  if (lower.includes("geography")) return "geography";
  if (lower.includes("political_science") || lower.includes("politics")) return "politics";
  if (lower.includes("chinese")) return "chinese";
  return null;
}

function sanitizeFileLabel(fileName) {
  return fileName
    .replace(/\.json$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(prefix, value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
  const hash = crypto.createHash("sha1").update(String(value ?? "")).digest("hex").slice(0, 10);
  return `${prefix}-${normalized || "x"}-${hash}`;
}

function parseArgs(argv) {
  const result = {
    sourceDir: "",
    cacheDir: DEFAULT_CACHE_DIR,
    dryRun: false,
    limit: null,
    includeSubjects: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (token === "--source-dir") {
      result.sourceDir = path.resolve(argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (token === "--cache-dir") {
      result.cacheDir = path.resolve(argv[i + 1] ?? DEFAULT_CACHE_DIR);
      i += 1;
      continue;
    }
    if (token === "--limit") {
      const raw = Number(argv[i + 1]);
      result.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
      i += 1;
      continue;
    }
    if (token === "--subjects") {
      const raw = String(argv[i + 1] ?? "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      result.includeSubjects = raw.length ? new Set(raw) : null;
      i += 1;
      continue;
    }
  }

  return result;
}

async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function curlGet(url) {
  const { stdout } = await execFileAsync("curl", ["-sS", url], {
    maxBuffer: 16 * 1024 * 1024
  });
  return stdout;
}

async function ensureDatasetFiles(cacheDir) {
  await fs.mkdir(cacheDir, { recursive: true });
  const rawList = await curlGet(GITHUB_LIST_URL);
  const files = JSON.parse(rawList)
    .filter((item) => item?.type === "file" && String(item.name).endsWith(".json"))
    .filter((item) => item?.download_url)
    .map((item) => ({
      name: String(item.name),
      downloadUrl: String(item.download_url)
    }));

  const localFiles = [];
  for (const file of files) {
    const target = path.join(cacheDir, file.name);
    await execFileAsync("curl", ["-sS", file.downloadUrl, "-o", target], {
      maxBuffer: 16 * 1024 * 1024
    });
    localFiles.push(target);
  }
  return localFiles;
}

async function listLocalJsonFiles(sourceDir) {
  const stat = await fs.stat(sourceDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`source dir not found: ${sourceDir}`);
  }
  const files = await fs.readdir(sourceDir, { withFileTypes: true });
  return files
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".json"))
    .map((item) => path.join(sourceDir, item.name))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function parseQuestionAndOptions(rawText) {
  const lines = String(rawText ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  const stemLines = [];
  const optionMap = new Map();
  let currentLabel = null;
  const optionRegex = /^\s*([A-Ha-h])\s*[\.．、:：\)\）]\s*(.*)\s*$/;

  function extractInlineOptions(line) {
    const patterns = [/\b([A-Ha-h])\s*[\.．、:：\)\）]\s*/g, /[\(（]\s*([A-Ha-h])\s*[\)）]\s*/g];
    for (const pattern of patterns) {
      const matches = Array.from(line.matchAll(pattern));
      if (matches.length < 2) continue;
      const first = matches[0];
      const prefix = normalizeWhitespace(line.slice(0, first.index));
      const options = [];
      for (let i = 0; i < matches.length; i += 1) {
        const current = matches[i];
        const next = matches[i + 1];
        const label = current[1].toUpperCase();
        const start = (current.index ?? 0) + current[0].length;
        const end = next?.index ?? line.length;
        const content = normalizeWhitespace(line.slice(start, end));
        if (!content) continue;
        options.push({ label, value: `${label}. ${content}` });
      }
      if (options.length >= 2) {
        return { prefix, options };
      }
    }
    return null;
  }

  for (const originalLine of lines) {
    const line = originalLine.trim();
    if (!line) {
      if (!currentLabel && stemLines.length) stemLines.push("");
      continue;
    }

    const inline = extractInlineOptions(line);
    if (inline) {
      if (inline.prefix) stemLines.push(inline.prefix);
      inline.options.forEach((item) => optionMap.set(item.label, item.value));
      currentLabel = null;
      continue;
    }

    const match = line.match(optionRegex);
    if (match) {
      const label = match[1].toUpperCase();
      const content = normalizeWhitespace(match[2]);
      optionMap.set(label, content ? `${label}. ${content}` : `${label}.`);
      currentLabel = label;
      continue;
    }

    if (currentLabel) {
      const previous = optionMap.get(currentLabel) ?? `${currentLabel}.`;
      optionMap.set(currentLabel, normalizeWhitespace(`${previous} ${line}`));
      continue;
    }

    stemLines.push(line);
  }

  let stem = stemLines.join("\n").trim();
  stem = stem.replace(/^\d+\s*[\.．、]\s*/, "").trim();
  const orderedLabels = Array.from(optionMap.keys()).sort();
  const options = orderedLabels
    .map((label) => normalizeWhitespace(optionMap.get(label)))
    .filter(Boolean);

  return { stem, options, optionMap };
}

function parseAnswerValue(rawAnswer, optionMap) {
  const joined = Array.isArray(rawAnswer) ? rawAnswer.map((item) => String(item)).join(",") : String(rawAnswer ?? "");
  const letters = Array.from(new Set(joined.toUpperCase().match(/[A-H]/g) ?? []));
  if (letters.length !== 1) return null;
  const letter = letters[0];
  return normalizeWhitespace(optionMap.get(letter) ?? letter);
}

function parseYearValue(item) {
  const year = String(item?.year ?? "").trim();
  return /^\d{4}$/.test(year) ? year : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 20000
  });
  const client = await pool.connect();

  try {
    const filePaths = args.sourceDir ? await listLocalJsonFiles(args.sourceDir) : await ensureDatasetFiles(args.cacheDir);
    if (!filePaths.length) {
      throw new Error("no json files found");
    }

    const adminRes = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC NULLS LAST LIMIT 1"
    );
    const adminId = adminRes.rows[0]?.id;
    if (!adminId) {
      throw new Error("no admin user found");
    }

    const existingQuestions = await client.query(
      "SELECT subject, grade, stem FROM questions WHERE grade = $1",
      [DEFAULT_GRADE]
    );
    const existingStemKey = new Set(
      existingQuestions.rows.map((row) =>
        [normalizeWhitespace(row.subject), normalizeWhitespace(row.grade), normalizeStemForKey(row.stem)].join("|")
      )
    );

    const kpCache = new Map();
    const summary = {
      files: filePaths.length,
      createdKnowledgePoints: 0,
      importedQuestions: 0,
      skippedSubject: 0,
      skippedInvalid: 0,
      skippedDuplicate: 0,
      failed: 0
    };
    const failed = [];
    const byFile = [];
    let imported = 0;

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const subject = fileToSubject(fileName);
      if (!subject) {
        summary.skippedSubject += 1;
        continue;
      }
      if (args.includeSubjects && !args.includeSubjects.has(subject)) {
        continue;
      }

      const data = await readJsonFile(filePath).catch((error) => {
        throw new Error(`read ${fileName} failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      const examples = Array.isArray(data?.example) ? data.example : [];
      const fileLabel = sanitizeFileLabel(fileName);
      const chapter = "GAOKAO-Bench 客观题";
      const unit = fileLabel;
      const kpKey = `${subject}|${DEFAULT_GRADE}|${unit}`;
      let kpId = kpCache.get(kpKey);

      if (!kpId) {
        kpId = makeId("kp-gaokao", `${subject}-${DEFAULT_GRADE}-${unit}`);
        if (!args.dryRun) {
          await client.query(
            `INSERT INTO knowledge_points (id, subject, grade, title, chapter, unit)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [kpId, subject, DEFAULT_GRADE, unit, chapter, unit]
          );
        }
        kpCache.set(kpKey, kpId);
        summary.createdKnowledgePoints += 1;
      }

      const fileSummary = {
        file: fileName,
        total: examples.length,
        imported: 0,
        skippedInvalid: 0,
        skippedDuplicate: 0
      };

      for (const item of examples) {
        if (args.limit && imported >= args.limit) break;
        const parsed = parseQuestionAndOptions(item?.question ?? "");
        const stem = normalizeWhitespace(parsed.stem);
        const options = parsed.options.map((option) => normalizeWhitespace(option)).filter(Boolean);
        const answer = parseAnswerValue(item?.answer, parsed.optionMap);

        if (!stem || options.length < 2 || !answer) {
          summary.skippedInvalid += 1;
          fileSummary.skippedInvalid += 1;
          continue;
        }

        if (!options.includes(answer)) {
          summary.skippedInvalid += 1;
          fileSummary.skippedInvalid += 1;
          continue;
        }

        const dedupeKey = [subject, DEFAULT_GRADE, normalizeStemForKey(stem)].join("|");
        if (existingStemKey.has(dedupeKey)) {
          summary.skippedDuplicate += 1;
          fileSummary.skippedDuplicate += 1;
          continue;
        }

        const year = parseYearValue(item);
        const explanation = normalizeWhitespace(item?.analysis ?? "参考解析见题干来源。");
        const tags = ["gaokao-bench", "objective", fileName.replace(/\.json$/i, "")];
        if (year) tags.push(`year-${year}`);

        const questionId = `q-${crypto.randomBytes(6).toString("hex")}`;
        if (!args.dryRun) {
          try {
            await client.query(
              `INSERT INTO questions
                 (id, subject, grade, knowledge_point_id, stem, options, answer, explanation, difficulty, question_type, tags, abilities)
               VALUES
                 ($1, $2, $3, $4, $5, $6, $7, $8, 'hard', 'choice', $9, $10)`,
              [questionId, subject, DEFAULT_GRADE, kpId, stem, options, answer, explanation, tags, ["应试", "客观题"]]
            );
          } catch (error) {
            summary.failed += 1;
            failed.push({
              file: fileName,
              index: item?.index ?? null,
              reason: error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180)
            });
            continue;
          }
        }

        existingStemKey.add(dedupeKey);
        imported += 1;
        summary.importedQuestions += 1;
        fileSummary.imported += 1;
      }

      byFile.push(fileSummary);
      if (args.limit && imported >= args.limit) break;
    }

    const totals = await client.query(
      "SELECT COUNT(*)::int AS count FROM questions WHERE grade = $1 AND tags @> $2::text[]",
      [DEFAULT_GRADE, ["gaokao-bench"]]
    );

    console.log(
      JSON.stringify(
        {
          mode: args.dryRun ? "dry-run" : "import",
          source: args.sourceDir ? `local:${args.sourceDir}` : `download:${args.cacheDir}`,
          summary,
          gaokaoQuestionTotalInDb: totals.rows[0]?.count ?? null,
          byFile,
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
