import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const schemaPath = path.join(process.cwd(), "db", "schema.sql");
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found: ${schemaPath}`);
  process.exit(1);
}

const rawSql = fs.readFileSync(schemaPath, "utf-8");
const statements = rawSql
  .replace(/--.*$/gm, "")
  .split(";")
  .map((stmt) => stmt.trim())
  .filter(Boolean);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

const client = await pool.connect();

try {
  await client.query("BEGIN");
  for (const stmt of statements) {
    await client.query(stmt);
  }
  await client.query("COMMIT");
  console.log(`Schema initialized. Applied ${statements.length} statements.`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Failed to initialize schema:", error);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
