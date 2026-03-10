import crypto from "crypto";
import fs from "fs";
import path from "path";

export type AssignmentLessonTaskKind = "prestudy";

export type AssignmentLessonLink = {
  id: string;
  assignmentId: string;
  classId: string;
  scheduleSessionId: string;
  taskKind: AssignmentLessonTaskKind;
  teacherId: string;
  lessonDate: string;
  note?: string;
  publishLeadMinutes?: number;
  createdAt: string;
  updatedAt: string;
};

const FILE = "assignment-lesson-links.json";
const runtimeDir = path.resolve(process.cwd(), process.env.DATA_DIR ?? ".runtime-data");
const seedDir = path.resolve(process.cwd(), process.env.DATA_SEED_DIR ?? "data");

function normalizeText(value?: string | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizePositiveInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const next = Math.round(value);
  return next > 0 ? next : undefined;
}

function normalizeLessonDate(value: string) {
  const next = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(next)) return next;
  const parsed = new Date(next);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function mapLink(input: AssignmentLessonLink): AssignmentLessonLink {
  return {
    ...input,
    note: normalizeText(input.note),
    publishLeadMinutes: normalizePositiveInt(input.publishLeadMinutes),
    lessonDate: normalizeLessonDate(input.lessonDate)
  };
}

function readFileIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function compareLinks(left: AssignmentLessonLink, right: AssignmentLessonLink) {
  if (left.lessonDate !== right.lessonDate) return left.lessonDate.localeCompare(right.lessonDate);
  if (left.scheduleSessionId !== right.scheduleSessionId) {
    return left.scheduleSessionId.localeCompare(right.scheduleSessionId, "zh-CN");
  }
  return left.createdAt.localeCompare(right.createdAt);
}

function readStore() {
  const runtimePath = path.join(runtimeDir, FILE);
  const seedPath = path.join(seedDir, FILE);
  const list =
    readFileIfExists<AssignmentLessonLink[]>(runtimePath) ??
    readFileIfExists<AssignmentLessonLink[]>(seedPath) ??
    [];
  return list.map(mapLink).filter((item) => item.lessonDate).sort(compareLinks);
}

function writeStore(items: AssignmentLessonLink[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const filePath = path.join(runtimeDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(items.sort(compareLinks), null, 2));
}

export async function listAssignmentLessonLinks(scope?: {
  classId?: string;
  classIds?: string[];
  assignmentId?: string;
  assignmentIds?: string[];
  scheduleSessionId?: string;
  scheduleSessionIds?: string[];
  lessonDate?: string;
  taskKind?: AssignmentLessonTaskKind;
}) {
  const classIds = Array.isArray(scope?.classIds) ? new Set(scope.classIds) : null;
  const assignmentIds = Array.isArray(scope?.assignmentIds) ? new Set(scope.assignmentIds) : null;
  const sessionIds = Array.isArray(scope?.scheduleSessionIds) ? new Set(scope.scheduleSessionIds) : null;
  const normalizedLessonDate = scope?.lessonDate ? normalizeLessonDate(scope.lessonDate) : null;

  return readStore().filter((item) => {
    if (scope?.classId && item.classId !== scope.classId) return false;
    if (classIds && !classIds.has(item.classId)) return false;
    if (scope?.assignmentId && item.assignmentId !== scope.assignmentId) return false;
    if (assignmentIds && !assignmentIds.has(item.assignmentId)) return false;
    if (scope?.scheduleSessionId && item.scheduleSessionId !== scope.scheduleSessionId) return false;
    if (sessionIds && !sessionIds.has(item.scheduleSessionId)) return false;
    if (normalizedLessonDate && item.lessonDate !== normalizedLessonDate) return false;
    if (scope?.taskKind && item.taskKind !== scope.taskKind) return false;
    return true;
  });
}

export async function getAssignmentLessonLink(input: {
  scheduleSessionId: string;
  lessonDate: string;
  taskKind?: AssignmentLessonTaskKind;
}) {
  const taskKind = input.taskKind ?? "prestudy";
  const lessonDate = normalizeLessonDate(input.lessonDate);
  if (!lessonDate) return null;
  return (
    readStore().find(
      (item) =>
        item.scheduleSessionId === input.scheduleSessionId &&
        item.lessonDate === lessonDate &&
        item.taskKind === taskKind
    ) ?? null
  );
}

export async function upsertAssignmentLessonLink(input: {
  assignmentId: string;
  classId: string;
  scheduleSessionId: string;
  taskKind?: AssignmentLessonTaskKind;
  teacherId: string;
  lessonDate: string;
  note?: string;
  publishLeadMinutes?: number;
}) {
  const items = readStore();
  const taskKind = input.taskKind ?? "prestudy";
  const lessonDate = normalizeLessonDate(input.lessonDate);
  const now = new Date().toISOString();
  const index = items.findIndex(
    (item) =>
      item.scheduleSessionId === input.scheduleSessionId &&
      item.lessonDate === lessonDate &&
      item.taskKind === taskKind
  );
  const current = index >= 0 ? items[index] : null;
  const next: AssignmentLessonLink = {
    id: current?.id ?? `assign-link-${crypto.randomBytes(6).toString("hex")}`,
    assignmentId: input.assignmentId,
    classId: input.classId,
    scheduleSessionId: input.scheduleSessionId,
    taskKind,
    teacherId: input.teacherId,
    lessonDate,
    note: normalizeText(input.note),
    publishLeadMinutes: normalizePositiveInt(input.publishLeadMinutes),
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };

  if (index >= 0) {
    items[index] = next;
  } else {
    items.push(next);
  }

  writeStore(items);
  return next;
}
