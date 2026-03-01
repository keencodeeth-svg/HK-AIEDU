import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";

export type SchoolStatus = "active" | "disabled";

export type School = {
  id: string;
  name: string;
  code: string;
  status: SchoolStatus;
  createdAt: string;
  updatedAt: string;
};

type DbSchool = {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const SCHOOL_FILE = "schools.json";
export const DEFAULT_SCHOOL_ID = "school-default";
export const DEFAULT_SCHOOL_CODE = "DEFAULT";
export const DEFAULT_SCHOOL_NAME = "默认学校";

function mapSchool(row: DbSchool): School {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: (row.status as SchoolStatus) ?? "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeSchoolCode(code: string) {
  // Keep school code canonical so API/UI/DB lookups stay case- and symbol-insensitive.
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function buildSchoolCodeFromName(name: string) {
  const normalized = normalizeSchoolCode(name).slice(0, 12);
  if (normalized.length >= 4) return normalized;
  return `SCH${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function getSchools(): Promise<School[]> {
  if (!isDbEnabled()) {
    return readJson<School[]>(SCHOOL_FILE, []);
  }
  const rows = await query<DbSchool>("SELECT * FROM schools ORDER BY created_at ASC");
  return rows.map(mapSchool);
}

export async function getSchoolById(id: string): Promise<School | null> {
  if (!isDbEnabled()) {
    const schools = await getSchools();
    return schools.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbSchool>("SELECT * FROM schools WHERE id = $1", [id]);
  return row ? mapSchool(row) : null;
}

export async function getSchoolByCode(code: string): Promise<School | null> {
  const normalizedCode = normalizeSchoolCode(code);
  if (!normalizedCode) return null;

  if (!isDbEnabled()) {
    const schools = await getSchools();
    return schools.find((item) => normalizeSchoolCode(item.code) === normalizedCode) ?? null;
  }

  const row = await queryOne<DbSchool>("SELECT * FROM schools WHERE upper(code) = $1", [normalizedCode]);
  return row ? mapSchool(row) : null;
}

export async function createSchool(input: { name: string; code?: string }): Promise<School> {
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const id = `school-${crypto.randomBytes(6).toString("hex")}`;
  const code = normalizeSchoolCode(input.code ?? buildSchoolCodeFromName(input.name));

  if (!isDbEnabled()) {
    const schools = await getSchools();
    const existing = schools.find((item) => normalizeSchoolCode(item.code) === code);
    if (existing) return existing;
    const next: School = {
      id,
      name: input.name,
      code,
      status: "active",
      createdAt,
      updatedAt
    };
    schools.push(next);
    writeJson(SCHOOL_FILE, schools);
    return next;
  }

  const row = await queryOne<DbSchool>(
    `INSERT INTO schools (id, name, code, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', $4, $5)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, input.name, code, createdAt, updatedAt]
  );

  if (row) return mapSchool(row);
  const fallback = await getSchoolByCode(code);
  if (!fallback) {
    throw new Error("failed to create school");
  }
  return fallback;
}

export async function ensureDefaultSchool(): Promise<School> {
  // A stable default tenant lets legacy users/classes without school metadata continue to work.
  const existingById = await getSchoolById(DEFAULT_SCHOOL_ID);
  if (existingById) return existingById;

  if (!isDbEnabled()) {
    const schools = await getSchools();
    const existingByCode = schools.find((item) => normalizeSchoolCode(item.code) === DEFAULT_SCHOOL_CODE);
    if (existingByCode) return existingByCode;
    const next: School = {
      id: DEFAULT_SCHOOL_ID,
      name: DEFAULT_SCHOOL_NAME,
      code: DEFAULT_SCHOOL_CODE,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    schools.push(next);
    writeJson(SCHOOL_FILE, schools);
    return next;
  }

  const row = await queryOne<DbSchool>(
    `INSERT INTO schools (id, name, code, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', now(), now())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       code = EXCLUDED.code,
       updated_at = now()
     RETURNING *`,
    [DEFAULT_SCHOOL_ID, DEFAULT_SCHOOL_NAME, DEFAULT_SCHOOL_CODE]
  );

  if (row) return mapSchool(row);
  const fallback = await getSchoolById(DEFAULT_SCHOOL_ID);
  if (!fallback) {
    throw new Error("failed to ensure default school");
  }
  return fallback;
}

export async function resolveSchoolIdByCodeOrDefault(input?: {
  schoolCode?: string | null;
  fallbackToDefault?: boolean;
}) {
  const schoolCode = input?.schoolCode?.trim();
  if (schoolCode) {
    // Explicit school code always takes precedence; no implicit remapping.
    const school = await getSchoolByCode(schoolCode);
    return school?.id ?? null;
  }

  if (input?.fallbackToDefault === false) {
    return null;
  }

  const defaultSchool = await ensureDefaultSchool();
  return defaultSchool.id;
}
