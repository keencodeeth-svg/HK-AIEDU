import { Pool } from "pg";
import crypto from "crypto";
import { normalizeBootstrapPassword } from "./password";
import { assertRuntimeGuardrails } from "./runtime-guardrails";

type QueryParam = string | number | boolean | null | string[] | number[] | Record<string, any>;
type QueryParams = QueryParam[];

let pool: Pool | null = null;
let bootstrapReady: Promise<void> | null = null;

export function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function isProductionBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";
}

export function isDatabaseRequired() {
  if (process.env.REQUIRE_DATABASE === "true") return true;
  if (process.env.REQUIRE_DATABASE === "false") return false;
  if (isProductionBuildPhase()) return false;
  if (!process.env.DATABASE_URL) return false;
  return process.env.NODE_ENV === "production" && process.env.ALLOW_JSON_FALLBACK !== "true";
}

export function assertDatabaseEnabled(context = "runtime") {
  assertRuntimeGuardrails();
  if (!isDatabaseRequired()) return;
  if (isDbEnabled()) return;
  throw new Error(`DATABASE_URL is required for ${context}. Set REQUIRE_DATABASE=false to allow JSON fallback.`);
}

export function requireDatabaseEnabled(context = "runtime") {
  assertDatabaseEnabled(context);
  if (isDbEnabled()) return;
  throw new Error(`DATABASE_URL is required for ${context}. This state no longer supports JSON fallback.`);
}

function getPool() {
  assertRuntimeGuardrails();
  if (!pool) {
    const sslEnabled = process.env.DB_SSL === "true";
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
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

async function ensureBootstrapAdminOnce() {
  if (!isDbEnabled()) return;
  if (bootstrapReady) return bootstrapReady;
  const db = getPool();
  bootstrapReady = ensureBootstrapAdmin(db).catch((error) => {
    bootstrapReady = null;
    throw error;
  });
  return bootstrapReady;
}

function wrapMissingSchemaError(error: unknown) {
  const pgError = error as { code?: string; message?: string };
  if (pgError?.code === "42P01" || pgError?.code === "3F000") {
    return new Error(
      `${pgError.message ?? "Database relation missing"}. Run "npm run db:migrate" (or "npm run db:init") before starting the app.`
    );
  }
  return error;
}

export async function query<T>(text: string, params: QueryParams = []) {
  const db = getPool();
  try {
    await ensureBootstrapAdminOnce();
    const result = await db.query(text, params);
    return result.rows as T[];
  } catch (error) {
    throw wrapMissingSchemaError(error);
  }
}

export async function queryOne<T>(text: string, params: QueryParams = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
