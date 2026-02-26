import { Pool } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { normalizeBootstrapPassword } from "./password";

type QueryParam = string | number | boolean | null | string[] | number[] | Record<string, any>;
type QueryParams = QueryParam[];

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!pool) {
    const sslEnabled = process.env.DB_SSL === "true";
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

async function ensureSchema() {
  if (!isDbEnabled()) return;
  if (schemaReady) return schemaReady;

  const db = getPool();
  schemaReady = (async () => {
    const filePath = path.join(process.cwd(), "db", "schema.sql");
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const cleaned = raw.replace(/--.*$/gm, "");
    const statements = cleaned
      .split(";")
      .map((stmt) => stmt.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.query(stmt);
    }
    await ensureBootstrapAdmin(db);
  })();

  return schemaReady;
}

async function ensureBootstrapAdmin(db: Pool) {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const rawPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !rawPassword) return;

  const name = process.env.ADMIN_BOOTSTRAP_NAME ?? "管理员";
  const password = normalizeBootstrapPassword(rawPassword);
  const id = `u-admin-${crypto.randomBytes(6).toString("hex")}`;

  await db.query(
    `INSERT INTO users (id, email, name, role, password)
     VALUES ($1, $2, $3, 'admin', $4)
     ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      role = 'admin',
      password = EXCLUDED.password`,
    [id, email, name, password]
  );
}

export async function query<T>(text: string, params: QueryParams = []) {
  await ensureSchema();
  const db = getPool();
  const result = await db.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params: QueryParams = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
