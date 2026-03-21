import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const {
  getRecoveryRateLimitPolicy,
  getRecoveryRateLimitStatus
} = require("../../lib/account-recovery-attempts") as typeof import("../../lib/account-recovery-attempts");

const ENV_KEYS = [
  "AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS",
  "AUTH_RECOVERY_EMAIL_WINDOW_MINUTES",
  "AUTH_RECOVERY_IP_MAX_ATTEMPTS",
  "AUTH_RECOVERY_IP_WINDOW_MINUTES"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));
const ORIGINAL_DATE_NOW = Date.now;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  Date.now = ORIGINAL_DATE_NOW;
});

function freezeNow(iso: string) {
  const now = new Date(iso).getTime();
  Date.now = () => now;
}

test("account recovery attempts clamp rate-limit policy environment values", () => {
  process.env.AUTH_RECOVERY_EMAIL_WINDOW_MINUTES = "500";
  process.env.AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS = "1";
  process.env.AUTH_RECOVERY_IP_WINDOW_MINUTES = "NaN";
  process.env.AUTH_RECOVERY_IP_MAX_ATTEMPTS = "999";

  assert.deepEqual(getRecoveryRateLimitPolicy(), {
    emailWindowMinutes: 240,
    emailMaxAttempts: 2,
    emailWindowMs: 240 * 60 * 1000,
    ipWindowMinutes: 30,
    ipMaxAttempts: 100,
    ipWindowMs: 30 * 60 * 1000
  });
});

test("account recovery attempts report email rate limits with retry metadata", () => {
  freezeNow("2026-03-18T12:00:00.000Z");
  process.env.AUTH_RECOVERY_EMAIL_WINDOW_MINUTES = "30";
  process.env.AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS = "3";
  process.env.AUTH_RECOVERY_IP_WINDOW_MINUTES = "30";
  process.env.AUTH_RECOVERY_IP_MAX_ATTEMPTS = "10";

  const result = getRecoveryRateLimitStatus({
    attempts: [
      {
        id: "attempt-1",
        role: "student",
        email: "student@demo.com",
        issueType: "forgot_password",
        requesterIp: "203.0.113.10",
        userAgent: null,
        result: "accepted",
        createdAt: "2026-03-18T11:40:00.000Z"
      },
      {
        id: "attempt-2",
        role: "student",
        email: "student@demo.com",
        issueType: "forgot_account",
        requesterIp: "203.0.113.10",
        userAgent: null,
        result: "accepted",
        createdAt: "2026-03-18T11:50:00.000Z"
      },
      {
        id: "attempt-3",
        role: "student",
        email: "student@demo.com",
        issueType: "account_locked",
        requesterIp: "203.0.113.10",
        userAgent: null,
        result: "accepted",
        createdAt: "2026-03-18T11:45:00.000Z"
      },
      {
        id: "attempt-4",
        role: "student",
        email: "other@demo.com",
        issueType: "forgot_password",
        requesterIp: "203.0.113.11",
        userAgent: null,
        result: "accepted",
        createdAt: "2026-03-18T11:55:00.000Z"
      }
    ],
    email: "student@demo.com",
    requesterIp: "203.0.113.10"
  });

  assert.deepEqual(result, {
    limited: true,
    limitedBy: "email",
    retryAt: "2026-03-18T12:10:00.000Z",
    maxAttempts: 3,
    windowMinutes: 30
  });
});

test("account recovery attempts fall back to ip throttling only when requester ip is present", () => {
  freezeNow("2026-03-18T12:00:00.000Z");
  process.env.AUTH_RECOVERY_EMAIL_WINDOW_MINUTES = "30";
  process.env.AUTH_RECOVERY_EMAIL_MAX_ATTEMPTS = "5";
  process.env.AUTH_RECOVERY_IP_WINDOW_MINUTES = "60";
  process.env.AUTH_RECOVERY_IP_MAX_ATTEMPTS = "3";

  const attempts: Parameters<typeof getRecoveryRateLimitStatus>[0]["attempts"] = [
    {
      id: "attempt-1",
      role: "student",
      email: "student-1@demo.com",
      issueType: "forgot_password",
      requesterIp: "203.0.113.20",
      userAgent: null,
      result: "accepted",
      createdAt: "2026-03-18T11:10:00.000Z"
    },
    {
      id: "attempt-2",
      role: "teacher",
      email: "teacher-1@demo.com",
      issueType: "account_locked",
      requesterIp: "203.0.113.20",
      userAgent: null,
      result: "accepted",
      createdAt: "2026-03-18T11:20:00.000Z"
    },
    {
      id: "attempt-3",
      role: "parent",
      email: "parent-1@demo.com",
      issueType: "forgot_account",
      requesterIp: "203.0.113.20",
      userAgent: null,
      result: "accepted",
      createdAt: "2026-03-18T11:30:00.000Z"
    }
  ];

  assert.deepEqual(
    getRecoveryRateLimitStatus({
      attempts,
      email: "fresh@demo.com",
      requesterIp: "203.0.113.20"
    }),
    {
      limited: true,
      limitedBy: "ip",
      retryAt: "2026-03-18T12:10:00.000Z",
      maxAttempts: 3,
      windowMinutes: 60
    }
  );

  assert.deepEqual(
    getRecoveryRateLimitStatus({
      attempts,
      email: "fresh@demo.com",
      requesterIp: null
    }),
    { limited: false }
  );
});
