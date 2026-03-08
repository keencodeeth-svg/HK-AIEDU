import { addAdminLog, getAdminLogById, getAdminLogs, updateAdminLog, type AdminLog } from "./admin-log";
import { getUserByEmail } from "./auth";

export type AccountRecoveryRole = "student" | "teacher" | "parent" | "admin" | "school_admin";
export type AccountRecoveryIssueType = "forgot_password" | "forgot_account" | "account_locked";
export type AccountRecoveryRequestStatus = "pending" | "in_progress" | "resolved" | "rejected";

export type AccountRecoveryRequestInput = {
  role: AccountRecoveryRole;
  email: string;
  name?: string;
  issueType: AccountRecoveryIssueType;
  note?: string;
  studentEmail?: string;
  schoolName?: string;
};

type AccountRecoveryLogDetail = {
  role: AccountRecoveryRole;
  email: string;
  name?: string;
  issueType: AccountRecoveryIssueType;
  note?: string;
  studentEmail?: string;
  schoolName?: string;
  matchedUserId?: string | null;
  matchedUserRole?: string | null;
  status?: AccountRecoveryRequestStatus;
  adminNote?: string;
  handledByAdminId?: string | null;
  handledAt?: string | null;
  updatedAt?: string | null;
  lastAction?: string | null;
};

export type AccountRecoveryRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AccountRecoveryRequestStatus;
  role: AccountRecoveryRole;
  email: string;
  name?: string;
  issueType: AccountRecoveryIssueType;
  note?: string;
  studentEmail?: string;
  schoolName?: string;
  matchedUserId?: string | null;
  matchedUserRole?: string | null;
  handledByAdminId?: string | null;
  handledAt?: string | null;
  adminNote?: string;
  isOverdue: boolean;
  waitingHours: number;
};

export type AccountRecoverySummary = {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
};

export type AccountRecoveryListResult = {
  items: AccountRecoveryRecord[];
  summary: AccountRecoverySummary;
};

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_SLA_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeStatus(value?: string | null): AccountRecoveryRequestStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved" || value === "rejected") {
    return value;
  }
  return "pending";
}

function parseRecoveryDetail(detail?: string | null): AccountRecoveryLogDetail | null {
  if (!detail) return null;
  try {
    const payload = JSON.parse(detail) as AccountRecoveryLogDetail;
    if (!payload || typeof payload !== "object") return null;
    return payload;
  } catch {
    return null;
  }
}

function getWaitingHours(createdAt: string) {
  const createdTs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTs)) return 0;
  return Math.max(0, (Date.now() - createdTs) / (60 * 60 * 1000));
}

function buildRecoveryRecord(log: AdminLog): AccountRecoveryRecord | null {
  const detail = parseRecoveryDetail(log.detail);
  if (!detail) return null;

  const status = normalizeStatus(detail.status);
  const waitingHours = getWaitingHours(log.createdAt);
  const isClosed = status === "resolved" || status === "rejected";

  return {
    id: log.id,
    createdAt: log.createdAt,
    updatedAt: detail.updatedAt ?? log.createdAt,
    status,
    role: detail.role,
    email: normalizeEmail(detail.email),
    name: detail.name?.trim() || undefined,
    issueType: detail.issueType,
    note: detail.note?.trim() || undefined,
    studentEmail: normalizeEmail(detail.studentEmail) || undefined,
    schoolName: detail.schoolName?.trim() || undefined,
    matchedUserId: detail.matchedUserId ?? null,
    matchedUserRole: detail.matchedUserRole ?? null,
    handledByAdminId: detail.handledByAdminId ?? null,
    handledAt: detail.handledAt ?? null,
    adminNote: detail.adminNote?.trim() || undefined,
    isOverdue: !isClosed && waitingHours >= RECOVERY_SLA_MS / (60 * 60 * 1000),
    waitingHours: Number(waitingHours.toFixed(1))
  };
}

function matchesQuery(item: AccountRecoveryRecord, query?: string | null) {
  const normalized = (query ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return [
    item.id,
    item.email,
    item.name,
    item.role,
    item.issueType,
    item.note,
    item.studentEmail,
    item.schoolName,
    item.adminNote,
    item.matchedUserId,
    item.matchedUserRole
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function buildSummary(items: AccountRecoveryRecord[]): AccountRecoverySummary {
  return items.reduce<AccountRecoverySummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.status === "pending") summary.pending += 1;
      if (item.status === "in_progress") summary.inProgress += 1;
      if (item.status === "resolved") summary.resolved += 1;
      if (item.status === "rejected") summary.rejected += 1;
      if (item.isOverdue) summary.overdue += 1;
      return summary;
    },
    {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
      overdue: 0
    }
  );
}

