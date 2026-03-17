import crypto from "crypto";
import fs from "fs";
import path from "path";
import { badRequest, notFound } from "./api/http";
import { isDbEnabled, query, queryOne } from "./db";
import { DEFAULT_SCHOOL_ID } from "./schools";
import type { Weekday } from "./class-schedules";

export type SchoolScheduleTemplate = {
  id: string;
  schoolId: string;
  grade: string;
  subject: string;
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: Weekday[];
  dayStartTime: string;
  shortBreakMinutes: number;
  lunchBreakAfterPeriod?: number;
  lunchBreakMinutes: number;
  campus?: string;
  createdAt: string;
  updatedAt: string;
};

const FILE = "school-schedule-templates.json";
const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
let syncPromise: Promise<void> | null = null;

type DbSchoolScheduleTemplate = {
  id: string;
  school_id: string | null;
  grade: string;
  subject: string;
  weekly_lessons_per_class: number;
  lesson_duration_minutes: number;
  periods_per_day: number;
  weekdays: number[] | null;
  day_start_time: string;
  short_break_minutes: number;
  lunch_break_after_period: number | null;
  lunch_break_minutes: number;
  campus: string | null;
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
    campus: normalizeText(item.campus)
  })) as SchoolScheduleTemplate[];
}

function mapDbTemplate(row: DbSchoolScheduleTemplate): SchoolScheduleTemplate {
  return {
    id: row.id,
    schoolId: normalizeSchoolId(row.school_id),
    grade: row.grade,
    subject: row.subject,
    weeklyLessonsPerClass: row.weekly_lessons_per_class,
    lessonDurationMinutes: row.lesson_duration_minutes,
    periodsPerDay: row.periods_per_day,
    weekdays: Array.isArray(row.weekdays) ? row.weekdays.map((item) => Number(item)).filter((item) => item >= 1 && item <= 7) as Weekday[] : [],
    dayStartTime: row.day_start_time,
    shortBreakMinutes: row.short_break_minutes,
    lunchBreakAfterPeriod: row.lunch_break_after_period ?? undefined,
    lunchBreakMinutes: row.lunch_break_minutes,
    campus: normalizeText(row.campus),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  };
}

function writeStore(items: SchoolScheduleTemplate[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, FILE), JSON.stringify(items, null, 2));
}

