import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getClassById } from "./classes";
import { badRequest, conflict, notFound } from "./api/http";
import { DEFAULT_SCHOOL_ID } from "./schools";
import { listTeacherUnavailableSlots } from "./teacher-unavailability";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type LessonStatus = "finished" | "upcoming" | "in_progress";

export type ClassScheduleSession = {
  id: string;
  schoolId: string;
  classId: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  room?: string;
  campus?: string;
  note?: string;
  focusSummary?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassScheduleSessionInput = {
  classId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  room?: string;
  campus?: string;
  note?: string;
  focusSummary?: string;
};

export type ScheduleLessonBase = ClassScheduleSession & {
  className: string;
  subject: string;
  subjectLabel: string;
  grade: string;
  teacherId: string | null;
  teacherName?: string;
  weekdayLabel: string;
  moduleCount: number;
  pendingAssignmentCount: number;
  nextAssignmentId?: string;
  nextAssignmentTitle?: string;
  nextAssignmentDueAt?: string;
  actionHref?: string;
  actionLabel?: string;
};

export type ScheduleLessonOccurrence = ScheduleLessonBase & {
  date: string;
  startAt: string;
  endAt: string;
  status: LessonStatus;
};

export type ScheduleWeekDay = {
  weekday: Weekday;
  label: string;
  shortLabel: string;
  date: string;
  lessons: ScheduleLessonBase[];
};

export type ScheduleApiPayload = {
  generatedAt: string;
  role: "student" | "teacher" | "parent";
  summary: {
    classCount: number;
    scheduledClassCount: number;
    classesWithoutScheduleCount: number;
    totalLessonsToday: number;
    remainingLessonsToday: number;
    totalLessonsThisWeek: number;
  };
  nextLesson: ScheduleLessonOccurrence | null;
  todayLessons: ScheduleLessonOccurrence[];
  weekly: ScheduleWeekDay[];
};

export type ScheduleResponse = {
  data?: ScheduleApiPayload;
  error?: string;
};

export const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string; shortLabel: string }> = [
  { value: 1, label: "周一", shortLabel: "一" },
  { value: 2, label: "周二", shortLabel: "二" },
  { value: 3, label: "周三", shortLabel: "三" },
  { value: 4, label: "周四", shortLabel: "四" },
  { value: 5, label: "周五", shortLabel: "五" },
  { value: 6, label: "周六", shortLabel: "六" },
  { value: 7, label: "周日", shortLabel: "日" }
];

const FILE = "class-schedules.json";
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

function readFileIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function compareSessions(left: ClassScheduleSession, right: ClassScheduleSession) {
  if (left.weekday !== right.weekday) return left.weekday - right.weekday;
  if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
  if (left.endTime !== right.endTime) return left.endTime.localeCompare(right.endTime);
  return left.classId.localeCompare(right.classId, "zh-CN");
}

function mapSession(input: ClassScheduleSession): ClassScheduleSession {
  return {
    ...input,
    schoolId: normalizeSchoolId(input.schoolId),
    slotLabel: normalizeText(input.slotLabel),
    room: normalizeText(input.room),
    campus: normalizeText(input.campus),
    note: normalizeText(input.note),
    focusSummary: normalizeText(input.focusSummary)
  };
}

function readStore() {
  const runtimePath = path.join(runtimeDir, FILE);
  const seedPath = path.join(seedDir, FILE);
  const list = readFileIfExists<ClassScheduleSession[]>(runtimePath) ?? readFileIfExists<ClassScheduleSession[]>(seedPath) ?? [];
  return list.map(mapSession).sort(compareSessions);
}

