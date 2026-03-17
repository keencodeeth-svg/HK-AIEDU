import crypto from "crypto";
import fs from "fs";
import path from "path";
import { badRequest, notFound } from "./api/http";
import { isDbEnabled, query, queryOne } from "./db";
import { DEFAULT_SCHOOL_ID } from "./schools";
import type { Weekday } from "./class-schedules";

export type TeacherUnavailableSlot = {
  id: string;
  schoolId: string;
  teacherId: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

const FILE = "teacher-unavailability.json";
const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
let syncPromise: Promise<void> | null = null;

type DbTeacherUnavailableSlot = {
  id: string;
  school_id: string | null;
  teacher_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeSchoolId(value?: string | null) {
  return value?.trim() || DEFAULT_SCHOOL_ID;
}

function normalizeText(value?: string | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
}

function readFileIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readStore() {
  const runtimePath = path.join(runtimeDir, FILE);
  const seedPath = path.join(seedDir, FILE);
  const list = readFileIfExists(runtimePath) ?? readFileIfExists(seedPath) ?? [];
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    schoolId: normalizeSchoolId(item.schoolId),
    reason: normalizeText(item.reason)
  })) as TeacherUnavailableSlot[];
}

function mapDbSlot(row: DbTeacherUnavailableSlot): TeacherUnavailableSlot {
  return {
    id: row.id,
    schoolId: normalizeSchoolId(row.school_id),
    teacherId: row.teacher_id,
    weekday: row.weekday as Weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: normalizeText(row.reason),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function writeStore(items: TeacherUnavailableSlot[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, FILE), JSON.stringify(items, null, 2));
}

async function syncStoreFromFileIfNeeded() {
  if (!isDbEnabled()) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const existing = await queryOne<{ id: string }>("SELECT id FROM teacher_unavailability_slots LIMIT 1");
    if (existing) return;
    const fallback = readStore();
    for (const item of fallback) {
      await query(
        `INSERT INTO teacher_unavailability_slots
         (id, school_id, teacher_id, weekday, start_time, end_time, reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.schoolId,
          item.teacherId,
          item.weekday,
          item.startTime,
          item.endTime,
          item.reason ?? null,
          item.createdAt,
          item.updatedAt
        ]
      );
    }
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

function assertWeekdayValue(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    badRequest("weekday must be between 1 and 7");
  }
}

function assertTimeValue(value: string, label: string) {
  if (!TIME_PATTERN.test(value)) {
    badRequest(`${label} must be HH:mm`);
  }
}

function assertTimeRange(startTime: string, endTime: string) {
  assertTimeValue(startTime, "startTime");
  assertTimeValue(endTime, "endTime");
  if (startTime >= endTime) {
    badRequest("endTime must be later than startTime");
  }
}

export async function listTeacherUnavailableSlots(scope?: { schoolId?: string | null; teacherId?: string }) {
  if (!isDbEnabled()) {
    return readStore().filter((item) => {
      if (scope?.schoolId && normalizeSchoolId(item.schoolId) !== normalizeSchoolId(scope.schoolId)) return false;
      if (scope?.teacherId && item.teacherId !== scope.teacherId) return false;
      return true;
    });
  }

  await syncStoreFromFileIfNeeded();
  const rows = await query<DbTeacherUnavailableSlot>("SELECT * FROM teacher_unavailability_slots");
  return rows.map(mapDbSlot).filter((item) => {
    if (scope?.schoolId && normalizeSchoolId(item.schoolId) !== normalizeSchoolId(scope.schoolId)) return false;
    if (scope?.teacherId && item.teacherId !== scope.teacherId) return false;
    return true;
  });
}

export async function createTeacherUnavailableSlot(input: {
  schoolId?: string | null;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  reason?: string;
}) {
  assertWeekdayValue(input.weekday);
  assertTimeRange(input.startTime, input.endTime);
  const now = new Date().toISOString();
  const next: TeacherUnavailableSlot = {
    id: `tblock-${crypto.randomBytes(6).toString("hex")}`,
    schoolId: normalizeSchoolId(input.schoolId),
    teacherId: input.teacherId,
    weekday: input.weekday as Weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    reason: normalizeText(input.reason),
    createdAt: now,
    updatedAt: now
  };
  if (isDbEnabled()) {
    await syncStoreFromFileIfNeeded();
    const row = await queryOne<DbTeacherUnavailableSlot>(
      `INSERT INTO teacher_unavailability_slots
       (id, school_id, teacher_id, weekday, start_time, end_time, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [next.id, next.schoolId, next.teacherId, next.weekday, next.startTime, next.endTime, next.reason ?? null, now, now]
    );
    return row ? mapDbSlot(row) : next;
  }
  const list = readStore();
  list.push(next);
  writeStore(list);
  return next;
}

export async function updateTeacherUnavailableSlot(id: string, input: {
  weekday?: number;
  startTime?: string;
  endTime?: string;
  reason?: string;
}) {
  if (!isDbEnabled()) {
    const list = readStore();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      notFound("teacher unavailable slot not found");
    }
    const current = list[index];
    const weekday = input.weekday === undefined ? current.weekday : input.weekday;
    const startTime = input.startTime ?? current.startTime;
    const endTime = input.endTime ?? current.endTime;
    assertWeekdayValue(weekday);
    assertTimeRange(startTime, endTime);
    const next: TeacherUnavailableSlot = {
      ...current,
      weekday: weekday as Weekday,
      startTime,
      endTime,
      reason: input.reason === undefined ? current.reason : normalizeText(input.reason),
      updatedAt: new Date().toISOString()
    };
    list[index] = next;
    writeStore(list);
    return next;
  }

  await syncStoreFromFileIfNeeded();
  const current = await queryOne<DbTeacherUnavailableSlot>("SELECT * FROM teacher_unavailability_slots WHERE id = $1", [id]);
  if (!current) {
    notFound("teacher unavailable slot not found");
  }
  const weekday = input.weekday === undefined ? current.weekday : input.weekday;
  const startTime = input.startTime ?? current.start_time;
  const endTime = input.endTime ?? current.end_time;
  assertWeekdayValue(weekday);
  assertTimeRange(startTime, endTime);
  const row = await queryOne<DbTeacherUnavailableSlot>(
    `UPDATE teacher_unavailability_slots
     SET weekday = $2,
         start_time = $3,
         end_time = $4,
         reason = $5,
         updated_at = $6
     WHERE id = $1
     RETURNING *`,
    [id, weekday, startTime, endTime, input.reason === undefined ? current.reason : normalizeText(input.reason) ?? null, new Date().toISOString()]
  );
  if (!row) {
    notFound("teacher unavailable slot not found");
  }
  return mapDbSlot(row);
}

export async function deleteTeacherUnavailableSlot(id: string, scope?: { schoolId?: string | null }) {
  if (!isDbEnabled()) {
    const list = readStore();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      notFound("teacher unavailable slot not found");
    }
    const current = list[index];
    if (scope?.schoolId && normalizeSchoolId(current.schoolId) !== normalizeSchoolId(scope.schoolId)) {
      notFound("teacher unavailable slot not found");
    }
    list.splice(index, 1);
    writeStore(list);
    return current;
  }

  await syncStoreFromFileIfNeeded();
  const current = await queryOne<DbTeacherUnavailableSlot>("SELECT * FROM teacher_unavailability_slots WHERE id = $1", [id]);
  if (!current) {
    notFound("teacher unavailable slot not found");
  }
  if (scope?.schoolId && normalizeSchoolId(current.school_id) !== normalizeSchoolId(scope.schoolId)) {
    notFound("teacher unavailable slot not found");
  }
  await query("DELETE FROM teacher_unavailability_slots WHERE id = $1", [id]);
  return mapDbSlot(current);
}
