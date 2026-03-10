import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { mutateJson, readJson, updateJson } from "./storage";

type AuthLoginAttempt = {
  key: string;
  email: string;
  ip: string;
  failedCount: number;
  firstFailedAt: string;
  lockUntil: string | null;
  updatedAt: string;
};

type DbAuthLoginAttempt = {
  key: string;
  email: string;
  ip: string;
  failed_count: number;
  first_failed_at: string;
  lock_until: string | null;
  updated_at: string;
};

export type LoginAttemptIdentity = {
  key: string;
  email: string;
  ip: string;
};

export type LoginAttemptStatus = {
  enforced: boolean;
  locked: boolean;
  remainingAttempts: number;
  failedCount: number;
  maxFailedAttempts: number;
  lockUntil: string | null;
};

const AUTH_LOGIN_ATTEMPTS_FILE = "auth-login-attempts.json";
const MAX_FILE_RECORDS = 50000;

function toIntEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function isAuthSecurityEnforced() {
  if (process.env.AUTH_SECURITY_ENFORCE === "false") return false;
  if (process.env.AUTH_SECURITY_ENFORCE === "true") return true;
  return true;
}

function getAuthSecurityPolicy() {
  const maxFailedAttempts = toIntEnv(process.env.AUTH_MAX_FAILED_ATTEMPTS, 5, 3, 20);
  const failWindowMinutes = toIntEnv(process.env.AUTH_FAIL_WINDOW_MINUTES, 15, 3, 180);
  const lockMinutes = toIntEnv(process.env.AUTH_LOCK_MINUTES, 15, 1, 180);

  return {
    maxFailedAttempts,
    failWindowMinutes,
    lockMinutes,
    failWindowMs: failWindowMinutes * 60 * 1000,
    lockMs: lockMinutes * 60 * 1000
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function shouldTrustProxyHeaders() {
  return process.env.AUTH_TRUST_PROXY_HEADERS === "true";
}

function normalizeIp(forwardedFor?: string | null) {
  if (!shouldTrustProxyHeaders()) {
    // Default to email-scoped lockout unless the deployment explicitly trusts proxy headers.
    return "email-only";
  }
  const first = String(forwardedFor ?? "")
    .split(",")[0]
    ?.trim();
  return (first || "unknown").slice(0, 128);
}

function createAttemptKey(email: string, ip: string) {
  const digest = crypto.createHash("sha256").update(`${email}|${ip}`).digest("hex").slice(0, 40);
  return `auth-attempt-${digest}`;
}

function mapDbAttempt(row: DbAuthLoginAttempt): AuthLoginAttempt {
  return {
    key: row.key,
    email: row.email,
    ip: row.ip,
    failedCount: Math.max(0, Number(row.failed_count ?? 0)),
    firstFailedAt: row.first_failed_at,
    lockUntil: row.lock_until,
    updatedAt: row.updated_at
  };
}

export function buildLoginAttemptIdentity(input: {
  email: string;
  forwardedFor?: string | null;
}): LoginAttemptIdentity {
  const email = normalizeEmail(input.email);
  const ip = normalizeIp(input.forwardedFor);
  return {
    key: createAttemptKey(email, ip),
    email,
    ip
  };
}

async function readAttempt(key: string) {
  if (!isDbEnabled()) {
    const list = readJson<AuthLoginAttempt[]>(AUTH_LOGIN_ATTEMPTS_FILE, []);
    return list.find((item) => item.key === key) ?? null;
  }

  const row = await queryOne<DbAuthLoginAttempt>(
    "SELECT * FROM auth_login_attempts WHERE key = $1",
    [key]
  );
  return row ? mapDbAttempt(row) : null;
}

async function writeAttempt(attempt: AuthLoginAttempt) {
  if (!isDbEnabled()) {
    await updateJson<AuthLoginAttempt[]>(AUTH_LOGIN_ATTEMPTS_FILE, [], (list) => {
      const index = list.findIndex((item) => item.key === attempt.key);
      if (index >= 0) {
        list[index] = attempt;
      } else {
        list.push(attempt);
      }
      return list.length > MAX_FILE_RECORDS ? list.slice(list.length - MAX_FILE_RECORDS) : list;
    });
    return;
  }

  await query(
    `INSERT INTO auth_login_attempts
      (key, email, ip, failed_count, first_failed_at, lock_until, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (key) DO UPDATE SET
      email = EXCLUDED.email,
      ip = EXCLUDED.ip,
      failed_count = EXCLUDED.failed_count,
      first_failed_at = EXCLUDED.first_failed_at,
      lock_until = EXCLUDED.lock_until,
      updated_at = EXCLUDED.updated_at`,
    [
      attempt.key,
      attempt.email,
      attempt.ip,
      attempt.failedCount,
      attempt.firstFailedAt,
      attempt.lockUntil,
      attempt.updatedAt
    ]
  );
}

async function removeAttempt(key: string) {
  if (!isDbEnabled()) {
    await updateJson<AuthLoginAttempt[]>(AUTH_LOGIN_ATTEMPTS_FILE, [], (list) =>
      list.filter((item) => item.key !== key)
    );
    return;
  }
  await query("DELETE FROM auth_login_attempts WHERE key = $1", [key]);
}

export async function getLoginAttemptStatus(identity: LoginAttemptIdentity): Promise<LoginAttemptStatus> {
  const policy = getAuthSecurityPolicy();
  const enforced = isAuthSecurityEnforced();

  if (!enforced) {
    return {
      enforced,
      locked: false,
      remainingAttempts: policy.maxFailedAttempts,
      failedCount: 0,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockUntil: null
    };
  }

  const existing = await readAttempt(identity.key);
  if (!existing) {
    return {
      enforced,
      locked: false,
      remainingAttempts: policy.maxFailedAttempts,
      failedCount: 0,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockUntil: null
    };
  }

  const nowTs = Date.now();
  const lockTs = existing.lockUntil ? new Date(existing.lockUntil).getTime() : NaN;
  if (Number.isFinite(lockTs) && lockTs > nowTs) {
    return {
      enforced,
      locked: true,
      remainingAttempts: 0,
      failedCount: existing.failedCount,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockUntil: existing.lockUntil
    };
  }

  const firstTs = new Date(existing.firstFailedAt).getTime();
  if (!Number.isFinite(firstTs) || nowTs - firstTs > policy.failWindowMs) {
    await removeAttempt(identity.key);
    return {
      enforced,
      locked: false,
      remainingAttempts: policy.maxFailedAttempts,
      failedCount: 0,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockUntil: null
    };
  }

  const failedCount = Math.max(0, existing.failedCount);
  const remainingAttempts = Math.max(0, policy.maxFailedAttempts - failedCount);
  return {
    enforced,
    locked: false,
    remainingAttempts,
    failedCount,
    maxFailedAttempts: policy.maxFailedAttempts,
    lockUntil: null
  };
}

export async function registerFailedLoginAttempt(identity: LoginAttemptIdentity): Promise<LoginAttemptStatus> {
  const policy = getAuthSecurityPolicy();
  const enforced = isAuthSecurityEnforced();

  if (!enforced) {
    return {
      enforced,
      locked: false,
      remainingAttempts: policy.maxFailedAttempts,
      failedCount: 0,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockUntil: null
    };
  }

  const nowIso = new Date().toISOString();
  if (!isDbEnabled()) {
    return mutateJson<AuthLoginAttempt[], LoginAttemptStatus>(AUTH_LOGIN_ATTEMPTS_FILE, [], (list) => {
      const existing = list.find((item) => item.key === identity.key) ?? null;
      const nowTs = Date.now();
      const lockTs = existing?.lockUntil ? new Date(existing.lockUntil).getTime() : NaN;
      if (Number.isFinite(lockTs) && lockTs > nowTs) {
        return {
          result: {
            enforced,
            locked: true,
            remainingAttempts: 0,
            failedCount: existing?.failedCount ?? 0,
            maxFailedAttempts: policy.maxFailedAttempts,
            lockUntil: existing?.lockUntil ?? null
          } satisfies LoginAttemptStatus
        };
      }

      const firstTs = existing ? new Date(existing.firstFailedAt).getTime() : NaN;
      const withinWindow = existing && Number.isFinite(firstTs) && nowTs - firstTs <= policy.failWindowMs;
      const firstFailedAt = withinWindow ? existing!.firstFailedAt : nowIso;
      const failedCount = (withinWindow ? existing?.failedCount ?? 0 : 0) + 1;
      const reachedLimit = failedCount >= policy.maxFailedAttempts;
      const lockUntil = reachedLimit ? new Date(nowTs + policy.lockMs).toISOString() : null;
      const nextAttempt: AuthLoginAttempt = {
        key: identity.key,
        email: identity.email,
        ip: identity.ip,
        failedCount,
        firstFailedAt,
        lockUntil,
        updatedAt: nowIso
      };
      const nextList = list.filter((item) => item.key !== identity.key);
      nextList.push(nextAttempt);
      const trimmed = nextList.length > MAX_FILE_RECORDS ? nextList.slice(nextList.length - MAX_FILE_RECORDS) : nextList;
      return {
        next: trimmed,
        result: {
          enforced,
          locked: reachedLimit,
          remainingAttempts: reachedLimit ? 0 : Math.max(0, policy.maxFailedAttempts - failedCount),
          failedCount,
          maxFailedAttempts: policy.maxFailedAttempts,
          lockUntil
        } satisfies LoginAttemptStatus
      };
    });
  }

  const current = await getLoginAttemptStatus(identity);
  if (current.locked) {
    return current;
  }

  const firstFailedAt = current.failedCount > 0 ? (await readAttempt(identity.key))?.firstFailedAt ?? nowIso : nowIso;
  const failedCount = current.failedCount + 1;
  const reachedLimit = failedCount >= policy.maxFailedAttempts;
  const lockUntil = reachedLimit ? new Date(Date.now() + policy.lockMs).toISOString() : null;

  await writeAttempt({
    key: identity.key,
    email: identity.email,
    ip: identity.ip,
    failedCount,
    firstFailedAt,
    lockUntil,
    updatedAt: nowIso
  });

  return {
    enforced,
    locked: reachedLimit,
    remainingAttempts: reachedLimit ? 0 : Math.max(0, policy.maxFailedAttempts - failedCount),
    failedCount,
    maxFailedAttempts: policy.maxFailedAttempts,
    lockUntil
  };
}

export async function clearLoginAttempt(identity: LoginAttemptIdentity) {
  if (!isAuthSecurityEnforced()) return;
  await removeAttempt(identity.key);
}