function writeStore(items: ClassScheduleSession[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const filePath = path.join(runtimeDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(items.sort(compareSessions), null, 2));
}

function assertTimeValue(value: string, pathLabel: string) {
  if (!TIME_PATTERN.test(value)) {
    badRequest(`${pathLabel} must be HH:mm`);
  }
}

function assertWeekdayValue(value: number) {
  if (!WEEKDAY_OPTIONS.some((item) => item.value === value)) {
    badRequest("weekday must be between 1 and 7");
  }
}

function assertTimeRange(startTime: string, endTime: string) {
  assertTimeValue(startTime, "startTime");
  assertTimeValue(endTime, "endTime");
  if (startTime >= endTime) {
    badRequest("endTime must be later than startTime");
  }
}

function overlapsTimeRange(left: Pick<ClassScheduleSession, "startTime" | "endTime">, right: Pick<ClassScheduleSession, "startTime" | "endTime">) {
  return left.startTime < right.endTime && right.startTime < left.endTime;
}

function normalizeLocationKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function assertClassScheduleOverlap(items: ClassScheduleSession[], candidate: ClassScheduleSession, ignoreId?: string) {
  const classConflict = items.find(
    (item) =>
      item.id !== ignoreId &&
      item.classId === candidate.classId &&
      item.weekday === candidate.weekday &&
      overlapsTimeRange(item, candidate)
  );

  if (classConflict) {
    conflict("班级节次时间冲突");
  }
}

function createTeacherResolver() {
  const cache = new Map<string, Promise<string | null>>();
  return async (classId: string) => {
    if (!cache.has(classId)) {
      cache.set(
        classId,
        getClassById(classId).then((klass) => klass?.teacherId ?? null)
      );
    }
    return cache.get(classId)!;
  };
}

async function assertScheduleConstraints(
  items: ClassScheduleSession[],
  candidate: ClassScheduleSession,
  options?: { ignoreId?: string; teacherId?: string | null }
) {
  assertClassScheduleOverlap(items, candidate, options?.ignoreId);

  const roomKey = normalizeLocationKey(candidate.room);
  const campusKey = normalizeLocationKey(candidate.campus);
  if (roomKey) {
    const roomConflict = items.find(
      (item) =>
        item.id !== options?.ignoreId &&
        item.schoolId === candidate.schoolId &&
        item.weekday === candidate.weekday &&
        overlapsTimeRange(item, candidate) &&
        normalizeLocationKey(item.room) === roomKey &&
        normalizeLocationKey(item.campus) === campusKey
    );
    if (roomConflict) {
      conflict("教室时间冲突");
    }
  }

  if (!options?.teacherId) {
    return;
  }

  const resolveTeacherId = createTeacherResolver();
  for (const item of items) {
    if (item.id === options.ignoreId) continue;
    if (item.weekday !== candidate.weekday) continue;
    if (!overlapsTimeRange(item, candidate)) continue;
    const itemTeacherId = await resolveTeacherId(item.classId);
    if (itemTeacherId && itemTeacherId === options.teacherId) {
      conflict("教师时间冲突");
    }
  }

  const blockedSlots = await listTeacherUnavailableSlots({ schoolId: candidate.schoolId, teacherId: options.teacherId });
  const blocked = blockedSlots.find(
    (item) => item.weekday === candidate.weekday && overlapsTimeRange(item, candidate)
  );
  if (blocked) {
    conflict(`教师禁排时段冲突：${blocked.startTime}-${blocked.endTime}`);
  }
}

export function getWeekdayLabel(weekday: Weekday) {
  return WEEKDAY_OPTIONS.find((item) => item.value === weekday)?.label ?? `周${weekday}`;
}

export function getWeekdayShortLabel(weekday: Weekday) {
  return WEEKDAY_OPTIONS.find((item) => item.value === weekday)?.shortLabel ?? String(weekday);
}

export function getWeekdayFromDate(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

export function getDateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getStartOfWeek(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const weekday = getWeekdayFromDate(start);
  start.setDate(start.getDate() - (weekday - 1));
  return start;
}

export function buildWeekDays(baseDate = new Date()) {
  const start = getStartOfWeek(baseDate);
  return WEEKDAY_OPTIONS.map((item, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      weekday: item.value,
      label: item.label,
      shortLabel: item.shortLabel,
      date: getDateKey(date)
    };
  });
}

export function combineDateAndTime(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00`);
}

export async function listClassScheduleSessions(scope?: {
  schoolId?: string | null;
  classId?: string;
  classIds?: string[];
}) {
  const classIds = Array.isArray(scope?.classIds) ? new Set(scope?.classIds) : null;
  return readStore().filter((item) => {
    if (scope?.schoolId && normalizeSchoolId(item.schoolId) !== normalizeSchoolId(scope.schoolId)) {
      return false;
    }
    if (scope?.classId && item.classId !== scope.classId) {
      return false;
    }
    if (classIds && !classIds.has(item.classId)) {
      return false;
    }
    return true;
  });
}

export async function getClassScheduleSessionById(id: string) {
  return readStore().find((item) => item.id === id) ?? null;
}

export async function createClassScheduleSession(input: ClassScheduleSessionInput) {
  const klass = await getClassById(input.classId);
  if (!klass) {
    notFound("class not found");
  }

  assertWeekdayValue(input.weekday);
  assertTimeRange(input.startTime, input.endTime);

  const now = new Date().toISOString();
  const next: ClassScheduleSession = {
    id: `sched-${crypto.randomBytes(6).toString("hex")}`,
    schoolId: normalizeSchoolId(klass.schoolId),
    classId: input.classId,
    weekday: input.weekday as Weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    slotLabel: normalizeText(input.slotLabel),
    room: normalizeText(input.room),
    campus: normalizeText(input.campus),
    note: normalizeText(input.note),
    focusSummary: normalizeText(input.focusSummary),
    createdAt: now,
    updatedAt: now
  };

  const list = readStore();
  await assertScheduleConstraints(list, next, { teacherId: klass.teacherId ?? null });
  list.push(next);
  writeStore(list);
  return next;
}

export async function updateClassScheduleSession(
  id: string,
  input: {
    weekday?: number;
    startTime?: string;
    endTime?: string;
    slotLabel?: string;
    room?: string;
    campus?: string;
    note?: string;
    focusSummary?: string;
  }
) {
  const list = readStore();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }

  const current = list[index];
  const weekday = input.weekday === undefined ? current.weekday : (input.weekday as Weekday);
  assertWeekdayValue(weekday);

  const startTime = input.startTime ?? current.startTime;
  const endTime = input.endTime ?? current.endTime;
  assertTimeRange(startTime, endTime);

  const next: ClassScheduleSession = {
    ...current,
    weekday,
    startTime,
    endTime,
    slotLabel: input.slotLabel === undefined ? current.slotLabel : normalizeText(input.slotLabel),
    room: input.room === undefined ? current.room : normalizeText(input.room),
    campus: input.campus === undefined ? current.campus : normalizeText(input.campus),
    note: input.note === undefined ? current.note : normalizeText(input.note),
    focusSummary: input.focusSummary === undefined ? current.focusSummary : normalizeText(input.focusSummary),
    updatedAt: new Date().toISOString()
  };

  const klass = await getClassById(current.classId);
  if (!klass) {
    notFound("class not found");
  }
  await assertScheduleConstraints(list, next, { ignoreId: id, teacherId: klass.teacherId ?? null });
  list[index] = next;
  writeStore(list);
  return next;
}

export async function applyClassSchedulePlan(input: {
  items: ClassScheduleSessionInput[];
  replaceClassIds?: string[];
  schoolId?: string | null;
}) {
  const replaceSet = new Set((input.replaceClassIds ?? []).filter(Boolean));
  const nextList = readStore().filter((item) => {
    if (input.schoolId && normalizeSchoolId(item.schoolId) !== normalizeSchoolId(input.schoolId)) {
      return true;
    }
    return !replaceSet.has(item.classId);
  });

  const created: ClassScheduleSession[] = [];
  for (const draft of input.items) {
    const klass = await getClassById(draft.classId);
    if (!klass) {
      notFound(`class not found: ${draft.classId}`);
    }

    assertWeekdayValue(draft.weekday);
    assertTimeRange(draft.startTime, draft.endTime);

    const now = new Date().toISOString();
    const next: ClassScheduleSession = {
      id: `sched-${crypto.randomBytes(6).toString("hex")}`,
      schoolId: normalizeSchoolId(klass.schoolId),
      classId: draft.classId,
      weekday: draft.weekday as Weekday,
      startTime: draft.startTime,
      endTime: draft.endTime,
      slotLabel: normalizeText(draft.slotLabel),
      room: normalizeText(draft.room),
      campus: normalizeText(draft.campus),
      note: normalizeText(draft.note),
      focusSummary: normalizeText(draft.focusSummary),
      createdAt: now,
      updatedAt: now
    };

    await assertScheduleConstraints([...nextList, ...created], next, { teacherId: klass.teacherId ?? null });
    created.push(next);
  }

  writeStore([...nextList, ...created]);
  return created.sort(compareSessions);
}

export async function deleteClassScheduleSession(id: string, scope?: { schoolId?: string | null }) {
  const list = readStore();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }

  const current = list[index];
  if (scope?.schoolId && normalizeSchoolId(current.schoolId) !== normalizeSchoolId(scope.schoolId)) {
    return null;
  }

  list.splice(index, 1);
  writeStore(list);
  return current;
}
