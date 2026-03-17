import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { shouldAllowDbBootstrapFromJsonFallback } from "./runtime-guardrails";
import { readJson, writeJson } from "./storage";
import type {
  StudentEyesightLevel,
  StudentFocusSupport,
  StudentGender,
  StudentPersonaLike,
  StudentPersonality,
  StudentPeerSupport,
  StudentSeatPreference
} from "./student-persona-options";

export type StudentPersona = StudentPersonaLike & {
  id: string;
  userId: string;
  updatedAt: string;
};

type DbStudentPersona = {
  id: string;
  user_id: string;
  preferred_name: string | null;
  gender: StudentGender | null;
  height_cm: number | null;
  eyesight_level: StudentEyesightLevel | null;
  seat_preference: StudentSeatPreference | null;
  personality: StudentPersonality | null;
  focus_support: StudentFocusSupport | null;
  peer_support: StudentPeerSupport | null;
  strengths: string | null;
  support_notes: string | null;
  updated_at: string;
};

type StudentPersonaUpsertInput = {
  userId: string;
  preferredName?: string | null;
  gender?: StudentGender | null;
  heightCm?: number | null;
  eyesightLevel?: StudentEyesightLevel | null;
  seatPreference?: StudentSeatPreference | null;
  personality?: StudentPersonality | null;
  focusSupport?: StudentFocusSupport | null;
  peerSupport?: StudentPeerSupport | null;
  strengths?: string | null;
  supportNotes?: string | null;
};

const FILE = "student-personas.json";
let dbBootstrapReady: Promise<void> | null = null;
let dbBootstrapCompleted = false;

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length ? next : undefined;
}

function normalizeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function mapDbStudentPersona(row: DbStudentPersona): StudentPersona {
  return {
    id: row.id,
    userId: row.user_id,
    preferredName: row.preferred_name ?? undefined,
    gender: row.gender ?? undefined,
    heightCm: row.height_cm ?? undefined,
    eyesightLevel: row.eyesight_level ?? undefined,
    seatPreference: row.seat_preference ?? undefined,
    personality: row.personality ?? undefined,
    focusSupport: row.focus_support ?? undefined,
    peerSupport: row.peer_support ?? undefined,
    strengths: row.strengths ?? undefined,
    supportNotes: row.support_notes ?? undefined,
    updatedAt: row.updated_at
  };
}

async function bootstrapDbFromFileIfNeeded() {
  if (!isDbEnabled() || dbBootstrapCompleted) return;
  if (dbBootstrapReady) return dbBootstrapReady;

  dbBootstrapReady = (async () => {
    try {
      const existing = await queryOne<{ id: string }>("SELECT id FROM student_personas LIMIT 1");
      if (existing) {
        dbBootstrapCompleted = true;
        return;
      }

      const fallback = shouldAllowDbBootstrapFromJsonFallback() ? readJson<StudentPersona[]>(FILE, []) : [];
      for (const item of fallback) {
        const next = {
          id: item.id || `persona-${crypto.randomBytes(6).toString("hex")}`,
          userId: item.userId,
          preferredName: normalizeText(item.preferredName),
          gender: item.gender,
          heightCm: normalizeNumber(item.heightCm),
          eyesightLevel: item.eyesightLevel,
          seatPreference: item.seatPreference,
          personality: item.personality,
          focusSupport: item.focusSupport,
          peerSupport: item.peerSupport,
          strengths: normalizeText(item.strengths),
          supportNotes: normalizeText(item.supportNotes),
          updatedAt: item.updatedAt || new Date().toISOString()
        };
        if (!next.userId?.trim()) {
          continue;
        }
        await query(
          `INSERT INTO student_personas
            (id, user_id, preferred_name, gender, height_cm, eyesight_level, seat_preference, personality, focus_support, peer_support, strengths, support_notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (user_id) DO NOTHING`,
          [
            next.id,
            next.userId,
            next.preferredName ?? null,
            next.gender ?? null,
            next.heightCm ?? null,
            next.eyesightLevel ?? null,
            next.seatPreference ?? null,
            next.personality ?? null,
            next.focusSupport ?? null,
            next.peerSupport ?? null,
            next.strengths ?? null,
            next.supportNotes ?? null,
            next.updatedAt
          ]
        );
      }
      dbBootstrapCompleted = true;
    } finally {
      dbBootstrapReady = null;
    }
  })();

  return dbBootstrapReady;
}

