import crypto from "crypto";
import fs from "fs";
import path from "path";
import { badRequest, notFound } from "./api/http";
import { isDbEnabled, query, queryOne } from "./db";
import { DEFAULT_SCHOOL_ID } from "./schools";
import type { Weekday } from "./class-schedules";

export type TeacherScheduleRule = {
  id: string;
  schoolId: string;
  teacherId: string;
  weeklyMaxLessons?: number;
  maxConsecutiveLessons?: number;
  minCampusGapMinutes?: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherRuleSession = {
  id?: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  campus?: string;
};

const FILE = "teacher-schedule-rules.json";
const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CONSECUTIVE_GAP_MINUTES = 15;
let syncPromise: Promise<void> | null = null;

type DbTeacherScheduleRule = {
  id: string;
  school_id: string | null;
  teacher_id: string;
  weekly_max_lessons: number | null;
  max_consecutive_lessons: number | null;
  min_campus_gap_minutes: number | null;
  created_at: string;
  updated_at: string;
};

function normalizeSchoolId(value?: string | null) {
  return value?.trim() || DEFAULT_SCHOOL_ID;
}

function normalizeTeacherId(value?: string | null) {
  return value?.trim() || "";
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
}

function normalizeOptionalInteger(value: unknown, options: { min: number; max: number; zeroAsUndefined?: boolean }) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const next = Number(value);
  if (!Number.isInteger(next)) {
    return undefined;
  }
  if (options.zeroAsUndefined && next === 0) {
    return undefined;
  }
  if (next < options.min || next > options.max) {
    return undefined;
  }
  return next;
}

function readFileIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function mapRule(item: Partial<TeacherScheduleRule>): TeacherScheduleRule {
  const createdAt = item.createdAt ?? new Date().toISOString();
  const updatedAt = item.updatedAt ?? createdAt;
  return {
    id: item.id ?? `trule-${crypto.randomBytes(6).toString("hex")}`,
    schoolId: normalizeSchoolId(item.schoolId),
    teacherId: normalizeTeacherId(item.teacherId),
    weeklyMaxLessons: normalizeOptionalInteger(item.weeklyMaxLessons, { min: 1, max: 60 }),
    maxConsecutiveLessons: normalizeOptionalInteger(item.maxConsecutiveLessons, { min: 1, max: 12 }),
    minCampusGapMinutes: normalizeOptionalInteger(item.minCampusGapMinutes, { min: 1, max: 240, zeroAsUndefined: true }),
    createdAt,
    updatedAt
  };
}

