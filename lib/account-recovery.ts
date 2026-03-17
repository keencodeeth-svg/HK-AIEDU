import crypto from "crypto";
import { addAdminLog, getAdminLogById, listAdminLogs, updateAdminLog, type AdminLog } from "./admin-log";
import { buildAdminAuditDetail, diffAuditFields } from "./admin-audit";
import { getUserByEmail } from "./auth";
import { isDbEnabled, query, requireDatabaseEnabled } from "./db";
import { mutateJson, readJson } from "./storage";

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
  requesterIp?: string | null;
  userAgent?: string | null;
};

type AccountRecoveryAttemptDetail = {
  role: AccountRecoveryRole;
  email: string;
  issueType: AccountRecoveryIssueType;
  requesterIp?: string | null;
  userAgent?: string | null;
  result: "accepted" | "duplicate" | "rate_limited";
  limitedBy?: "email" | "ip";
  retryAt?: string | null;
};

type AccountRecoveryRateLimitResult =
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

type AccountRecoveryAttemptRecord = {
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

type DbAccountRecoveryAttempt = {
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

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_SLA_MS = 24 * 60 * 60 * 1000;
const RECOVERY_ATTEMPTS_FILE = "auth-recovery-attempts.json";
const MAX_ATTEMPT_FILE_RECORDS = 20000;

function toIntEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getRecoveryRateLimitPolicy() {
  const emailWindowMinutes = toIntEnv(process.env.AUTH_RECOVERY_EMAIL_WINDOW_MINUTES, 30, 5, 240);
  const emailMaxAttempts = toIntEnv(process.env.AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS, 4, 2, 20);
  const ipWindowMinutes = toIntEnv(process.env.AUTH_RECOVERY_IP_WINDOW_MINUTES, 30, 5, 240);
  const ipMaxAttempts = toIntEnv(process.env.AUTH_RECOVERY_IP_MAX_ATTEMPTS, 12, 3, 100);

  return {
    emailWindowMinutes,
    emailMaxAttempts,
    emailWindowMs: emailWindowMinutes * 60 * 1000,
    ipWindowMinutes,
    ipMaxAttempts,
    ipWindowMs: ipWindowMinutes * 60 * 1000
  };
}

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeOptionalString(value?: string | null, maxLength = 512) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function shouldTrustProxyHeaders() {
  return process.env.AUTH_TRUST_PROXY_HEADERS === "true";
}

function normalizeRequesterIp(value?: string | null) {
  if (!shouldTrustProxyHeaders()) return null;
  const first = String(value ?? "")
    .split(",")[0]
    ?.trim();
  return first ? first.slice(0, 128) : null;
}

function normalizeStatus(value?: string | null): AccountRecoveryRequestStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved" || value === "rejected") {
    return value;
  }
  return "pending";
}

function normalizeIssueType(value?: string | null): AccountRecoveryIssueType {
  if (value === "forgot_password" || value === "forgot_account" || value === "account_locked") {
    return value;
  }
  return "forgot_password";
}

