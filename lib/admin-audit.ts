export type AdminAuditSnapshot = Record<string, unknown>;

export type AdminAuditDetail = {
  summary: string;
  reason?: string;
  changedFields?: string[];
  before?: AdminAuditSnapshot | null;
  after?: AdminAuditSnapshot | null;
  meta?: AdminAuditSnapshot | null;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSnapshot(value: AdminAuditSnapshot | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  if (!entries.length) {
    return undefined;
  }
  return cloneJson(Object.fromEntries(entries));
}

function isEqualJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function diffAuditFields(before?: AdminAuditSnapshot | null, after?: AdminAuditSnapshot | null) {
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {})
  ]);
  return Array.from(keys)
    .filter((key) => !isEqualJson(before?.[key], after?.[key]))
    .sort();
}

export function buildAdminAuditDetail(input: {
  summary: string;
  reason?: string | null;
  changedFields?: string[];
  before?: AdminAuditSnapshot | null;
  after?: AdminAuditSnapshot | null;
  meta?: AdminAuditSnapshot | null;
}) {
  const detail: AdminAuditDetail = {
    summary: input.summary.trim() || "管理员操作"
  };

  const reason = input.reason?.trim();
  if (reason) {
    detail.reason = reason;
  }

  const changedFields = Array.from(new Set((input.changedFields ?? []).map((item) => item.trim()).filter(Boolean))).sort();
  if (changedFields.length) {
    detail.changedFields = changedFields;
  }

  const before = normalizeSnapshot(input.before);
  if (before) {
    detail.before = before;
  }

  const after = normalizeSnapshot(input.after);
  if (after) {
    detail.after = after;
  }

  const meta = normalizeSnapshot(input.meta);
  if (meta) {
    detail.meta = meta;
  }

  return JSON.stringify(detail);
}

export function parseAdminAuditDetail(detail?: string | null) {
  if (!detail) return null;
  try {
    const payload = JSON.parse(detail) as AdminAuditDetail;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    if (typeof payload.summary !== "string" || !payload.summary.trim()) return null;
    return payload;
  } catch {
    return null;
  }
}
