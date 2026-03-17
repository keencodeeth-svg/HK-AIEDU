import crypto from "crypto";
import fs from "fs";
import path from "path";
import { isDbEnabled, query, queryOne } from "./db";

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
let syncPromise: Promise<void> | null = null;

type DbAssignmentLessonLink = {
  id: string;
  assignment_id: string;
  class_id: string;
  schedule_session_id: string;
  task_kind: AssignmentLessonTaskKind;
  teacher_id: string;
  lesson_date: string;
  note: string | null;
  publish_lead_minutes: number | null;
  created_at: string;
  updated_at: string;
};

function normalizeText(value?: string | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizePositiveInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const next = Math.round(value);
  return next > 0 ? next : undefined;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return "";
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

function mapDbLink(row: DbAssignmentLessonLink): AssignmentLessonLink {
  return mapLink({
    id: row.id,
    assignmentId: row.assignment_id,
    classId: row.class_id,
    scheduleSessionId: row.schedule_session_id,
    taskKind: row.task_kind,
    teacherId: row.teacher_id,
    lessonDate: row.lesson_date,
    note: row.note ?? undefined,
    publishLeadMinutes: row.publish_lead_minutes ?? undefined,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at)
  });
}

function writeStore(items: AssignmentLessonLink[]) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const filePath = path.join(runtimeDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(items.sort(compareLinks), null, 2));
}

async function syncStoreFromFileIfNeeded() {
  if (!isDbEnabled()) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const existing = await queryOne<{ id: string }>("SELECT id FROM assignment_lesson_links LIMIT 1");
    if (existing) return;
    const fallback = readStore();
    for (const item of fallback) {
      await query(
        `INSERT INTO assignment_lesson_links
         (id, assignment_id, class_id, schedule_session_id, task_kind, teacher_id, lesson_date, note, publish_lead_minutes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.assignmentId,
          item.classId,
          item.scheduleSessionId,
          item.taskKind,
          item.teacherId,
          item.lessonDate,
          item.note ?? null,
          item.publishLeadMinutes ?? null,
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

  if (!isDbEnabled()) {
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

  await syncStoreFromFileIfNeeded();
  const rows = await query<DbAssignmentLessonLink>("SELECT * FROM assignment_lesson_links ORDER BY lesson_date ASC, created_at ASC");
  return rows.map(mapDbLink).filter((item) => {
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
  if (!isDbEnabled()) {
    return (
      readStore().find(
        (item) =>
          item.scheduleSessionId === input.scheduleSessionId &&
          item.lessonDate === lessonDate &&
          item.taskKind === taskKind
      ) ?? null
    );
  }
  await syncStoreFromFileIfNeeded();
  const row = await queryOne<DbAssignmentLessonLink>(
    `SELECT * FROM assignment_lesson_links
     WHERE schedule_session_id = $1 AND lesson_date = $2 AND task_kind = $3`,
    [input.scheduleSessionId, lessonDate, taskKind]
  );
  return row ? mapDbLink(row) : null;
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
  const taskKind = input.taskKind ?? "prestudy";
  const lessonDate = normalizeLessonDate(input.lessonDate);
  const now = new Date().toISOString();
  if (isDbEnabled()) {
    await syncStoreFromFileIfNeeded();
    const current = await queryOne<DbAssignmentLessonLink>(
      `SELECT * FROM assignment_lesson_links
       WHERE schedule_session_id = $1 AND lesson_date = $2 AND task_kind = $3`,
      [input.scheduleSessionId, lessonDate, taskKind]
    );
    const nextId = current?.id ?? `assign-link-${crypto.randomBytes(6).toString("hex")}`;
    const row = await queryOne<DbAssignmentLessonLink>(
      `INSERT INTO assignment_lesson_links
       (id, assignment_id, class_id, schedule_session_id, task_kind, teacher_id, lesson_date, note, publish_lead_minutes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (schedule_session_id, lesson_date, task_kind) DO UPDATE
       SET assignment_id = EXCLUDED.assignment_id,
           class_id = EXCLUDED.class_id,
           teacher_id = EXCLUDED.teacher_id,
           note = EXCLUDED.note,
           publish_lead_minutes = EXCLUDED.publish_lead_minutes,
           updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        nextId,
        input.assignmentId,
        input.classId,
        input.scheduleSessionId,
        taskKind,
        input.teacherId,
        lessonDate,
        normalizeText(input.note) ?? null,
        normalizePositiveInt(input.publishLeadMinutes) ?? null,
        current?.created_at ?? now,
        now
      ]
    );
    return row ? mapDbLink(row) : null;
  }

  const items = readStore();
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
