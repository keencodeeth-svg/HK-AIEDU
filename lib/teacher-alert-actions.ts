import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type TeacherAlertActionType = "assign_review" | "notify_student" | "auto_chain" | "mark_done";

export type TeacherAlertAction = {
  id: string;
  teacherId: string;
  alertId: string;
  actionType: TeacherAlertActionType;
  detail?: string | null;
  createdAt: string;
};

const ALERT_ACTION_FILE = "teacher-alert-actions.json";

type DbAlertAction = {
  id: string;
  teacher_id: string;
  alert_id: string;
  action_type: string;
  detail: string | null;
  created_at: string;
};

function toActionType(value: string): TeacherAlertActionType {
  if (value === "assign_review") return value;
  if (value === "notify_student") return value;
  if (value === "auto_chain") return value;
  return "mark_done";
}

function mapAction(row: DbAlertAction): TeacherAlertAction {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    alertId: row.alert_id,
    actionType: toActionType(row.action_type),
    detail: row.detail,
    createdAt: row.created_at
  };
}

export async function getTeacherAlertActions(teacherId: string) {
  if (!isDbEnabled()) {
    const list = readJson<TeacherAlertAction[]>(ALERT_ACTION_FILE, []);
    return list
      .filter((item) => item.teacherId === teacherId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await query<DbAlertAction>(
    "SELECT * FROM teacher_alert_actions WHERE teacher_id = $1 ORDER BY created_at DESC",
    [teacherId]
  );
  return rows.map(mapAction);
}

export async function upsertTeacherAlertAction(params: {
  teacherId: string;
  alertId: string;
  actionType: TeacherAlertActionType;
  detail?: string;
}) {
  const now = new Date().toISOString();
  if (!isDbEnabled()) {
    const list = readJson<TeacherAlertAction[]>(ALERT_ACTION_FILE, []);
    const index = list.findIndex(
      (item) => item.teacherId === params.teacherId && item.alertId === params.alertId
    );
    const next: TeacherAlertAction = {
      id: index >= 0 ? list[index].id : `alert-action-${crypto.randomBytes(6).toString("hex")}`,
      teacherId: params.teacherId,
      alertId: params.alertId,
      actionType: params.actionType,
      detail: params.detail ?? null,
      createdAt: now
    };
    if (index >= 0) {
      list[index] = next;
    } else {
      list.push(next);
    }
    writeJson(ALERT_ACTION_FILE, list);
    return next;
  }

  const existing = await queryOne<DbAlertAction>(
    "SELECT * FROM teacher_alert_actions WHERE teacher_id = $1 AND alert_id = $2",
    [params.teacherId, params.alertId]
  );

  const row = await queryOne<DbAlertAction>(
    `INSERT INTO teacher_alert_actions (id, teacher_id, alert_id, action_type, detail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (teacher_id, alert_id) DO UPDATE SET
       action_type = EXCLUDED.action_type,
       detail = EXCLUDED.detail,
       created_at = EXCLUDED.created_at
     RETURNING *`,
    [
      existing?.id ?? `alert-action-${crypto.randomBytes(6).toString("hex")}`,
      params.teacherId,
      params.alertId,
      params.actionType,
      params.detail ?? null,
      now
    ]
  );
  return row ? mapAction(row) : null;
}