export async function createAccountRecoveryRequest(input: AccountRecoveryRequestInput) {
  const email = normalizeEmail(input.email);
  const studentEmail = normalizeEmail(input.studentEmail);
  const matchedUser = email ? await getUserByEmail(email) : null;
  const logs = await getAdminLogs(200);
  const now = Date.now();

  const duplicate = logs.find((item) => {
    if (item.action !== "auth_recovery_request") return false;
    const detail = parseRecoveryDetail(item.detail);
    if (!detail) return false;
    const sameUser = normalizeEmail(detail.email) === email && detail.role === input.role && detail.issueType === input.issueType;
    if (!sameUser) return false;
    const createdAt = new Date(item.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= DUPLICATE_WINDOW_MS;
  });

  if (duplicate) {
    return {
      ticketId: duplicate.id,
      submittedAt: duplicate.createdAt,
      duplicate: true,
      matched: Boolean(matchedUser && matchedUser.role === input.role)
    };
  }

  const createdAt = new Date().toISOString();
  const detail: AccountRecoveryLogDetail = {
    role: input.role,
    email,
    name: input.name?.trim() || undefined,
    issueType: input.issueType,
    note: input.note?.trim() || undefined,
    studentEmail: studentEmail || undefined,
    schoolName: input.schoolName?.trim() || undefined,
    matchedUserId: matchedUser?.id ?? null,
    matchedUserRole: matchedUser?.role ?? null,
    status: "pending",
    handledByAdminId: null,
    handledAt: null,
    updatedAt: createdAt,
    lastAction: "submitted"
  };

  const entry = await addAdminLog({
    adminId: null,
    action: "auth_recovery_request",
    entityType: "auth_recovery",
    entityId: matchedUser?.id ?? null,
    detail: JSON.stringify(detail)
  });

  return {
    ticketId: entry.id,
    submittedAt: entry.createdAt,
    duplicate: false,
    matched: Boolean(matchedUser && matchedUser.role === input.role)
  };
}

export async function listAccountRecoveryRequests(options: {
  limit?: number;
  status?: AccountRecoveryRequestStatus | null;
  query?: string | null;
} = {}): Promise<AccountRecoveryListResult> {
  const limit = Math.min(Math.max(Number(options.limit ?? 50), 1), 100);
  const logs = await getAdminLogs(Math.max(200, limit * 6));
  const allItems = logs
    .filter((item) => item.action === "auth_recovery_request" && item.entityType === "auth_recovery")
    .map((item) => buildRecoveryRecord(item))
    .filter(Boolean)
    .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()) as AccountRecoveryRecord[];

  const filteredItems = allItems
    .filter((item) => (options.status ? item.status === options.status : true))
    .filter((item) => matchesQuery(item, options.query))
    .slice(0, limit);

  return {
    items: filteredItems,
    summary: buildSummary(allItems)
  };
}

export async function getAccountRecoveryRequestById(id: string) {
  const log = await getAdminLogById(id);
  if (!log || log.action !== "auth_recovery_request" || log.entityType !== "auth_recovery") {
    return null;
  }
  return buildRecoveryRecord(log);
}

export async function updateAccountRecoveryRequest(input: {
  id: string;
  status: AccountRecoveryRequestStatus;
  adminId: string;
  adminNote?: string;
}) {
  const currentLog = await getAdminLogById(input.id);
  if (!currentLog || currentLog.action !== "auth_recovery_request" || currentLog.entityType !== "auth_recovery") {
    return null;
  }

  const currentDetail = parseRecoveryDetail(currentLog.detail);
  if (!currentDetail) {
    return null;
  }

  const now = new Date().toISOString();
  const trimmedAdminNote = input.adminNote?.trim() || undefined;
  const nextDetail: AccountRecoveryLogDetail = {
    ...currentDetail,
    status: input.status,
    adminNote: trimmedAdminNote ?? currentDetail.adminNote ?? undefined,
    handledByAdminId: input.status === "pending" ? null : input.adminId,
    handledAt: input.status === "resolved" || input.status === "rejected" ? now : null,
    updatedAt: now,
    lastAction:
      input.status === "pending"
        ? "reopened"
        : input.status === "in_progress"
          ? "claimed"
          : input.status
  };

  const updatedLog = await updateAdminLog(input.id, {
    adminId: input.adminId,
    detail: JSON.stringify(nextDetail)
  });

  if (!updatedLog) return null;

  await addAdminLog({
    adminId: input.adminId,
    action: "auth_recovery_update",
    entityType: "auth_recovery",
    entityId: input.id,
    detail: JSON.stringify({
      status: input.status,
      adminNote: trimmedAdminNote ?? null,
      updatedAt: now
    })
  });

  return buildRecoveryRecord(updatedLog);
}
