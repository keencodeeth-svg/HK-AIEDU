import crypto from "crypto";
import fs from "fs";
import path from "path";
import { badRequest, notFound } from "./api/http";
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
    reason: normalizeText(item.reason)
  })) as TeacherUnavailableSlot[];
}

function writeStore(items: TeacherUnavailableSlot[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, FILE), JSON.stringify(items, null, 2));
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
  return readStore().filter((item) => {
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

export async function deleteTeacherUnavailableSlot(id: string, scope?: { schoolId?: string | null }) {
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
