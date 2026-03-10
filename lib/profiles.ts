import crypto from "crypto";
import { mutateJson, readJson, updateJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type StudentProfile = {
  id: string;
  userId: string;
  grade: string;
  subjects: string[];
  target?: string;
  school?: string;
  observerCode?: string;
  updatedAt: string;
};

const PROFILE_FILE = "student-profiles.json";

type DbProfile = {
  id: string;
  user_id: string;
  grade: string;
  subjects: string[];
  target: string | null;
  school: string | null;
  observer_code: string | null;
  updated_at: string;
};

function mapProfile(row: DbProfile): StudentProfile {
  return {
    id: row.id,
    userId: row.user_id,
    grade: row.grade,
    subjects: row.subjects,
    target: row.target ?? "",
    school: row.school ?? "",
    observerCode: row.observer_code ?? undefined,
    updatedAt: row.updated_at
  };
}

function generateObserverCode() {
  return `HK${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function isObserverCodeAvailable(code: string, userId?: string) {
  if (!isDbEnabled()) {
    const list = await getStudentProfiles();
    return !list.some((item) => item.observerCode === code && item.userId !== userId);
  }
  const row = await queryOne<{ id: string }>("SELECT id FROM student_profiles WHERE observer_code = $1", [code]);
  if (!row) return true;
  if (!userId) return false;
  const profile = await getStudentProfile(userId);
  return profile ? profile.id === row.id : false;
}

async function createUniqueObserverCode(userId?: string) {
  for (let i = 0; i < 5; i += 1) {
    const next = generateObserverCode();
    const ok = await isObserverCodeAvailable(next, userId);
    if (ok) return next;
  }
  return `${generateObserverCode()}${Date.now().toString().slice(-2)}`;
}

export async function getStudentProfiles(): Promise<StudentProfile[]> {
  if (!isDbEnabled()) {
    return readJson<StudentProfile[]>(PROFILE_FILE, []);
  }
  const rows = await query<DbProfile>("SELECT * FROM student_profiles");
  return rows.map(mapProfile);
}

export async function saveStudentProfiles(list: StudentProfile[]) {
  if (!isDbEnabled()) {
    writeJson(PROFILE_FILE, list);
  }
}

export async function getStudentProfile(userId: string) {
  if (!isDbEnabled()) {
    const list = await getStudentProfiles();
    return list.find((item) => item.userId === userId) ?? null;
  }
  const row = await queryOne<DbProfile>("SELECT * FROM student_profiles WHERE user_id = $1", [userId]);
  return row ? mapProfile(row) : null;
}

export async function getStudentProfileByObserverCode(code: string) {
  if (!code) return null;
  if (!isDbEnabled()) {
    const list = await getStudentProfiles();
    return list.find((item) => item.observerCode === code) ?? null;
  }
  const row = await queryOne<DbProfile>("SELECT * FROM student_profiles WHERE observer_code = $1", [code]);
  return row ? mapProfile(row) : null;
}

export async function ensureObserverCode(userId: string) {
  const profile = await getStudentProfile(userId);
  if (!profile) return null;
  if (profile.observerCode) return profile.observerCode;
  const observerCode = await createUniqueObserverCode(userId);

  if (!isDbEnabled()) {
    return mutateJson<StudentProfile[], string | null>(PROFILE_FILE, [], (list) => {
      const index = list.findIndex((item) => item.userId === userId);
      if (index < 0) {
        return { result: null };
      }
      const next = { ...list[index], observerCode };
      list[index] = next;
      return { result: observerCode };
    });
  }

  await query("UPDATE student_profiles SET observer_code = $2 WHERE user_id = $1", [userId, observerCode]);
  return observerCode;
}

export async function rotateObserverCode(userId: string) {
  const profile = await getStudentProfile(userId);
  if (!profile) return null;
  const observerCode = await createUniqueObserverCode(userId);
  if (!isDbEnabled()) {
    return mutateJson<StudentProfile[], string | null>(PROFILE_FILE, [], (list) => {
      const index = list.findIndex((item) => item.userId === userId);
      if (index < 0) {
        return { result: null };
      }
      const next = { ...list[index], observerCode };
      list[index] = next;
      return { result: observerCode };
    });
  }
  await query("UPDATE student_profiles SET observer_code = $2 WHERE user_id = $1", [userId, observerCode]);
  return observerCode;
}

export async function upsertStudentProfile(input: Omit<StudentProfile, "id" | "updatedAt">) {
  const updatedAt = new Date().toISOString();

  if (!isDbEnabled()) {
    const observerCode = input.observerCode ?? (await createUniqueObserverCode(input.userId));
    return updateJson<StudentProfile[]>(PROFILE_FILE, [], (list) => {
      const existingIndex = list.findIndex((item) => item.userId === input.userId);
      if (existingIndex >= 0) {
        const next = { ...list[existingIndex], ...input, updatedAt };
        list[existingIndex] = next;
        return list;
      }
      const next: StudentProfile = {
        id: `sp-${crypto.randomBytes(6).toString("hex")}`,
        updatedAt,
        observerCode,
        ...input
      };
      list.push(next);
      return list;
    }).then((list) => list.find((item) => item.userId === input.userId) ?? null);
  }

  const id = `sp-${crypto.randomBytes(6).toString("hex")}`;
  const observerCode = input.observerCode ?? (await createUniqueObserverCode(input.userId));
  const row = await queryOne<DbProfile>(
    `INSERT INTO student_profiles (id, user_id, grade, subjects, target, school, observer_code, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET
       grade = EXCLUDED.grade,
       subjects = EXCLUDED.subjects,
       target = EXCLUDED.target,
       school = EXCLUDED.school,
       observer_code = COALESCE(student_profiles.observer_code, EXCLUDED.observer_code),
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, input.userId, input.grade, input.subjects, input.target ?? "", input.school ?? "", observerCode, updatedAt]
  );

  return row ? mapProfile(row) : null;
}
