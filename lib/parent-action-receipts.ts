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
