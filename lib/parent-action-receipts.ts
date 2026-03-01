import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
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

function normalizeSource(value: string): ParentActionSource {
  return value === "assignment_plan" ? "assignment_plan" : "weekly_report";
}

function normalizeStatus(value: string): ParentActionStatus {
  return value === "skipped" ? "skipped" : "done";
}

function mapDb(row: DbParentActionReceipt): ParentActionReceipt {
  return {
    id: row.id,
    parentId: row.parent_id,
    studentId: row.student_id,
    source: normalizeSource(row.source),
    actionItemId: row.action_item_id,
    status: normalizeStatus(row.status),
    note: row.note,
    estimatedMinutes: clamp(row.estimated_minutes, 0, 240),
    effectScore: clamp(row.effect_score, -100, 100),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function buildParentActionReceiptKey(input: {
  source: ParentActionSource;
  actionItemId: string;
}) {
  return `${input.source}:${input.actionItemId}`;
}

export async function listParentActionReceipts(params: {
  parentId: string;
  studentId: string;
  source?: ParentActionSource;
}) {
  if (!isDbEnabled()) {
    const list = readJson<ParentActionReceipt[]>(FILE, []);
    return list
      .filter((item) => item.parentId === params.parentId && item.studentId === params.studentId)
      .filter((item) => (params.source ? item.source === params.source : true))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  const where = ["parent_id = $1", "student_id = $2"];
  const values: Array<string> = [params.parentId, params.studentId];
  if (params.source) {
    where.push(`source = $${values.length + 1}`);
    values.push(params.source);
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
  const status = input.status ?? "done";
  const estimatedMinutes = clamp(input.estimatedMinutes ?? 0, 0, 240);
  const effectScore = clamp(input.effectScore ?? 0, -100, 100);
  // Upsert by (parent, student, source, actionItem) keeps one latest execution receipt per action card.

  if (!isDbEnabled()) {
    const list = readJson<ParentActionReceipt[]>(FILE, []);
    const index = list.findIndex(
      (item) =>
        item.parentId === input.parentId &&
        item.studentId === input.studentId &&
        item.source === input.source &&
        item.actionItemId === input.actionItemId
    );
    const next: ParentActionReceipt = {
      id: index >= 0 ? list[index].id : `parent-action-${crypto.randomBytes(6).toString("hex")}`,
      parentId: input.parentId,
      studentId: input.studentId,
      source: input.source,
      actionItemId: input.actionItemId,
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

  const existing = await queryOne<DbParentActionReceipt>(
    `SELECT * FROM parent_action_receipts
     WHERE parent_id = $1 AND student_id = $2 AND source = $3 AND action_item_id = $4`,
    [input.parentId, input.studentId, input.source, input.actionItemId]
  );

  const row = await queryOne<DbParentActionReceipt>(
    `INSERT INTO parent_action_receipts
      (id, parent_id, student_id, source, action_item_id, status, note, estimated_minutes, effect_score, completed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (parent_id, student_id, source, action_item_id) DO UPDATE SET
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       estimated_minutes = EXCLUDED.estimated_minutes,
       effect_score = EXCLUDED.effect_score,
       completed_at = EXCLUDED.completed_at,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      existing?.id ?? `parent-action-${crypto.randomBytes(6).toString("hex")}`,
      input.parentId,
      input.studentId,
      input.source,
      input.actionItemId,
      status,
      input.note ?? null,
      estimatedMinutes,
      effectScore,
      completedAt,
      existing?.created_at ?? now,
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