export async function getStudentPersonas(): Promise<StudentPersona[]> {
  if (!isDbEnabled()) {
    return readJson<StudentPersona[]>(FILE, []);
  }
  await bootstrapDbFromFileIfNeeded();
  const rows = await query<DbStudentPersona>("SELECT * FROM student_personas ORDER BY updated_at DESC");
  return rows.map(mapDbStudentPersona);
}

export async function getStudentPersona(userId: string) {
  if (!isDbEnabled()) {
    const list = await getStudentPersonas();
    return list.find((item) => item.userId === userId) ?? null;
  }
  await bootstrapDbFromFileIfNeeded();
  const row = await queryOne<DbStudentPersona>("SELECT * FROM student_personas WHERE user_id = $1", [userId]);
  return row ? mapDbStudentPersona(row) : null;
}

export async function listStudentPersonasByUserIds(userIds: string[]) {
  if (!userIds.length) return [] as StudentPersona[];
  if (!isDbEnabled()) {
    const userIdSet = new Set(userIds);
    const list = await getStudentPersonas();
    return list.filter((item) => userIdSet.has(item.userId));
  }
  await bootstrapDbFromFileIfNeeded();
  const rows = await query<DbStudentPersona>("SELECT * FROM student_personas WHERE user_id = ANY($1)", [userIds]);
  return rows.map(mapDbStudentPersona);
}

export async function upsertStudentPersona(input: StudentPersonaUpsertInput): Promise<StudentPersona> {
  const existing = await getStudentPersona(input.userId);
  const updatedAt = new Date().toISOString();

  const next: StudentPersona = {
    id: existing?.id ?? `persona-${crypto.randomBytes(6).toString("hex")}`,
    userId: input.userId,
    preferredName: input.preferredName !== undefined ? normalizeText(input.preferredName) : existing?.preferredName,
    gender: input.gender !== undefined ? input.gender ?? undefined : existing?.gender,
    heightCm: input.heightCm !== undefined ? normalizeNumber(input.heightCm) : existing?.heightCm,
    eyesightLevel:
      input.eyesightLevel !== undefined ? input.eyesightLevel ?? undefined : existing?.eyesightLevel,
    seatPreference:
      input.seatPreference !== undefined ? input.seatPreference ?? undefined : existing?.seatPreference,
    personality: input.personality !== undefined ? input.personality ?? undefined : existing?.personality,
    focusSupport: input.focusSupport !== undefined ? input.focusSupport ?? undefined : existing?.focusSupport,
    peerSupport: input.peerSupport !== undefined ? input.peerSupport ?? undefined : existing?.peerSupport,
    strengths: input.strengths !== undefined ? normalizeText(input.strengths) : existing?.strengths,
    supportNotes:
      input.supportNotes !== undefined ? normalizeText(input.supportNotes) : existing?.supportNotes,
    updatedAt
  };

  if (!isDbEnabled()) {
    const list = await getStudentPersonas();
    const index = list.findIndex((item) => item.userId === input.userId);

    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }

    writeJson(FILE, list);
    return next;
  }

  await query(
    `INSERT INTO student_personas
      (id, user_id, preferred_name, gender, height_cm, eyesight_level, seat_preference, personality, focus_support, peer_support, strengths, support_notes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id) DO UPDATE SET
       preferred_name = EXCLUDED.preferred_name,
       gender = EXCLUDED.gender,
       height_cm = EXCLUDED.height_cm,
       eyesight_level = EXCLUDED.eyesight_level,
       seat_preference = EXCLUDED.seat_preference,
       personality = EXCLUDED.personality,
       focus_support = EXCLUDED.focus_support,
       peer_support = EXCLUDED.peer_support,
       strengths = EXCLUDED.strengths,
       support_notes = EXCLUDED.support_notes,
       updated_at = EXCLUDED.updated_at`,
    [
      next.id,
      next.userId,
      next.preferredName ?? null,
      next.gender ?? null,
      next.heightCm ?? null,
      next.eyesightLevel ?? null,
      next.seatPreference ?? null,
      next.personality ?? null,
      next.focusSupport ?? null,
      next.peerSupport ?? null,
      next.strengths ?? null,
      next.supportNotes ?? null,
      next.updatedAt
    ]
  );

  dbBootstrapCompleted = true;
  return next;
}
