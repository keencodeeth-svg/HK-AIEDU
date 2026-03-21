import crypto from "crypto";
import { addAdminLog } from "./admin-log";
import { isDbEnabled, query, requireDatabaseEnabled } from "./db";
import { mutateJson, readJson } from "./storage";
import {
  ACCOUNT_RECOVERY_ATTEMPT_ACTION,
  ACCOUNT_RECOVERY_ENTITY_TYPE,
  type AccountRecoveryAttemptDetail,
  type AccountRecoveryAttemptRecord,
  type AccountRecoveryIssueType,
  type AccountRecoveryRateLimitResult,
  type AccountRecoveryRole,
  type DbAccountRecoveryAttempt,
  normalizeEmail,
  normalizeIssueType,
  normalizeOptionalString,
  normalizeRequesterIp,
  normalizeRole
} from "./account-recovery-shared";

const RECOVERY_ATTEMPTS_FILE = "auth-recovery-attempts.json";
const MAX_ATTEMPT_FILE_RECORDS = 20000;

function toIntEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function getRecoveryRateLimitPolicy() {
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

export async function listRecentRecoveryAttempts(input: {
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
    .sort((left, right) => right - left);
  const boundaryTs = sorted[Math.max(0, maxAttempts - 1)];
  if (!Number.isFinite(boundaryTs)) {
    return new Date(Date.now() + windowMs).toISOString();
  }
  return new Date(boundaryTs + windowMs).toISOString();
}

export function getRecoveryRateLimitStatus(input: {
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
    action: ACCOUNT_RECOVERY_ATTEMPT_ACTION,
    entityType: ACCOUNT_RECOVERY_ENTITY_TYPE,
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

export async function trackRecoveryAttempt(input: {
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
