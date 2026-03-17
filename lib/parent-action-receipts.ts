import crypto from "crypto";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";
import { readJson, writeJson } from "./storage";

export type ParentActionSource = "weekly_report" | "assignment_plan";
export type ParentActionStatus = "done" | "skipped";

export type ParentActionReceipt = {
  id: string;
  parentId: string;
  studentId: string;
  source: ParentActionSource;
  actionItemId: string;
  status: ParentActionStatus;
  note?: string | null;
  estimatedMinutes: number;
  effectScore: number;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentActionHistorySummary = {
  totalCount: number;
  doneCount: number;
  skippedCount: number;
  doneMinutes: number;
  avgEffectScore: number;
  last7dDoneCount: number;
  last7dSkippedCount: number;
  last7dEffectScore: number;
  streakDays: number;
  lastActionAt: string | null;
};

type DbParentActionReceipt = {
  id: string;
  parent_id: string;
  student_id: string;
  source: string;
  action_item_id: string;
  status: string;
  note: string | null;
  estimated_minutes: number;
  effect_score: number;
  completed_at: string;
  created_at: string;
  updated_at: string;
};

const FILE = "parent-action-receipts.json";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeSource(value: string | null | undefined): ParentActionSource {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "assignment_plan" ? "assignment_plan" : "weekly_report";
}

function normalizeStatus(value: string | null | undefined): ParentActionStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "skipped" ? "skipped" : "done";
}

