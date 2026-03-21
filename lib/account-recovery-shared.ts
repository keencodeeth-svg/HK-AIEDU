import type { AdminLog } from "./admin-log";

export type AccountRecoveryRole = "student" | "teacher" | "parent" | "admin" | "school_admin";
export type AccountRecoveryIssueType = "forgot_password" | "forgot_account" | "account_locked";
export type AccountRecoveryRequestStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type AccountRecoveryPriority = "urgent" | "high" | "normal";
export type AccountRecoverySlaState = "healthy" | "at_risk" | "overdue" | "closed";

export type AccountRecoveryRequestInput = {
  role: AccountRecoveryRole;
  email: string;
  name?: string;
  issueType: AccountRecoveryIssueType;
  note?: string;
  studentEmail?: string;
  schoolName?: string;
  requesterIp?: string | null;
  userAgent?: string | null;
};

export type AccountRecoveryLogDetail = {
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
  requesterIp?: string | null;
  userAgent?: string | null;
};

export type AccountRecoveryAttemptDetail = {
  role: AccountRecoveryRole;
  email: string;
  issueType: AccountRecoveryIssueType;
  requesterIp?: string | null;
  userAgent?: string | null;
  result: "accepted" | "duplicate" | "rate_limited";
  limitedBy?: "email" | "ip";
  retryAt?: string | null;
};

export type AccountRecoveryRateLimitResult =
  | {
      limited: false;
    }
  | {
      limited: true;
      limitedBy: "email" | "ip";
      retryAt: string;
      maxAttempts: number;
      windowMinutes: number;
    };

export type AccountRecoveryAttemptRecord = {
  id: string;
  role: AccountRecoveryRole;
  email: string;
  issueType: AccountRecoveryIssueType;
  requesterIp: string | null;
  userAgent: string | null;
  result: "accepted" | "duplicate" | "rate_limited";
  limitedBy?: "email" | "ip";
  retryAt?: string | null;
  ticketId?: string | null;
  createdAt: string;
};

export type DbAccountRecoveryAttempt = {
  id: string;
  role: string;
  email: string;
  issue_type: string;
  requester_ip: string | null;
  user_agent: string | null;
  result: string;
  limited_by: string | null;
  retry_at: string | null;
  ticket_id: string | null;
  created_at: string;
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
  priority: AccountRecoveryPriority;
  priorityReason: string;
  slaState: AccountRecoverySlaState;
  targetBy: string | null;
  nextActionLabel: string;
  isUnassigned: boolean;
};

export type AccountRecoverySummary = {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  urgent: number;
  highPriority: number;
  unassigned: number;
};

export type AccountRecoveryListResult = {
  items: AccountRecoveryRecord[];
  summary: AccountRecoverySummary;
};

export const ACCOUNT_RECOVERY_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_RECOVERY_SLA_MS = 24 * 60 * 60 * 1000;
export const ACCOUNT_RECOVERY_ENTITY_TYPE = "auth_recovery";
export const ACCOUNT_RECOVERY_REQUEST_ACTION = "auth_recovery_request";
export const ACCOUNT_RECOVERY_ATTEMPT_ACTION = "auth_recovery_attempt";
export const ACCOUNT_RECOVERY_UPDATE_ACTION = "auth_recovery_update";

const ACCOUNT_RECOVERY_SLA_HOURS = ACCOUNT_RECOVERY_SLA_MS / (60 * 60 * 1000);

export function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeOptionalString(value?: string | null, maxLength = 512) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function shouldTrustProxyHeaders() {
  return process.env.AUTH_TRUST_PROXY_HEADERS === "true";
}

export function normalizeRequesterIp(value?: string | null) {
  if (!shouldTrustProxyHeaders()) return null;
  const first = String(value ?? "")
    .split(",")[0]
    ?.trim();
  return first ? first.slice(0, 128) : null;
}

export function normalizeStatus(value?: string | null): AccountRecoveryRequestStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved" || value === "rejected") {
    return value;
  }
  return "pending";
}

export function normalizeIssueType(value?: string | null): AccountRecoveryIssueType {
  if (value === "forgot_password" || value === "forgot_account" || value === "account_locked") {
    return value;
  }
  return "forgot_password";
}

export function normalizeRole(value?: string | null): AccountRecoveryRole {
  if (value === "student" || value === "teacher" || value === "parent" || value === "admin" || value === "school_admin") {
    return value;
  }
  return "student";
}

export function parseRecoveryDetail(detail?: string | null): AccountRecoveryLogDetail | null {
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

function getTargetBy(createdAt: string) {
  const createdTs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTs)) return null;
  return new Date(createdTs + ACCOUNT_RECOVERY_SLA_MS).toISOString();
}

