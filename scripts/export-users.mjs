import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

const outputArg = process.argv[2]?.trim();
const outputPath = outputArg
  ? path.resolve(process.cwd(), outputArg)
  : path.join(process.cwd(), "exports", "users.csv");
const includePasswordHints = process.env.EXPORT_INCLUDE_PASSWORD_HINTS === "true";
const columns = includePasswordHints
  ? ["id", "role", "email", "name", "created_at", "password_hint"]
  : ["id", "role", "email", "name", "created_at"];

function toCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function passwordHint(raw) {
  if (!raw) return "";
  if (raw.startsWith("plain:")) return raw.slice("plain:".length);
  return "已加密(非明文)";
}

function toCsv(rows) {
  const lines = [columns.map(toCsvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => toCsvCell(row[column])).join(","));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

function buildExportRow(row) {
  const base = {
    id: row.id,
    role: row.role,
    email: row.email,
    name: row.name,
    created_at: row.created_at ?? ""
  };

  if (!includePasswordHints) {
    return base;
  }

  return {
    ...base,
    password_hint: passwordHint(row.password)
  };
}

async function loadFromDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  try {
    const result = await pool.query(
      `SELECT id, role, email, name, created_at${includePasswordHints ? ", password" : ""}
       FROM users
       ORDER BY role, email`
    );
    return result.rows.map((row) =>
      buildExportRow({
        ...row,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : ""
      })
    );
  } finally {
    await pool.end();
  }
}

function loadFromJson() {
  const filePath = path.join(process.cwd(), "data", "users.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("data/users.json not found, and DATABASE_URL is not set");
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(raw)) {
    throw new Error("data/users.json format invalid");
  }
  return raw
    .map((item) =>
      buildExportRow({
        id: item.id ?? "",
        role: item.role ?? "",
        email: item.email ?? "",
        name: item.name ?? "",
        password: item.password,
        created_at: item.createdAt ?? ""
      })
    )
    .sort((a, b) => {
      const roleOrder = String(a.role).localeCompare(String(b.role));
      if (roleOrder !== 0) return roleOrder;
      return String(a.email).localeCompare(String(b.email));
    });
}

async function main() {
  if (includePasswordHints) {
    console.warn("EXPORT_INCLUDE_PASSWORD_HINTS=true enabled; handle the generated file as sensitive data.");
  }
  const rows = process.env.DATABASE_URL ? await loadFromDatabase() : loadFromJson();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCsv(rows), "utf-8");
  console.log(`Exported ${rows.length} users to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