function normalizeActionItemId(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeReceipt(item: ParentActionReceipt): ParentActionReceipt {
  return {
    ...item,
    source: normalizeSource(item.source),
    actionItemId: normalizeActionItemId(item.actionItemId),
    status: normalizeStatus(item.status),
    note: item.note ?? null,
    estimatedMinutes: clamp(item.estimatedMinutes, 0, 240),
    effectScore: clamp(item.effectScore, -100, 100)
  };
}

function mapDb(row: DbParentActionReceipt): ParentActionReceipt {
  return {
    id: row.id,
    parentId: row.parent_id,
    studentId: row.student_id,
    source: normalizeSource(row.source),
    actionItemId: normalizeActionItemId(row.action_item_id),
    status: normalizeStatus(row.status),
    note: row.note,
    estimatedMinutes: clamp(row.estimated_minutes, 0, 240),
    effectScore: clamp(row.effect_score, -100, 100),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function canUseApiTestParentActionReceiptFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireParentActionReceiptsDatabase() {
  requireDatabaseEnabled("parent_action_receipts");
}

export function buildParentActionReceiptKey(input: {
  source: ParentActionSource;
  actionItemId: string;
}) {
  return `${normalizeSource(input.source)}:${normalizeActionItemId(input.actionItemId)}`;
}

export async function listParentActionReceipts(params: {
  parentId: string;
  studentId: string;
  source?: ParentActionSource;
}) {
  const source = params.source ? normalizeSource(params.source) : undefined;

  if (canUseApiTestParentActionReceiptFallback()) {
    const list = readJson<ParentActionReceipt[]>(FILE, []).map(normalizeReceipt);
    return list
      .filter((item) => item.parentId === params.parentId && item.studentId === params.studentId)
      .filter((item) => (source ? item.source === source : true))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  requireParentActionReceiptsDatabase();
  const where = ["parent_id = $1", "student_id = $2"];
  const values: Array<string> = [params.parentId, params.studentId];
  if (source) {
    where.push(`lower(btrim(source)) = $${values.length + 1}`);
    values.push(source);
  }

  const rows = await query<DbParentActionReceipt>(
    `SELECT * FROM parent_action_receipts
     WHERE ${where.join(" AND ")}
     ORDER BY completed_at DESC`,
    values
  );
  return rows.map(mapDb);
}

export async function listParentActionReceiptsByStudents(params: {
  studentIds: string[];
  source?: ParentActionSource;
  status?: ParentActionStatus;
  since?: string;
  until?: string;
}) {
  const studentIds = Array.from(new Set((params.studentIds ?? []).map((item) => String(item).trim()).filter(Boolean)));
  const source = params.source ? normalizeSource(params.source) : undefined;
  const status = params.status ? normalizeStatus(params.status) : undefined;
  if (!studentIds.length) return [] as ParentActionReceipt[];

  if (canUseApiTestParentActionReceiptFallback()) {
    const studentSet = new Set(studentIds);
    const sinceTs = params.since ? new Date(params.since).getTime() : Number.NaN;
    const untilTs = params.until ? new Date(params.until).getTime() : Number.NaN;
    const list = readJson<ParentActionReceipt[]>(FILE, []).map(normalizeReceipt);
    return list
      .filter((item) => studentSet.has(item.studentId))
      .filter((item) => (source ? item.source === source : true))
      .filter((item) => (status ? item.status === status : true))
      .filter((item) => {
        const ts = new Date(item.completedAt).getTime();
        if (!Number.isFinite(ts)) return false;
        if (Number.isFinite(sinceTs) && ts < sinceTs) return false;
        if (Number.isFinite(untilTs) && ts > untilTs) return false;
        return true;
      })
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  requireParentActionReceiptsDatabase();
  const where = ["student_id = ANY($1)"];
  const values: Array<string | number | boolean | null | string[] | number[] | Record<string, any>> = [studentIds];

  if (source) {
    where.push(`lower(btrim(source)) = $${values.length + 1}`);
    values.push(source);
  }
  if (status) {
    where.push(`lower(btrim(status)) = $${values.length + 1}`);
    values.push(status);
  }
  if (params.since) {
    where.push(`completed_at >= $${values.length + 1}`);
    values.push(params.since);
  }
  if (params.until) {
    where.push(`completed_at <= $${values.length + 1}`);
    values.push(params.until);
  }

  const rows = await query<DbParentActionReceipt>(
    `SELECT * FROM parent_action_receipts
     WHERE ${where.join(" AND ")}
     ORDER BY completed_at DESC`,
    values
  );
  return rows.map(mapDb);
}

export async function upsertParentActionReceipt(input: {
  parentId: string;
  studentId: string;
  source: ParentActionSource;
  actionItemId: string;
  status?: ParentActionStatus;
  note?: string;
  estimatedMinutes?: number;
  effectScore?: number;
  completedAt?: string;
}) {
  const now = new Date().toISOString();
  const completedAt = input.completedAt ?? now;
  const source = normalizeSource(input.source);
  const actionItemId = normalizeActionItemId(input.actionItemId);
  const status = normalizeStatus(input.status ?? "done");
  const estimatedMinutes = clamp(input.estimatedMinutes ?? 0, 0, 240);
  const effectScore = clamp(input.effectScore ?? 0, -100, 100);
  // Upsert by (parent, student, source, actionItem) keeps one latest execution receipt per action card.

  if (canUseApiTestParentActionReceiptFallback()) {
    const list = readJson<ParentActionReceipt[]>(FILE, []).map(normalizeReceipt);
    const index = list.findIndex(
      (item) =>
        item.parentId === input.parentId &&
        item.studentId === input.studentId &&
        item.source === source &&
        item.actionItemId === actionItemId
    );
    const next: ParentActionReceipt = {
      id: index >= 0 ? list[index].id : `parent-action-${crypto.randomBytes(6).toString("hex")}`,
      parentId: input.parentId,
      studentId: input.studentId,
      source,
      actionItemId,
      status,
      note: input.note ?? null,
      estimatedMinutes,
      effectScore,
      completedAt,
      createdAt: index >= 0 ? list[index].createdAt : now,
      updatedAt: now
    };
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(FILE, list);
    return next;
  }

  requireParentActionReceiptsDatabase();
  const existing = await queryOne<DbParentActionReceipt>(
    `SELECT * FROM parent_action_receipts
     WHERE parent_id = $1 AND student_id = $2 AND lower(btrim(source)) = $3 AND lower(btrim(action_item_id)) = $4`,
    [input.parentId, input.studentId, source, actionItemId]
  );

  const row = existing
    ? await queryOne<DbParentActionReceipt>(
        `UPDATE parent_action_receipts
         SET source = $2,
             action_item_id = $3,
             status = $4,
             note = $5,
             estimated_minutes = $6,
             effect_score = $7,
             completed_at = $8,
             updated_at = $9
         WHERE id = $1
         RETURNING *`,
        [existing.id, source, actionItemId, status, input.note ?? null, estimatedMinutes, effectScore, completedAt, now]
      )
    : await queryOne<DbParentActionReceipt>(
        `INSERT INTO parent_action_receipts
          (id, parent_id, student_id, source, action_item_id, status, note, estimated_minutes, effect_score, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          `parent-action-${crypto.randomBytes(6).toString("hex")}`,
          input.parentId,
          input.studentId,
          source,
          actionItemId,
          status,
          input.note ?? null,
          estimatedMinutes,
          effectScore,
          completedAt,
          now,
          now
        ]
      );
  return row ? mapDb(row) : null;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function summarizeParentActionReceipts(
  receipts: ParentActionReceipt[],
  nowInput: Date = new Date()
): ParentActionHistorySummary {
  const doneCount = receipts.filter((item) => item.status === "done").length;
  const skippedCount = receipts.filter((item) => item.status === "skipped").length;
  const doneMinutes = receipts
    .filter((item) => item.status === "done")
    .reduce((sum, item) => sum + clamp(item.estimatedMinutes, 0, 240), 0);
  const effectTotal = receipts.reduce((sum, item) => sum + clamp(item.effectScore, -100, 100), 0);

  const now = new Date(nowInput);
  const start7d = new Date(now);
  start7d.setDate(start7d.getDate() - 6);
  start7d.setHours(0, 0, 0, 0);
  const start7dTs = start7d.getTime();

  const within7d = receipts.filter((item) => {
    const ts = new Date(item.completedAt).getTime();
    return Number.isFinite(ts) && ts >= start7dTs;
  });
  const last7dDoneCount = within7d.filter((item) => item.status === "done").length;
  const last7dSkippedCount = within7d.filter((item) => item.status === "skipped").length;
  const last7dEffectScore = within7d.reduce((sum, item) => sum + clamp(item.effectScore, -100, 100), 0);

  const doneDaySet = new Set(
    receipts
      .filter((item) => item.status === "done")
      .map((item) => new Date(item.completedAt))
      .filter((date) => Number.isFinite(date.getTime()))
      .map((date) => toDateKey(date))
  );
  let streakDays = 0;
  // Streak counts consecutive calendar days with at least one "done" receipt.
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (streakDays < 90) {
    const key = toDateKey(cursor);
    if (!doneDaySet.has(key)) {
      break;
    }
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalCount: receipts.length,
    doneCount,
    skippedCount,
    doneMinutes,
    avgEffectScore: receipts.length ? Math.round(effectTotal / receipts.length) : 0,
    last7dDoneCount,
    last7dSkippedCount,
    last7dEffectScore,
    streakDays,
    lastActionAt: receipts[0]?.completedAt ?? null
  };
}