function getPriorityMeta(input: {
  status: AccountRecoveryRequestStatus;
  issueType: AccountRecoveryIssueType;
  matchedUserId?: string | null;
  waitingHours: number;
}) {
  const { status, issueType, matchedUserId, waitingHours } = input;
  const isClosed = status === "resolved" || status === "rejected";
  if (isClosed) {
    return {
      priority: "normal" as const,
      priorityReason: "工单已闭环，可用于抽查复盘。",
      slaState: "closed" as const,
      nextActionLabel: status === "resolved" ? "已解决，无需继续处理" : "等待用户补充资料后再开单"
    };
  }
  if (waitingHours >= ACCOUNT_RECOVERY_SLA_HOURS) {
    return {
      priority: "urgent" as const,
      priorityReason: "已超出 1 个工作日处理时效，需要优先处理。",
      slaState: "overdue" as const,
      nextActionLabel: "立即接单并完成核验回访"
    };
  }
  if (issueType === "account_locked") {
    return {
      priority: "urgent" as const,
      priorityReason: "账号被锁定会直接阻塞登录，建议优先解封。",
      slaState: waitingHours >= 12 ? ("at_risk" as const) : ("healthy" as const),
      nextActionLabel: "优先核验锁定原因并通知用户恢复登录"
    };
  }
  if (waitingHours >= 12) {
    return {
      priority: "high" as const,
      priorityReason: "已接近 1 个工作日 SLA，建议前置处理。",
      slaState: "at_risk" as const,
      nextActionLabel: "尽快接单，避免工单超时"
    };
  }
  if (issueType === "forgot_account" || !matchedUserId) {
    return {
      priority: "high" as const,
      priorityReason: "需要人工核验账号信息，处理复杂度更高。",
      slaState: "healthy" as const,
      nextActionLabel: "联系用户核验账号身份信息"
    };
  }
  return {
    priority: "normal" as const,
    priorityReason: "按常规恢复流程处理即可。",
    slaState: "healthy" as const,
    nextActionLabel: status === "pending" ? "尽快开始核验并回填备注" : "完成核验并通知用户处理结果"
  };
}

function getPriorityRank(priority: AccountRecoveryPriority) {
  if (priority === "urgent") return 3;
  if (priority === "high") return 2;
  return 1;
}

function getStatusRank(status: AccountRecoveryRequestStatus) {
  if (status === "pending") return 2;
  if (status === "in_progress") return 1;
  return 0;
}

export function sortRecoveryRecords(left: AccountRecoveryRecord, right: AccountRecoveryRecord) {
  return (
    getPriorityRank(right.priority) - getPriorityRank(left.priority) ||
    getStatusRank(right.status) - getStatusRank(left.status) ||
    right.waitingHours - left.waitingHours ||
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function buildRecoveryRecord(log: AdminLog): AccountRecoveryRecord | null {
  const detail = parseRecoveryDetail(log.detail);
  if (!detail) return null;

  const status = normalizeStatus(detail.status);
  const waitingHours = getWaitingHours(log.createdAt);
  const isClosed = status === "resolved" || status === "rejected";
  const targetBy = getTargetBy(log.createdAt);
  const priorityMeta = getPriorityMeta({
    status,
    issueType: detail.issueType,
    matchedUserId: detail.matchedUserId ?? null,
    waitingHours
  });

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
    isOverdue: !isClosed && waitingHours >= ACCOUNT_RECOVERY_SLA_HOURS,
    waitingHours: Number(waitingHours.toFixed(1)),
    priority: priorityMeta.priority,
    priorityReason: priorityMeta.priorityReason,
    slaState: priorityMeta.slaState,
    targetBy,
    nextActionLabel: priorityMeta.nextActionLabel,
    isUnassigned: !isClosed && !detail.handledByAdminId
  };
}

export function matchesQuery(item: AccountRecoveryRecord, query?: string | null) {
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

export function buildSummary(items: AccountRecoveryRecord[]): AccountRecoverySummary {
  return items.reduce<AccountRecoverySummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.status === "pending") summary.pending += 1;
      if (item.status === "in_progress") summary.inProgress += 1;
      if (item.status === "resolved") summary.resolved += 1;
      if (item.status === "rejected") summary.rejected += 1;
      if (item.isOverdue) summary.overdue += 1;
      if (item.priority === "urgent") summary.urgent += 1;
      if (item.priority === "high") summary.highPriority += 1;
      if (item.isUnassigned) summary.unassigned += 1;
      return summary;
    },
    {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
      overdue: 0,
      urgent: 0,
      highPriority: 0,
      unassigned: 0
    }
  );
}

export function getRecoveryUpdateSummary(status: AccountRecoveryRequestStatus) {
  if (status === "pending") return "重新打开恢复工单";
  if (status === "in_progress") return "接单处理恢复工单";
  if (status === "resolved") return "关闭恢复工单并标记为已解决";
  return "关闭恢复工单并标记为无法核验";
}

export function isRecoveryRequestLog(log: AdminLog | null | undefined): log is AdminLog {
  return Boolean(log && log.action === ACCOUNT_RECOVERY_REQUEST_ACTION && log.entityType === ACCOUNT_RECOVERY_ENTITY_TYPE);
}
