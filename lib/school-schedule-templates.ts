import crypto from "crypto";
import fs from "fs";
import path from "path";
import { badRequest, notFound } from "./api/http";
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

function normalizeSchoolId(value?: string | null) {
  return value?.trim() || DEFAULT_SCHOOL_ID;
}

function normalizeText(value?: string | null) {
  const next = value?.trim();
  return next ? next : undefined;
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

function writeStore(items: SchoolScheduleTemplate[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, FILE), JSON.stringify(items, null, 2));
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
  return readStore()
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
  const list = readStore();
  const now = new Date().toISOString();
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
    weekdays: Array.from(new Set(input.weekdays)).sort((left, right) => left - right) as Weekday[],
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
