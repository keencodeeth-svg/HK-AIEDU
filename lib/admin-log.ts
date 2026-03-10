import crypto from "crypto";
import { readJson, updateJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type AdminLog = {
  id: string;
  adminId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: string | null;
  createdAt: string;
};

type AdminLogMutation = Partial<Pick<AdminLog, "adminId" | "action" | "entityType" | "entityId" | "detail">>;

const LOG_FILE = "admin-logs.json";

type DbLog = {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
};

function mapLog(row: DbLog): AdminLog {
  return {
    id: row.id,
    adminId: row.admin_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    detail: row.detail,
    createdAt: row.created_at
  };
}

export async function addAdminLog(log: Omit<AdminLog, "id" | "createdAt">) {
  const entry: AdminLog = {
    id: `log-${crypto.randomBytes(6).toString("hex")}`,
    createdAt: new Date().toISOString(),
    ...log
  };

  if (!isDbEnabled()) {
    await updateJson<AdminLog[]>(LOG_FILE, [], (list) => {
      list.unshift(entry);
      return list.slice(0, 200);
    });
    return entry;
  }

  await query(
    `INSERT INTO admin_logs (id, admin_id, action, entity_type, entity_id, detail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.id,
      entry.adminId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.detail ?? null,
      entry.createdAt
    ]
  );
  return entry;
}

export async function getAdminLogs(limit = 100) {
  if (!isDbEnabled()) {
    const list = readJson<AdminLog[]>(LOG_FILE, []);
    return list.slice(0, limit);
  }
  const rows = await query<DbLog>(
    "SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows.map(mapLog);
}

export async function getAdminLogById(id: string) {
  if (!isDbEnabled()) {
    const list = readJson<AdminLog[]>(LOG_FILE, []);
    return list.find((item) => item.id === id) ?? null;
  }
  const row = await queryOne<DbLog>("SELECT * FROM admin_logs WHERE id = $1", [id]);
  return row ? mapLog(row) : null;
}

export async function updateAdminLog(id: string, updates: AdminLogMutation) {
  const current = await getAdminLogById(id);
  if (!current) return null;

  const next: AdminLog = {
    ...current,
    adminId: updates.adminId !== undefined ? updates.adminId : current.adminId,
    action: updates.action ?? current.action,
    entityType: updates.entityType ?? current.entityType,
    entityId: updates.entityId !== undefined ? updates.entityId : current.entityId,
    detail: updates.detail !== undefined ? updates.detail : current.detail
  };

  if (!isDbEnabled()) {
    await updateJson<AdminLog[]>(LOG_FILE, [], (list) =>
      list.map((item) => (item.id === id ? next : item)).slice(0, 200)
    );
    return next;
  }

  const row = await queryOne<DbLog>(
    `UPDATE admin_logs
     SET admin_id = $2, action = $3, entity_type = $4, entity_id = $5, detail = $6
     WHERE id = $1
     RETURNING *`,
    [next.id, next.adminId, next.action, next.entityType, next.entityId ?? null, next.detail ?? null]
  );

  return row ? mapLog(row) : next;
}
