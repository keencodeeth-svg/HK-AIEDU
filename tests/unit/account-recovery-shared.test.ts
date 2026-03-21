import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const {
  ACCOUNT_RECOVERY_ENTITY_TYPE,
  ACCOUNT_RECOVERY_REQUEST_ACTION,
  buildRecoveryRecord,
  buildSummary,
  isRecoveryRequestLog,
  matchesQuery,
  normalizeRequesterIp,
  sortRecoveryRecords
} = require("../../lib/account-recovery-shared") as typeof import("../../lib/account-recovery-shared");

const ORIGINAL_AUTH_TRUST_PROXY_HEADERS = process.env.AUTH_TRUST_PROXY_HEADERS;
const ORIGINAL_DATE_NOW = Date.now;

afterEach(() => {
  if (ORIGINAL_AUTH_TRUST_PROXY_HEADERS === undefined) {
    delete process.env.AUTH_TRUST_PROXY_HEADERS;
  } else {
    process.env.AUTH_TRUST_PROXY_HEADERS = ORIGINAL_AUTH_TRUST_PROXY_HEADERS;
  }
  Date.now = ORIGINAL_DATE_NOW;
});

function freezeNow(iso: string) {
  const now = new Date(iso).getTime();
  Date.now = () => now;
}

test("account recovery shared helpers build overdue records with normalized detail fields", () => {
  freezeNow("2026-03-18T12:00:00.000Z");

  const record = buildRecoveryRecord({
    id: "recovery-1",
    adminId: null,
    action: ACCOUNT_RECOVERY_REQUEST_ACTION,
    entityType: ACCOUNT_RECOVERY_ENTITY_TYPE,
    entityId: "ticket-1",
    detail: JSON.stringify({
      role: "teacher",
      email: " Teacher@Demo.com ",
      name: " Teacher Demo ",
      issueType: "account_locked",
      note: " 无法登录 ",
      studentEmail: " Student@Demo.com ",
      schoolName: " Demo School ",
      matchedUserId: "teacher-1",
      matchedUserRole: "teacher",
      status: "pending"
    }),
    createdAt: "2026-03-17T10:00:00.000Z"
  });

  assert.ok(record);
  assert.equal(record?.email, "teacher@demo.com");
  assert.equal(record?.name, "Teacher Demo");
  assert.equal(record?.studentEmail, "student@demo.com");
  assert.equal(record?.schoolName, "Demo School");
  assert.equal(record?.waitingHours, 26);
  assert.equal(record?.isOverdue, true);
  assert.equal(record?.priority, "urgent");
  assert.equal(record?.slaState, "overdue");
  assert.equal(record?.targetBy, "2026-03-18T10:00:00.000Z");
  assert.equal(record?.nextActionLabel, "立即接单并完成核验回访");
  assert.equal(record?.isUnassigned, true);
});

test("account recovery shared helpers sort, summarize, and query records consistently", () => {
  const urgent = {
    id: "urgent-1",
    createdAt: "2026-03-17T09:00:00.000Z",
    updatedAt: "2026-03-17T09:00:00.000Z",
    status: "pending",
    role: "student",
    email: "urgent@demo.com",
    issueType: "forgot_password",
    isOverdue: true,
    waitingHours: 30,
    priority: "urgent",
    priorityReason: "overdue",
    slaState: "overdue",
    targetBy: "2026-03-18T09:00:00.000Z",
    nextActionLabel: "立即处理",
    isUnassigned: true
  } satisfies NonNullable<ReturnType<typeof buildRecoveryRecord>>;
  const high = {
    id: "high-1",
    createdAt: "2026-03-18T02:00:00.000Z",
    updatedAt: "2026-03-18T02:00:00.000Z",
    status: "pending",
    role: "parent",
    email: "parent@demo.com",
    name: "Parent Demo",
    issueType: "forgot_account",
    schoolName: "North Campus",
    isOverdue: false,
    waitingHours: 10,
    priority: "high",
    priorityReason: "needs manual verification",
    slaState: "healthy",
    targetBy: "2026-03-19T02:00:00.000Z",
    nextActionLabel: "尽快联系",
    isUnassigned: true
  } satisfies NonNullable<ReturnType<typeof buildRecoveryRecord>>;
  const resolved = {
    id: "resolved-1",
    createdAt: "2026-03-18T08:00:00.000Z",
    updatedAt: "2026-03-18T09:00:00.000Z",
    status: "resolved",
    role: "admin",
    email: "admin@demo.com",
    issueType: "forgot_password",
    adminNote: "Follow-up completed",
    isOverdue: false,
    waitingHours: 1,
    priority: "normal",
    priorityReason: "closed",
    slaState: "closed",
    targetBy: "2026-03-19T08:00:00.000Z",
    nextActionLabel: "已解决",
    isUnassigned: false
  } satisfies NonNullable<ReturnType<typeof buildRecoveryRecord>>;

  const ordered = [resolved, high, urgent].sort(sortRecoveryRecords);
  assert.deepEqual(
    ordered.map((item) => item.id),
    ["urgent-1", "high-1", "resolved-1"]
  );
  assert.equal(matchesQuery(high, "north"), true);
  assert.equal(matchesQuery(resolved, "follow-up"), true);
  assert.equal(matchesQuery(urgent, "missing"), false);
  assert.deepEqual(buildSummary([urgent, high, resolved]), {
    total: 3,
    pending: 2,
    inProgress: 0,
    resolved: 1,
    rejected: 0,
    overdue: 1,
    urgent: 1,
    highPriority: 1,
    unassigned: 2
  });
  assert.equal(
    isRecoveryRequestLog({
      id: "log-1",
      adminId: null,
      action: ACCOUNT_RECOVERY_REQUEST_ACTION,
      entityType: ACCOUNT_RECOVERY_ENTITY_TYPE,
      entityId: "ticket-1",
      createdAt: "2026-03-18T00:00:00.000Z"
    }),
    true
  );
  assert.equal(
    isRecoveryRequestLog({
      id: "log-2",
      adminId: null,
      action: "auth_recovery_update",
      entityType: ACCOUNT_RECOVERY_ENTITY_TYPE,
      entityId: "ticket-1",
      createdAt: "2026-03-18T00:00:00.000Z"
    }),
    false
  );
});

test("account recovery shared helpers trust proxy headers only when explicitly enabled", () => {
  process.env.AUTH_TRUST_PROXY_HEADERS = "false";
  assert.equal(normalizeRequesterIp("203.0.113.10, 10.0.0.1"), null);

  process.env.AUTH_TRUST_PROXY_HEADERS = "true";
  assert.equal(normalizeRequesterIp("203.0.113.10, 10.0.0.1"), "203.0.113.10");
});