function normalizeRole(value?: string | null): AccountRecoveryRole {
  if (value === "student" || value === "teacher" || value === "parent" || value === "admin" || value === "school_admin") {
    return value;
  }
  return "student";
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

function parseRecoveryAttemptDetail(detail?: string | null): AccountRecoveryAttemptDetail | null {
  if (!detail) return null;
  try {
    const payload = JSON.parse(detail) as AccountRecoveryAttemptDetail;
    if (!payload || typeof payload !== "object") return null;
    if (!payload.email || !payload.issueType || !payload.role) return null;
    if (payload.result !== "accepted" && payload.result !== "duplicate" && payload.result !== "rate_limited") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function mapRecoveryAttempt(row: DbAccountRecoveryAttempt): AccountRecoveryAttemptRecord {
  return {
    id: row.id,
    role: normalizeRole(row.role),
    email: normalizeEmail(row.email),
    issueType: normalizeIssueType(row.issue_type),
    requesterIp: normalizeRequesterIp(row.requester_ip),
    userAgent: normalizeOptionalString(row.user_agent, 512),
    result:
      row.result === "duplicate" || row.result === "rate_limited" || row.result === "accepted"
        ? row.result
        : "accepted",
    limitedBy: row.limited_by === "email" || row.limited_by === "ip" ? row.limited_by : undefined,
    retryAt: row.retry_at ?? null,
    ticketId: row.ticket_id ?? null,
    createdAt: row.created_at
  };
}

function canUseApiTestRecoveryAttemptsFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireRecoveryAttemptsDatabase() {
  requireDatabaseEnabled("auth_recovery_attempts");
}

function getWaitingHours(createdAt: string) {
  const createdTs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTs)) return 0;
  return Math.max(0, (Date.now() - createdTs) / (60 * 60 * 1000));
}

function getTargetBy(createdAt: string) {
  const createdTs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTs)) return null;
  return new Date(createdTs + RECOVERY_SLA_MS).toISOString();
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
  if (waitingHours >= RECOVERY_SLA_MS / (60 * 60 * 1000)) {
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
      slaState: waitingHours >= 12 ? "at_risk" as const : "healthy" as const,
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

function buildRecoveryRecord(log: AdminLog): AccountRecoveryRecord | null {
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
    isOverdue: !isClosed && waitingHours >= RECOVERY_SLA_MS / (60 * 60 * 1000),
    waitingHours: Number(waitingHours.toFixed(1)),
    priority: priorityMeta.priority,
    priorityReason: priorityMeta.priorityReason,
    slaState: priorityMeta.slaState,
    targetBy,
    nextActionLabel: priorityMeta.nextActionLabel,
    isUnassigned: !isClosed && !detail.handledByAdminId
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

function getRecoveryUpdateSummary(status: AccountRecoveryRequestStatus) {
  if (status === "pending") return "重新打开恢复工单";
  if (status === "in_progress") return "接单处理恢复工单";
  if (status === "resolved") return "关闭恢复工单并标记为已解决";
  return "关闭恢复工单并标记为无法核验";
}

async function listRecentRecoveryAttempts(input: {
  email: string;
  requesterIp: string | null;
  lookbackMs: number;
}) {
  const cutoffIso = new Date(Date.now() - input.lookbackMs).toISOString();

  if (canUseApiTestRecoveryAttemptsFallback()) {
    return readJson<AccountRecoveryAttemptRecord[]>(RECOVERY_ATTEMPTS_FILE, []).filter((item) => {
      const createdAt = new Date(item.createdAt).getTime();
      if (!Number.isFinite(createdAt) || createdAt < Date.now() - input.lookbackMs) {
        return false;
      }
      if (item.email === input.email) return true;
      return Boolean(input.requesterIp && item.requesterIp === input.requesterIp);
    });
  }

  requireRecoveryAttemptsDatabase();
  const params: Array<string | null> = [cutoffIso, input.email];
  let sql =
    `SELECT id, role, email, issue_type, requester_ip, user_agent, result, limited_by, retry_at, ticket_id, created_at
     FROM auth_recovery_attempts
     WHERE created_at >= $1
       AND email = $2`;

  if (input.requesterIp) {
    params.push(input.requesterIp);
    sql += ` OR (created_at >= $1 AND requester_ip = $3)`;
  }

  sql += " ORDER BY created_at DESC LIMIT 5000";

  const rows = await query<DbAccountRecoveryAttempt>(sql, params);
  return rows.map(mapRecoveryAttempt);
}

async function recordRecoveryAttempt(input: {
  role: AccountRecoveryRole;
  email: string;
  issueType: AccountRecoveryIssueType;
  requesterIp: string | null;
  userAgent: string | null;
  result: "accepted" | "duplicate" | "rate_limited";
  ticketId?: string | null;
  limitedBy?: "email" | "ip";
  retryAt?: string | null;
}) {
  const record: AccountRecoveryAttemptRecord = {
    id: `recovery-attempt-${crypto.randomBytes(8).toString("hex")}`,
    role: input.role,
    email: normalizeEmail(input.email),
    issueType: input.issueType,
    requesterIp: normalizeRequesterIp(input.requesterIp),
    userAgent: normalizeOptionalString(input.userAgent, 512),
    result: input.result,
    limitedBy: input.limitedBy,
    retryAt: input.retryAt ?? null,
    ticketId: input.ticketId ?? null,
    createdAt: new Date().toISOString()
  };

  if (canUseApiTestRecoveryAttemptsFallback()) {
    return mutateJson<AccountRecoveryAttemptRecord[], AccountRecoveryAttemptRecord>(
      RECOVERY_ATTEMPTS_FILE,
      [],
      (list) => {
        const next = [...list, record];
        return {
          next: next.length > MAX_ATTEMPT_FILE_RECORDS ? next.slice(next.length - MAX_ATTEMPT_FILE_RECORDS) : next,
          result: record
        };
      }
    );
  }

  requireRecoveryAttemptsDatabase();
  await query(
    `INSERT INTO auth_recovery_attempts
      (id, role, email, issue_type, requester_ip, user_agent, result, limited_by, retry_at, ticket_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      record.id,
      record.role,
      record.email,
      record.issueType,
      record.requesterIp,
      record.userAgent,
      record.result,
      record.limitedBy ?? null,
      record.retryAt ?? null,
      record.ticketId ?? null,
      record.createdAt
    ]
  );

  return record;
}

function getRetryAt(attempts: Array<{ createdAt: string }>, windowMs: number, maxAttempts: number) {
  const sorted = attempts
    .map((item) => new Date(item.createdAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);
  const boundaryTs = sorted[Math.max(0, maxAttempts - 1)];
  if (!Number.isFinite(boundaryTs)) {
    return new Date(Date.now() + windowMs).toISOString();
  }
  return new Date(boundaryTs + windowMs).toISOString();
}

function getRecoveryRateLimitStatus(input: {
  attempts: AccountRecoveryAttemptRecord[];
  email: string;
  requesterIp: string | null;
}): AccountRecoveryRateLimitResult {
  const policy = getRecoveryRateLimitPolicy();
  const now = Date.now();

  const recentEmailAttempts = input.attempts.filter((item) => {
    const createdAt = new Date(item.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= policy.emailWindowMs && item.email === input.email;
  });

  if (recentEmailAttempts.length >= policy.emailMaxAttempts) {
    return {
      limited: true,
      limitedBy: "email",
      retryAt: getRetryAt(recentEmailAttempts, policy.emailWindowMs, policy.emailMaxAttempts),
      maxAttempts: policy.emailMaxAttempts,
      windowMinutes: policy.emailWindowMinutes
    };
  }

  if (input.requesterIp) {
    const recentIpAttempts = input.attempts.filter((item) => {
      const createdAt = new Date(item.createdAt).getTime();
      return Number.isFinite(createdAt) && now - createdAt <= policy.ipWindowMs && item.requesterIp === input.requesterIp;
    });

    if (recentIpAttempts.length >= policy.ipMaxAttempts) {
      return {
        limited: true,
        limitedBy: "ip",
        retryAt: getRetryAt(recentIpAttempts, policy.ipWindowMs, policy.ipMaxAttempts),
        maxAttempts: policy.ipMaxAttempts,
        windowMinutes: policy.ipWindowMinutes
      };
    }
  }

  return { limited: false };
}

async function addRecoveryAttemptAuditLog(input: {
  role: AccountRecoveryRole;
  email: string;
  issueType: AccountRecoveryIssueType;
  requesterIp: string | null;
  userAgent: string | null;
  result: "accepted" | "duplicate" | "rate_limited";
  entityId?: string | null;
  limitedBy?: "email" | "ip";
  retryAt?: string | null;
}) {
  await addAdminLog({
    adminId: null,
    action: "auth_recovery_attempt",
    entityType: "auth_recovery",
    entityId: input.entityId ?? null,
    detail: JSON.stringify({
      role: input.role,
      email: input.email,
      issueType: input.issueType,
      requesterIp: input.requesterIp,
      userAgent: input.userAgent,
      result: input.result,
      limitedBy: input.limitedBy,
      retryAt: input.retryAt ?? null
    } satisfies AccountRecoveryAttemptDetail)
  });
}

async function trackRecoveryAttempt(input: {
  role: AccountRecoveryRole;
  email: string;
  issueType: AccountRecoveryIssueType;
  requesterIp: string | null;
  userAgent: string | null;
  result: "accepted" | "duplicate" | "rate_limited";
  entityId?: string | null;
  limitedBy?: "email" | "ip";
  retryAt?: string | null;
}) {
  await recordRecoveryAttempt({
    role: input.role,
    email: input.email,
    issueType: input.issueType,
    requesterIp: input.requesterIp,
    userAgent: input.userAgent,
    result: input.result,
    ticketId: input.entityId ?? null,
    limitedBy: input.limitedBy,
    retryAt: input.retryAt ?? null
  });

  await addRecoveryAttemptAuditLog(input);
}

export async function createAccountRecoveryRequest(input: AccountRecoveryRequestInput) {
  const email = normalizeEmail(input.email);
  const studentEmail = normalizeEmail(input.studentEmail);
  const requesterIp = normalizeRequesterIp(input.requesterIp);
  const userAgent = normalizeOptionalString(input.userAgent, 512);
  const matchedUser = email ? await getUserByEmail(email) : null;
  const policy = getRecoveryRateLimitPolicy();
  const recentAttempts = await listRecentRecoveryAttempts({
    email,
    requesterIp,
    lookbackMs: Math.max(policy.emailWindowMs, requesterIp ? policy.ipWindowMs : 0)
  });
  const rateLimit = getRecoveryRateLimitStatus({
    attempts: recentAttempts,
    email,
    requesterIp
  });

  if (rateLimit.limited) {
    await trackRecoveryAttempt({
      role: input.role,
      email,
      issueType: input.issueType,
      requesterIp,
      userAgent,
      result: "rate_limited",
      limitedBy: rateLimit.limitedBy,
      retryAt: rateLimit.retryAt
    });
    return {
      rateLimited: true as const,
      limitedBy: rateLimit.limitedBy,
      retryAt: rateLimit.retryAt,
      maxAttempts: rateLimit.maxAttempts,
      windowMinutes: rateLimit.windowMinutes
    };
  }

  const now = Date.now();
  const logs = await listAdminLogs({
    limit: 200,
    action: "auth_recovery_request",
    entityType: "auth_recovery"
  });

  const duplicate = logs.find((item) => {
    const detail = parseRecoveryDetail(item.detail);
    if (!detail) return false;
    const sameUser = normalizeEmail(detail.email) === email && detail.role === input.role && detail.issueType === input.issueType;
    if (!sameUser) return false;
    const createdAt = new Date(item.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= DUPLICATE_WINDOW_MS;
  });

  if (duplicate) {
    await trackRecoveryAttempt({
      role: input.role,
      email,
      issueType: input.issueType,
      requesterIp,
      userAgent,
      result: "duplicate",
      entityId: duplicate.id
    });
    return {
      rateLimited: false as const,
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
    lastAction: "submitted",
    requesterIp,
    userAgent
  };

  const entry = await addAdminLog({
    adminId: null,
    action: "auth_recovery_request",
    entityType: "auth_recovery",
    entityId: matchedUser?.id ?? null,
    detail: JSON.stringify(detail)
  });

  await trackRecoveryAttempt({
    role: input.role,
    email,
    issueType: input.issueType,
    requesterIp,
    userAgent,
    result: "accepted",
    entityId: entry.id
  });

  return {
    rateLimited: false as const,
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
  const logs = await listAdminLogs({
    limit: Math.max(200, limit * 6),
    action: "auth_recovery_request",
    entityType: "auth_recovery"
  });
  const allItems = logs
    .map((item) => buildRecoveryRecord(item))
    .filter(Boolean)
    .sort((a, b) =>
      getPriorityRank(b!.priority) - getPriorityRank(a!.priority) ||
      getStatusRank(b!.status) - getStatusRank(a!.status) ||
      b!.waitingHours - a!.waitingHours ||
      new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()
    ) as AccountRecoveryRecord[];

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
  const previousStatus = normalizeStatus(currentDetail.status);
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
    detail: buildAdminAuditDetail({
      summary: getRecoveryUpdateSummary(input.status),
      reason: input.status === "resolved" || input.status === "rejected" ? trimmedAdminNote : undefined,
      changedFields: diffAuditFields(
        {
          status: previousStatus,
          adminNote: currentDetail.adminNote ?? null,
          handledByAdminId: currentDetail.handledByAdminId ?? null,
          handledAt: currentDetail.handledAt ?? null
        },
        {
          status: nextDetail.status ?? null,
          adminNote: nextDetail.adminNote ?? null,
          handledByAdminId: nextDetail.handledByAdminId ?? null,
          handledAt: nextDetail.handledAt ?? null
        }
      ),
      before: {
        status: previousStatus,
        adminNote: currentDetail.adminNote ?? null,
        handledByAdminId: currentDetail.handledByAdminId ?? null,
        handledAt: currentDetail.handledAt ?? null
      },
      after: {
        status: nextDetail.status ?? null,
        adminNote: nextDetail.adminNote ?? null,
        handledByAdminId: nextDetail.handledByAdminId ?? null,
        handledAt: nextDetail.handledAt ?? null
      },
      meta: {
        ticketId: input.id,
        updatedAt: now
      }
    })
  });

  return buildRecoveryRecord(updatedLog);
}
