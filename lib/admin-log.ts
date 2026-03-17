import crypto from "crypto";
import { readJson, updateJson } from "./storage";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";

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

export type AdminLogQueryOptions = {
  limit?: number;
  action?: string | null;
  entityType?: string | null;
  query?: string | null;
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

function canUseApiTestAdminLogFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireAdminLogDatabase() {
  requireDatabaseEnabled("admin_logs");
}

export async function addAdminLog(log: Omit<AdminLog, "id" | "createdAt">) {
  const entry: AdminLog = {
    id: `log-${crypto.randomBytes(6).toString("hex")}`,
    createdAt: new Date().toISOString(),
    ...log
  };

  if (canUseApiTestAdminLogFallback()) {
    await updateJson<AdminLog[]>(LOG_FILE, [], (list) => {
      list.unshift(entry);
      return list.slice(0, 200);
    });
    return entry;
  }

  requireAdminLogDatabase();
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
  return listAdminLogs({ limit });
}

export async function listAdminLogs(options: AdminLogQueryOptions = {}) {
  const limit = Math.min(Math.max(Number(options.limit ?? 100), 1), 200);
  const action = options.action?.trim().toLowerCase() || null;
  const entityType = options.entityType?.trim().toLowerCase() || null;
  const textQuery = options.query?.trim().toLowerCase() || null;

  if (canUseApiTestAdminLogFallback()) {
    const list = readJson<AdminLog[]>(LOG_FILE, []);
    return list
      .filter((item) => {
        if (action && item.action.toLowerCase() !== action) return false;
        if (entityType && item.entityType.toLowerCase() !== entityType) return false;
        if (textQuery) {
          const haystack = [item.id, item.adminId, item.action, item.entityType, item.entityId, item.detail]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(textQuery)) return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  requireAdminLogDatabase();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (action) {
    where.push(`lower(action) = $${params.length + 1}`);
    params.push(action);
  }
  if (entityType) {
    where.push(`lower(entity_type) = $${params.length + 1}`);
    params.push(entityType);
  }
  if (textQuery) {
    where.push(
      `(lower(id) LIKE $${params.length + 1} OR lower(coalesce(admin_id, '')) LIKE $${params.length + 1} OR lower(action) LIKE $${
        params.length + 1
      } OR lower(entity_type) LIKE $${params.length + 1} OR lower(coalesce(entity_id, '')) LIKE $${params.length + 1} OR lower(coalesce(detail, '')) LIKE $${
        params.length + 1
      })`
    );
    params.push(`%${textQuery}%`);
  }

  params.push(limit);
  const rows = await query<DbLog>(
    `SELECT *
     FROM admin_logs
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(mapLog);
}

export async function getAdminLogById(id: string) {
  if (canUseApiTestAdminLogFallback()) {
    const list = readJson<AdminLog[]>(LOG_FILE, []);
    return list.find((item) => item.id === id) ?? null;
  }
  requireAdminLogDatabase();
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

  if (canUseApiTestAdminLogFallback()) {
    await updateJson<AdminLog[]>(LOG_FILE, [], (list) =>
      list.map((item) => (item.id === id ? next : item)).slice(0, 200)
    );
    return next;
  }

  requireAdminLogDatabase();
  const row = await queryOne<DbLog>(
    `UPDATE admin_logs
     SET admin_id = $2, action = $3, entity_type = $4, entity_id = $5, detail = $6
     WHERE id = $1
     RETURNING *`,
    [next.id, next.adminId, next.action, next.entityType, next.entityId ?? null, next.detail ?? null]
  );

  return row ? mapLog(row) : next;
}