function readStore() {
  const runtimePath = path.join(runtimeDir, FILE);
  const seedPath = path.join(seedDir, FILE);
  const list = readFileIfExists(runtimePath) ?? readFileIfExists(seedPath) ?? [];
  return (Array.isArray(list) ? list : [])
    .map((item) => mapRule(item))
    .filter((item) => item.teacherId)
    .sort((left, right) => {
      if (left.teacherId !== right.teacherId) {
        return left.teacherId.localeCompare(right.teacherId, "zh-CN");
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

function mapDbRule(row: DbTeacherScheduleRule): TeacherScheduleRule {
  return {
    id: row.id,
    schoolId: normalizeSchoolId(row.school_id),
    teacherId: normalizeTeacherId(row.teacher_id),
    weeklyMaxLessons: normalizeOptionalInteger(row.weekly_max_lessons, { min: 1, max: 60 }),
    maxConsecutiveLessons: normalizeOptionalInteger(row.max_consecutive_lessons, { min: 1, max: 12 }),
    minCampusGapMinutes: normalizeOptionalInteger(row.min_campus_gap_minutes, { min: 1, max: 240, zeroAsUndefined: true }),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function writeStore(items: TeacherScheduleRule[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, FILE), JSON.stringify(items, null, 2));
}

async function syncStoreFromFileIfNeeded() {
  if (!isDbEnabled()) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const existing = await queryOne<{ id: string }>("SELECT id FROM teacher_schedule_rules LIMIT 1");
    if (existing) return;
    const fallback = readStore();
    for (const item of fallback) {
      await query(
        `INSERT INTO teacher_schedule_rules
         (id, school_id, teacher_id, weekly_max_lessons, max_consecutive_lessons, min_campus_gap_minutes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.schoolId,
          item.teacherId,
          item.weeklyMaxLessons ?? null,
          item.maxConsecutiveLessons ?? null,
          item.minCampusGapMinutes ?? null,
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

function validateRuleInput(input: {
  teacherId: string;
  weeklyMaxLessons?: number;
  maxConsecutiveLessons?: number;
  minCampusGapMinutes?: number;
}) {
  if (!normalizeTeacherId(input.teacherId)) {
    badRequest("teacherId required");
  }
  if (
    input.weeklyMaxLessons === undefined &&
    input.maxConsecutiveLessons === undefined &&
    input.minCampusGapMinutes === undefined
  ) {
    badRequest("至少配置一项教师排课规则");
  }
  if (
    input.weeklyMaxLessons !== undefined &&
    (!Number.isInteger(input.weeklyMaxLessons) || input.weeklyMaxLessons < 1 || input.weeklyMaxLessons > 60)
  ) {
    badRequest("weeklyMaxLessons must be between 1 and 60");
  }
  if (
    input.maxConsecutiveLessons !== undefined &&
    (!Number.isInteger(input.maxConsecutiveLessons) || input.maxConsecutiveLessons < 1 || input.maxConsecutiveLessons > 12)
  ) {
    badRequest("maxConsecutiveLessons must be between 1 and 12");
  }
  if (
    input.minCampusGapMinutes !== undefined &&
    (!Number.isInteger(input.minCampusGapMinutes) || input.minCampusGapMinutes < 1 || input.minCampusGapMinutes > 240)
  ) {
    badRequest("minCampusGapMinutes must be between 1 and 240");
  }
}

export function toMinutes(time: string) {
  if (!TIME_PATTERN.test(time)) {
    badRequest("time must be HH:mm");
  }
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function normalizeCampusKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function compareTeacherSessions(left: TeacherRuleSession, right: TeacherRuleSession) {
  if (left.weekday !== right.weekday) return left.weekday - right.weekday;
  if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
  if (left.endTime !== right.endTime) return left.endTime.localeCompare(right.endTime);
  return (left.id ?? "").localeCompare(right.id ?? "", "zh-CN");
}

function getMaxConsecutiveLessons(sessions: TeacherRuleSession[]) {
  if (!sessions.length) return 0;
  const sorted = sessions.slice().sort(compareTeacherSessions);
  let max = 1;
  let streak = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const gapMinutes = toMinutes(current.startTime) - toMinutes(previous.endTime);
    if (current.weekday === previous.weekday && gapMinutes <= CONSECUTIVE_GAP_MINUTES) {
      streak += 1;
      max = Math.max(max, streak);
      continue;
    }
    streak = 1;
  }
  return max;
}

function getSessionGapMinutes(left: Pick<TeacherRuleSession, "startTime" | "endTime">, right: Pick<TeacherRuleSession, "startTime" | "endTime">) {
  const leftStart = toMinutes(left.startTime);
  const leftEnd = toMinutes(left.endTime);
  const rightStart = toMinutes(right.startTime);
  const rightEnd = toMinutes(right.endTime);
  if (leftEnd <= rightStart) {
    return rightStart - leftEnd;
  }
  if (rightEnd <= leftStart) {
    return leftStart - rightEnd;
  }
  return -1;
}

export function findTeacherScheduleRuleViolation(
  rule: TeacherScheduleRule | null | undefined,
  sessions: TeacherRuleSession[],
  candidate: TeacherRuleSession,
  options?: { ignoreId?: string }
) {
  if (!rule) {
    return null;
  }

  const scopedSessions = sessions.filter((item) => item.id !== options?.ignoreId);

  if (rule.weeklyMaxLessons !== undefined && scopedSessions.length + 1 > rule.weeklyMaxLessons) {
    return `教师周课时上限冲突：最多 ${rule.weeklyMaxLessons} 节/周`;
  }

  if (
    rule.maxConsecutiveLessons !== undefined &&
    getMaxConsecutiveLessons([...scopedSessions, candidate]) > rule.maxConsecutiveLessons
  ) {
    return `教师连堂上限冲突：最多连续 ${rule.maxConsecutiveLessons} 节`;
  }

  if (rule.minCampusGapMinutes !== undefined) {
    const candidateCampusKey = normalizeCampusKey(candidate.campus);
    if (candidateCampusKey) {
      const crossCampusConflict = scopedSessions.find((item) => {
        if (item.weekday !== candidate.weekday) return false;
        const itemCampusKey = normalizeCampusKey(item.campus);
        if (!itemCampusKey || itemCampusKey === candidateCampusKey) return false;
        const gapMinutes = getSessionGapMinutes(item, candidate);
        return gapMinutes >= 0 && gapMinutes < rule.minCampusGapMinutes!;
      });
      if (crossCampusConflict) {
        return `教师跨校区时间冲突：需至少间隔 ${rule.minCampusGapMinutes} 分钟`;
      }
    }
  }

  return null;
}

export async function listTeacherScheduleRules(scope?: { schoolId?: string | null; teacherId?: string }) {
  if (!isDbEnabled()) {
    return readStore().filter((item) => {
      if (scope?.schoolId && normalizeSchoolId(item.schoolId) !== normalizeSchoolId(scope.schoolId)) return false;
      if (scope?.teacherId && item.teacherId !== scope.teacherId) return false;
      return true;
    });
  }

  await syncStoreFromFileIfNeeded();
  const rows = await query<DbTeacherScheduleRule>("SELECT * FROM teacher_schedule_rules ORDER BY updated_at DESC");
  return rows.map(mapDbRule).filter((item) => {
    if (scope?.schoolId && normalizeSchoolId(item.schoolId) !== normalizeSchoolId(scope.schoolId)) return false;
    if (scope?.teacherId && item.teacherId !== scope.teacherId) return false;
    return true;
  });
}

export async function getTeacherScheduleRule(scope: { schoolId?: string | null; teacherId: string }) {
  if (!isDbEnabled()) {
    return (
      readStore().find(
        (item) =>
          normalizeSchoolId(item.schoolId) === normalizeSchoolId(scope.schoolId) &&
          item.teacherId === scope.teacherId
      ) ?? null
    );
  }
  await syncStoreFromFileIfNeeded();
  const row = await queryOne<DbTeacherScheduleRule>(
    "SELECT * FROM teacher_schedule_rules WHERE school_id = $1 AND teacher_id = $2",
    [normalizeSchoolId(scope.schoolId), scope.teacherId]
  );
  return row ? mapDbRule(row) : null;
}

export async function saveTeacherScheduleRule(input: {
  id?: string;
  schoolId?: string | null;
  teacherId: string;
  weeklyMaxLessons?: number;
  maxConsecutiveLessons?: number;
  minCampusGapMinutes?: number;
}) {
  const schoolId = normalizeSchoolId(input.schoolId);
  const teacherId = normalizeTeacherId(input.teacherId);
  const weeklyMaxLessons = normalizeOptionalInteger(input.weeklyMaxLessons, { min: 1, max: 60 });
  const maxConsecutiveLessons = normalizeOptionalInteger(input.maxConsecutiveLessons, { min: 1, max: 12 });
  const minCampusGapMinutes = normalizeOptionalInteger(input.minCampusGapMinutes, { min: 1, max: 240, zeroAsUndefined: true });

  validateRuleInput({
    teacherId,
    weeklyMaxLessons,
    maxConsecutiveLessons,
    minCampusGapMinutes
  });

  const now = new Date().toISOString();
  if (isDbEnabled()) {
    await syncStoreFromFileIfNeeded();
    const previous = input.id
      ? await queryOne<DbTeacherScheduleRule>("SELECT * FROM teacher_schedule_rules WHERE id = $1", [input.id])
      : await queryOne<DbTeacherScheduleRule>(
          "SELECT * FROM teacher_schedule_rules WHERE school_id = $1 AND teacher_id = $2",
          [schoolId, teacherId]
        );
    const nextId = previous?.id ?? `trule-${crypto.randomBytes(6).toString("hex")}`;
    const row = await queryOne<DbTeacherScheduleRule>(
      `INSERT INTO teacher_schedule_rules
       (id, school_id, teacher_id, weekly_max_lessons, max_consecutive_lessons, min_campus_gap_minutes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (school_id, teacher_id) DO UPDATE
       SET weekly_max_lessons = EXCLUDED.weekly_max_lessons,
           max_consecutive_lessons = EXCLUDED.max_consecutive_lessons,
           min_campus_gap_minutes = EXCLUDED.min_campus_gap_minutes,
           updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        nextId,
        schoolId,
        teacherId,
        weeklyMaxLessons ?? null,
        maxConsecutiveLessons ?? null,
        minCampusGapMinutes ?? null,
        previous?.created_at ?? now,
        now
      ]
    );
    return row ? mapDbRule(row) : mapRule({
      id: nextId,
      schoolId,
      teacherId,
      weeklyMaxLessons,
      maxConsecutiveLessons,
      minCampusGapMinutes,
      createdAt: previous?.created_at ?? now,
      updatedAt: now
    });
  }

  const list = readStore();
  const existingByIdIndex = input.id ? list.findIndex((item) => item.id === input.id) : -1;
  const duplicateTeacherIndex = list.findIndex(
    (item) => item.schoolId === schoolId && item.teacherId === teacherId && item.id !== input.id
  );

  if (existingByIdIndex >= 0 && duplicateTeacherIndex >= 0) {
    badRequest("该教师已存在排课规则");
  }

  const existingIndex = existingByIdIndex >= 0 ? existingByIdIndex : duplicateTeacherIndex;
  const previous = existingIndex >= 0 ? list[existingIndex] : null;
  const next: TeacherScheduleRule = {
    id: previous?.id ?? `trule-${crypto.randomBytes(6).toString("hex")}`,
    schoolId,
    teacherId,
    weeklyMaxLessons,
    maxConsecutiveLessons,
    minCampusGapMinutes,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    list[existingIndex] = next;
  } else {
    list.push(next);
  }

  writeStore(list);
  return next;
}

export async function deleteTeacherScheduleRule(id: string, scope?: { schoolId?: string | null }) {
  if (!isDbEnabled()) {
    const list = readStore();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      notFound("teacher schedule rule not found");
    }
    const current = list[index];
    if (scope?.schoolId && normalizeSchoolId(current.schoolId) !== normalizeSchoolId(scope.schoolId)) {
      notFound("teacher schedule rule not found");
    }
    list.splice(index, 1);
    writeStore(list);
    return current;
  }

  await syncStoreFromFileIfNeeded();
  const current = await queryOne<DbTeacherScheduleRule>("SELECT * FROM teacher_schedule_rules WHERE id = $1", [id]);
  if (!current) {
    notFound("teacher schedule rule not found");
  }
  if (scope?.schoolId && normalizeSchoolId(current.school_id) !== normalizeSchoolId(scope.schoolId)) {
    notFound("teacher schedule rule not found");
  }
  await query("DELETE FROM teacher_schedule_rules WHERE id = $1", [id]);
  return mapDbRule(current);
}