async function syncStoreFromFileIfNeeded() {
  if (!isDbEnabled()) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const existing = await queryOne<{ id: string }>("SELECT id FROM school_schedule_templates LIMIT 1");
    if (existing) return;
    const fallback = readStore();
    for (const item of fallback) {
      await query(
        `INSERT INTO school_schedule_templates
         (id, school_id, grade, subject, weekly_lessons_per_class, lesson_duration_minutes, periods_per_day, weekdays, day_start_time, short_break_minutes, lunch_break_after_period, lunch_break_minutes, campus, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.schoolId,
          item.grade,
          item.subject,
          item.weeklyLessonsPerClass,
          item.lessonDurationMinutes,
          item.periodsPerDay,
          JSON.stringify(item.weekdays),
          item.dayStartTime,
          item.shortBreakMinutes,
          item.lunchBreakAfterPeriod ?? null,
          item.lunchBreakMinutes,
          item.campus ?? null,
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

function assertTimeValue(value: string, label: string) {
  if (!TIME_PATTERN.test(value)) {
    badRequest(`${label} must be HH:mm`);
  }
}

function assertWeekdays(weekdays: number[]) {
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    badRequest("weekdays required");
  }
  weekdays.forEach((value) => {
    if (!Number.isInteger(value) || value < 1 || value > 7) {
      badRequest("weekday must be between 1 and 7");
    }
  });
}

function validateTemplateInput(input: {
  grade: string;
  subject: string;
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: number[];
  dayStartTime: string;
  shortBreakMinutes: number;
  lunchBreakMinutes: number;
  lunchBreakAfterPeriod?: number;
}) {
  if (!input.grade.trim()) badRequest("grade required");
  if (!input.subject.trim()) badRequest("subject required");
  if (!Number.isInteger(input.weeklyLessonsPerClass) || input.weeklyLessonsPerClass < 1 || input.weeklyLessonsPerClass > 30) {
    badRequest("weeklyLessonsPerClass must be between 1 and 30");
  }
  if (!Number.isInteger(input.lessonDurationMinutes) || input.lessonDurationMinutes < 30 || input.lessonDurationMinutes > 120) {
    badRequest("lessonDurationMinutes must be between 30 and 120");
  }
  if (!Number.isInteger(input.periodsPerDay) || input.periodsPerDay < 1 || input.periodsPerDay > 12) {
    badRequest("periodsPerDay must be between 1 and 12");
  }
  if (!Number.isInteger(input.shortBreakMinutes) || input.shortBreakMinutes < 0 || input.shortBreakMinutes > 30) {
    badRequest("shortBreakMinutes must be between 0 and 30");
  }
  if (!Number.isInteger(input.lunchBreakMinutes) || input.lunchBreakMinutes < 0 || input.lunchBreakMinutes > 180) {
    badRequest("lunchBreakMinutes must be between 0 and 180");
  }
  if (input.lunchBreakAfterPeriod !== undefined && (!Number.isInteger(input.lunchBreakAfterPeriod) || input.lunchBreakAfterPeriod < 1 || input.lunchBreakAfterPeriod > 12)) {
    badRequest("lunchBreakAfterPeriod must be between 1 and 12");
  }
  assertWeekdays(input.weekdays);
  assertTimeValue(input.dayStartTime, "dayStartTime");
}

export async function listSchoolScheduleTemplates(scope?: { schoolId?: string | null }) {
  if (!isDbEnabled()) {
    return readStore()
      .filter((item) => !scope?.schoolId || normalizeSchoolId(item.schoolId) === normalizeSchoolId(scope.schoolId))
      .sort((left, right) => {
        if (left.grade !== right.grade) return left.grade.localeCompare(right.grade, "zh-CN");
        return left.subject.localeCompare(right.subject, "zh-CN");
      });
  }

  await syncStoreFromFileIfNeeded();
  const rows = await query<DbSchoolScheduleTemplate>("SELECT * FROM school_schedule_templates");
  return rows
    .map(mapDbTemplate)
    .filter((item) => !scope?.schoolId || normalizeSchoolId(item.schoolId) === normalizeSchoolId(scope.schoolId))
    .sort((left, right) => {
      if (left.grade !== right.grade) return left.grade.localeCompare(right.grade, "zh-CN");
      return left.subject.localeCompare(right.subject, "zh-CN");
    });
}

export async function getScheduleTemplateByGradeSubject(input: { schoolId?: string | null; grade: string; subject: string }) {
  const schoolId = normalizeSchoolId(input.schoolId);
  return (await listSchoolScheduleTemplates({ schoolId })).find(
    (item) => item.grade === input.grade && item.subject === input.subject
  ) ?? null;
}

export async function saveSchoolScheduleTemplate(input: {
  id?: string;
  schoolId?: string | null;
  grade: string;
  subject: string;
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: number[];
  dayStartTime: string;
  shortBreakMinutes: number;
  lunchBreakAfterPeriod?: number;
  lunchBreakMinutes: number;
  campus?: string;
}) {
  validateTemplateInput(input);
  const schoolId = normalizeSchoolId(input.schoolId);
  const weekdays = Array.from(new Set(input.weekdays)).sort((left, right) => left - right) as Weekday[];
  const now = new Date().toISOString();
  if (isDbEnabled()) {
    await syncStoreFromFileIfNeeded();
    const previous = input.id
      ? await queryOne<DbSchoolScheduleTemplate>("SELECT * FROM school_schedule_templates WHERE id = $1", [input.id])
      : await queryOne<DbSchoolScheduleTemplate>(
          "SELECT * FROM school_schedule_templates WHERE school_id = $1 AND grade = $2 AND subject = $3",
          [schoolId, input.grade.trim(), input.subject.trim()]
        );
    const nextId = previous?.id ?? `stpl-${crypto.randomBytes(6).toString("hex")}`;
    const row = await queryOne<DbSchoolScheduleTemplate>(
      `INSERT INTO school_schedule_templates
       (id, school_id, grade, subject, weekly_lessons_per_class, lesson_duration_minutes, periods_per_day, weekdays, day_start_time, short_break_minutes, lunch_break_after_period, lunch_break_minutes, campus, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (school_id, grade, subject) DO UPDATE
       SET weekly_lessons_per_class = EXCLUDED.weekly_lessons_per_class,
           lesson_duration_minutes = EXCLUDED.lesson_duration_minutes,
           periods_per_day = EXCLUDED.periods_per_day,
           weekdays = EXCLUDED.weekdays,
           day_start_time = EXCLUDED.day_start_time,
           short_break_minutes = EXCLUDED.short_break_minutes,
           lunch_break_after_period = EXCLUDED.lunch_break_after_period,
           lunch_break_minutes = EXCLUDED.lunch_break_minutes,
           campus = EXCLUDED.campus,
           updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        nextId,
        schoolId,
        input.grade.trim(),
        input.subject.trim(),
        input.weeklyLessonsPerClass,
        input.lessonDurationMinutes,
        input.periodsPerDay,
        JSON.stringify(weekdays),
        input.dayStartTime,
        input.shortBreakMinutes,
        input.lunchBreakAfterPeriod ?? null,
        input.lunchBreakMinutes,
        normalizeText(input.campus) ?? null,
        previous?.created_at ?? now,
        now
      ]
    );
    return row ? mapDbTemplate(row) : null;
  }

  const list = readStore();
  const existingIndex = list.findIndex(
    (item) =>
      (input.id ? item.id === input.id : false) ||
      (item.schoolId === schoolId && item.grade === input.grade && item.subject === input.subject)
  );

  const next: SchoolScheduleTemplate = {
    id: existingIndex >= 0 ? list[existingIndex].id : `stpl-${crypto.randomBytes(6).toString("hex")}`,
    schoolId,
    grade: input.grade.trim(),
    subject: input.subject.trim(),
    weeklyLessonsPerClass: input.weeklyLessonsPerClass,
    lessonDurationMinutes: input.lessonDurationMinutes,
    periodsPerDay: input.periodsPerDay,
    weekdays,
    dayStartTime: input.dayStartTime,
    shortBreakMinutes: input.shortBreakMinutes,
    lunchBreakAfterPeriod: input.lunchBreakAfterPeriod,
    lunchBreakMinutes: input.lunchBreakMinutes,
    campus: normalizeText(input.campus),
    createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : now,
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

export async function deleteSchoolScheduleTemplate(id: string, scope?: { schoolId?: string | null }) {
  if (!isDbEnabled()) {
    const list = readStore();
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      notFound("schedule template not found");
    }
    const current = list[index];
    if (scope?.schoolId && normalizeSchoolId(current.schoolId) !== normalizeSchoolId(scope.schoolId)) {
      notFound("schedule template not found");
    }
    list.splice(index, 1);
    writeStore(list);
    return current;
  }

  await syncStoreFromFileIfNeeded();
  const current = await queryOne<DbSchoolScheduleTemplate>("SELECT * FROM school_schedule_templates WHERE id = $1", [id]);
  if (!current) {
    notFound("schedule template not found");
  }
  if (scope?.schoolId && normalizeSchoolId(current.school_id) !== normalizeSchoolId(scope.schoolId)) {
    notFound("schedule template not found");
  }
  await query("DELETE FROM school_schedule_templates WHERE id = $1", [id]);
  return mapDbTemplate(current);
}
