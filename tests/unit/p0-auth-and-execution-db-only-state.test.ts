import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type AuthModule = typeof import("../../lib/auth");
type AuthSecurityModule = typeof import("../../lib/auth-security");
type AuthLoginAlertsModule = typeof import("../../lib/auth-login-alerts");
type AccountRecoveryModule = typeof import("../../lib/account-recovery");
type AdminLogModule = typeof import("../../lib/admin-log");
type FocusModule = typeof import("../../lib/focus");
type NotificationsModule = typeof import("../../lib/notifications");
type ParentActionReceiptsModule = typeof import("../../lib/parent-action-receipts");
type AssignmentsModule = typeof import("../../lib/assignments");
type ExamsModule = typeof import("../../lib/exams");

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "API_TEST_SCOPE",
  "DATABASE_URL",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "NODE_ENV",
  "REQUIRE_DATABASE",
  "RUNTIME_GUARDRAILS_ENFORCE"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function resetModules() {
  const targets = [
    "../../lib/account-recovery",
    "../../lib/admin-log",
    "../../lib/assignments",
    "../../lib/auth",
    "../../lib/auth-login-alerts",
    "../../lib/auth-security",
    "../../lib/classes",
    "../../lib/db",
    "../../lib/exams",
    "../../lib/focus",
    "../../lib/notifications",
    "../../lib/parent-action-receipts",
    "../../lib/runtime-guardrails"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadDbOnlyModules() {
  restoreEnv();
  process.env.NODE_ENV = "development";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "false";
  delete process.env.DATABASE_URL;
  delete process.env.DATA_DIR;
  delete process.env.DATA_SEED_DIR;
  delete process.env.REQUIRE_DATABASE;
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.API_TEST_SCOPE;

  resetModules();

  return {
    accountRecovery: require("../../lib/account-recovery") as AccountRecoveryModule,
    adminLog: require("../../lib/admin-log") as AdminLogModule,
    assignments: require("../../lib/assignments") as AssignmentsModule,
    auth: require("../../lib/auth") as AuthModule,
    authLoginAlerts: require("../../lib/auth-login-alerts") as AuthLoginAlertsModule,
    authSecurity: require("../../lib/auth-security") as AuthSecurityModule,
    exams: require("../../lib/exams") as ExamsModule,
    focus: require("../../lib/focus") as FocusModule,
    notifications: require("../../lib/notifications") as NotificationsModule,
    parentActionReceipts: require("../../lib/parent-action-receipts") as ParentActionReceiptsModule
  };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("sessions and auth security state require database-backed storage outside api test runtime", async () => {
  const { auth, authSecurity, authLoginAlerts, accountRecovery } = loadDbOnlyModules();

  await assert.rejects(() => auth.getSessions(), /DATABASE_URL is required for sessions/);

  await assert.rejects(
    () =>
      auth.createSession({
        id: "u-student-001",
        email: "student@demo.com",
        name: "Student",
        role: "student",
        password: "plain:Student123"
      }),
    /DATABASE_URL is required for sessions/
  );

  await assert.rejects(
    () =>
      authSecurity.getLoginAttemptStatus(
        authSecurity.buildLoginAttemptIdentity({
          email: "student@demo.com"
        })
      ),
    /DATABASE_URL is required for auth_login_attempts/
  );

  await assert.rejects(
    () =>
      authLoginAlerts.handleSuccessfulLoginSecurity({
        user: {
          id: "u-student-001",
          email: "student@demo.com",
          name: "Student",
          role: "student"
        },
        ip: "203.0.113.10",
        failedCountBeforeSuccess: 0
      }),
    /DATABASE_URL is required for auth_login_profiles/
  );

  await assert.rejects(
    () =>
      accountRecovery.createAccountRecoveryRequest({
        role: "student",
        email: "",
        issueType: "forgot_password"
      }),
    /DATABASE_URL is required for auth_recovery_attempts/
  );
});

test("admin logs, notifications, focus sessions, and parent receipts require database-backed storage", async () => {
  const { adminLog, focus, notifications, parentActionReceipts } = loadDbOnlyModules();

  await assert.rejects(
    () =>
      adminLog.addAdminLog({
        adminId: "u-admin-001",
        action: "test_action",
        entityType: "test"
      }),
    /DATABASE_URL is required for admin_logs/
  );

  await assert.rejects(
    () =>
      focus.addFocusSession({
        userId: "u-student-001",
        mode: "focus",
        durationMinutes: 25
      }),
    /DATABASE_URL is required for focus_sessions/
  );

  await assert.rejects(
    () =>
      notifications.createNotification({
        userId: "u-student-001",
        title: "Alert",
        content: "Body",
        type: "system"
      }),
    /DATABASE_URL is required for notifications/
  );

  await assert.rejects(
    () =>
      parentActionReceipts.upsertParentActionReceipt({
        parentId: "u-parent-001",
        studentId: "u-student-001",
        source: "weekly_report",
        actionItemId: "action-001"
      }),
    /DATABASE_URL is required for parent_action_receipts/
  );
});

test("assignment execution state requires database-backed storage outside api test runtime", async () => {
  const { assignments } = loadDbOnlyModules();

  await assert.rejects(
    () => assignments.getAssignmentProgress("assign-001"),
    /DATABASE_URL is required for assignment_progress/
  );

  await assert.rejects(
    () =>
      assignments.upsertAssignmentSubmission({
        assignmentId: "assign-001",
        studentId: "u-student-001",
        answers: { "q-001": "A" },
        score: 1,
        total: 1
      }),
    /DATABASE_URL is required for assignment_submissions/
  );

  await assert.rejects(
    () =>
      assignments.createAssignment({
        classId: "class-001",
        title: "Unit Assignment",
        dueDate: "2026-03-20T00:00:00.000Z",
        questionIds: ["q-001"]
      }),
    /DATABASE_URL is required for assignment_progress/
  );
});

test("exam execution state requires database-backed storage outside api test runtime", async () => {
  const { exams } = loadDbOnlyModules();

  await assert.rejects(
    () => exams.getExamAssignment("paper-001", "u-student-001"),
    /DATABASE_URL is required for exam_assignments/
  );

  await assert.rejects(
    () =>
      exams.upsertExamAnswerDraft({
        paperId: "paper-001",
        studentId: "u-student-001",
        answers: { "q-001": "A" }
      }),
    /DATABASE_URL is required for exam_answers/
  );

  await assert.rejects(
    () =>
      exams.upsertExamSubmission({
        paperId: "paper-001",
        studentId: "u-student-001",
        answers: { "q-001": "A" },
        score: 1,
        total: 1
      }),
    /DATABASE_URL is required for exam_submissions/
  );

  await assert.rejects(
    () =>
      exams.createAndPublishExam({
        classId: "class-001",
        title: "Unit Exam",
        endAt: "2026-03-20T00:00:00.000Z",
        questionIds: ["q-001"]
      }),
    /DATABASE_URL is required for exam_assignments/
  );
});
