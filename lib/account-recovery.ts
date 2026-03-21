import { addAdminLog, getAdminLogById, listAdminLogs, updateAdminLog } from "./admin-log";
import { buildAdminAuditDetail, diffAuditFields } from "./admin-audit";
import { getUserByEmail } from "./auth";
import {
  ACCOUNT_RECOVERY_DUPLICATE_WINDOW_MS,
  ACCOUNT_RECOVERY_ENTITY_TYPE,
  ACCOUNT_RECOVERY_REQUEST_ACTION,
  ACCOUNT_RECOVERY_UPDATE_ACTION,
  buildRecoveryRecord,
  buildSummary,
  getRecoveryUpdateSummary,
  isRecoveryRequestLog,
  matchesQuery,
  normalizeEmail,
  normalizeOptionalString,
  normalizeRequesterIp,
  normalizeStatus,
  parseRecoveryDetail,
  sortRecoveryRecords,
  type AccountRecoveryListResult,
  type AccountRecoveryLogDetail,
  type AccountRecoveryRecord,
  type AccountRecoveryRequestInput,
  type AccountRecoveryRequestStatus
} from "./account-recovery-shared";
import {
  getRecoveryRateLimitPolicy,
  getRecoveryRateLimitStatus,
  listRecentRecoveryAttempts,
  trackRecoveryAttempt
} from "./account-recovery-attempts";

export type {
  AccountRecoveryIssueType,
  AccountRecoveryListResult,
  AccountRecoveryPriority,
  AccountRecoveryRecord,
  AccountRecoveryRequestInput,
  AccountRecoveryRequestStatus,
  AccountRecoveryRole,
  AccountRecoverySlaState,
  AccountRecoverySummary
} from "./account-recovery-shared";

function isDuplicateRecoveryRequest(
  item: Awaited<ReturnType<typeof listAdminLogs>>[number],
  input: AccountRecoveryRequestInput,
  email: string,
  now: number
) {
  const detail = parseRecoveryDetail(item.detail);
  if (!detail) return false;

  const sameUser =
    normalizeEmail(detail.email) === email &&
    detail.role === input.role &&
    detail.issueType === input.issueType;
  if (!sameUser) return false;

  const createdAt = new Date(item.createdAt).getTime();
  return Number.isFinite(createdAt) && now - createdAt <= ACCOUNT_RECOVERY_DUPLICATE_WINDOW_MS;
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
    action: ACCOUNT_RECOVERY_REQUEST_ACTION,
    entityType: ACCOUNT_RECOVERY_ENTITY_TYPE
  });

  const duplicate = logs.find((item) => isDuplicateRecoveryRequest(item, input, email, now));
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
    action: ACCOUNT_RECOVERY_REQUEST_ACTION,
    entityType: ACCOUNT_RECOVERY_ENTITY_TYPE,
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
    action: ACCOUNT_RECOVERY_REQUEST_ACTION,
    entityType: ACCOUNT_RECOVERY_ENTITY_TYPE
  });
  const allItems = logs
    .reduce<AccountRecoveryRecord[]>((items, item) => {
      const record = buildRecoveryRecord(item);
      if (record) {
        items.push(record);
      }
      return items;
    }, [])
    .sort(sortRecoveryRecords);

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
  if (!isRecoveryRequestLog(log)) {
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
  if (!isRecoveryRequestLog(currentLog)) {
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
  if (!updatedLog) {
    return null;
  }

  await addAdminLog({
    adminId: input.adminId,
    action: ACCOUNT_RECOVERY_UPDATE_ACTION,
    entityType: ACCOUNT_RECOVERY_ENTITY_TYPE,
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
