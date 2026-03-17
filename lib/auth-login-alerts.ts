import { addAdminLog } from "./admin-log";
import type { User, UserRole } from "./auth";
import { isDbEnabled, query, queryOne, requireDatabaseEnabled } from "./db";
import { createNotification } from "./notifications";
import { readJson, updateJson } from "./storage";

type AuthLoginProfile = {
  userId: string;
  email: string;
  role: UserRole;
  lastIp: string;
  knownIps: string[];
  lastLoginAt: string;
  updatedAt: string;
};

type DbAuthLoginProfile = {
  user_id: string;
  email: string;
  role: UserRole;
  last_ip: string;
  known_ips: string[] | null;
  last_login_at: string;
  updated_at: string;
};

export type SuccessfulLoginAlertReason = "new_ip" | "success_after_failures";
export type LoginLockoutTrigger = "locked_before_password_check" | "lockout_threshold_reached";

export type SuccessfulLoginAlert = {
  kind: "suspicious_login";
  userId: string;
  email: string;
  role: UserRole;
  ip: string;
  previousIp: string | null;
  knownIp: boolean;
  failedCountBeforeSuccess: number;
  reasons: SuccessfulLoginAlertReason[];
  severity: "medium" | "high";
  createdAt: string;
};

export type LoginLockoutAlert = {
  kind: "login_lockout";
  userId: string;
  email: string;
  role: UserRole;
  ip: string;
  requestedRole: UserRole | null;
  failedCount: number;
  maxFailedAttempts: number;
  lockUntil: string | null;
  trigger: LoginLockoutTrigger;
  severity: "medium" | "high";
  createdAt: string;
};

type AlertUser = Pick<User, "id" | "email" | "name" | "role">;

const AUTH_LOGIN_PROFILES_FILE = "auth-login-profiles.json";
const MAX_FILE_RECORDS = 50000;
const MAX_KNOWN_IPS = 10;
const PRIVILEGED_ROLES = new Set<UserRole>(["admin", "school_admin"]);
const UNTRUSTED_IPS = new Set(["", "unknown", "email-only"]);

function mapDbProfile(row: DbAuthLoginProfile): AuthLoginProfile {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    lastIp: row.last_ip,
    knownIps: row.known_ips ?? [],
    lastLoginAt: row.last_login_at,
    updatedAt: row.updated_at
  };
}

function canUseApiTestAuthLoginProfileFallback() {
  return !isDbEnabled() && Boolean((process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE)?.trim());
}

function requireAuthLoginProfilesDatabase() {
  requireDatabaseEnabled("auth_login_profiles");
}

function isPrivilegedRole(role: UserRole) {
  return PRIVILEGED_ROLES.has(role);
}

function isTrustedIp(ip: string) {
  return !UNTRUSTED_IPS.has(ip.trim().toLowerCase());
}

function buildKnownIps(existing: string[], ip: string) {
  if (!isTrustedIp(ip)) {
    return existing.slice(0, MAX_KNOWN_IPS);
  }
  return [ip, ...existing.filter((item) => item !== ip)].slice(0, MAX_KNOWN_IPS);
}

function getSeverity(role: UserRole) {
  return isPrivilegedRole(role) ? "high" : "medium";
}

function toAlertLogDetail(detail: SuccessfulLoginAlert | LoginLockoutAlert) {
  return JSON.stringify(detail);
}

function buildSuspiciousLoginNotification(user: AlertUser, alert: SuccessfulLoginAlert) {
  const reasons: string[] = [];

  if (alert.reasons.includes("new_ip")) {
    reasons.push(
      alert.previousIp
        ? `检测到新的登录 IP：${alert.ip}（上一常用 IP：${alert.previousIp}）`
        : `检测到新的登录 IP：${alert.ip}`
    );
  }

  if (alert.reasons.includes("success_after_failures")) {
    reasons.push(`本次成功登录前存在 ${alert.failedCountBeforeSuccess} 次失败尝试`);
  }

  const prefix = user.name ? `${user.name}，` : "";
  return {
    title: "检测到异常登录",
    content: `${prefix}${reasons.join("；")}。如非本人操作，请立即修改密码并检查近期敏感操作。`,
    type: "security_alert"
  };
}

async function readProfile(userId: string) {
  if (canUseApiTestAuthLoginProfileFallback()) {
    const list = readJson<AuthLoginProfile[]>(AUTH_LOGIN_PROFILES_FILE, []);
    return list.find((item) => item.userId === userId) ?? null;
  }

  requireAuthLoginProfilesDatabase();
  const row = await queryOne<DbAuthLoginProfile>(
    "SELECT * FROM auth_login_profiles WHERE user_id = $1",
    [userId]
  );
  return row ? mapDbProfile(row) : null;
}

async function writeProfile(profile: AuthLoginProfile) {
  if (canUseApiTestAuthLoginProfileFallback()) {
    await updateJson<AuthLoginProfile[]>(AUTH_LOGIN_PROFILES_FILE, [], (list) => {
      const index = list.findIndex((item) => item.userId === profile.userId);
      if (index >= 0) {
        list[index] = profile;
      } else {
        list.push(profile);
      }
      return list.length > MAX_FILE_RECORDS ? list.slice(list.length - MAX_FILE_RECORDS) : list;
    });
    return;
  }

  requireAuthLoginProfilesDatabase();
  await query(
    `INSERT INTO auth_login_profiles
      (user_id, email, role, last_ip, known_ips, last_login_at, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      last_ip = EXCLUDED.last_ip,
      known_ips = EXCLUDED.known_ips,
      last_login_at = EXCLUDED.last_login_at,
      updated_at = EXCLUDED.updated_at`,
    [
      profile.userId,
      profile.email,
      profile.role,
      profile.lastIp,
      profile.knownIps,
      profile.lastLoginAt,
      profile.updatedAt
    ]
  );
}

export async function handleSuccessfulLoginSecurity(input: {
  user: AlertUser;
  ip: string;
  failedCountBeforeSuccess: number;
}) {
  const previous = await readProfile(input.user.id);
  const knownIps = previous?.knownIps ?? [];
  const trustedIp = isTrustedIp(input.ip);
  const newIp = trustedIp && Boolean(previous) && !knownIps.includes(input.ip);
  const reasons: SuccessfulLoginAlertReason[] = [];

  if (input.failedCountBeforeSuccess > 0) {
    reasons.push("success_after_failures");
  }
  if (newIp) {
    reasons.push("new_ip");
  }

  const nowIso = new Date().toISOString();
  const nextProfile: AuthLoginProfile = {
    userId: input.user.id,
    email: input.user.email,
    role: input.user.role,
    lastIp: input.ip,
    knownIps: buildKnownIps(knownIps, input.ip),
    lastLoginAt: nowIso,
    updatedAt: nowIso
  };

  await writeProfile(nextProfile);

  if (!reasons.length) {
    return null;
  }

  const alert: SuccessfulLoginAlert = {
    kind: "suspicious_login",
    userId: input.user.id,
    email: input.user.email,
    role: input.user.role,
    ip: input.ip,
    previousIp: previous?.lastIp ?? null,
    knownIp: !newIp,
    failedCountBeforeSuccess: input.failedCountBeforeSuccess,
    reasons,
    severity: getSeverity(input.user.role),
    createdAt: nowIso
  };

  await addAdminLog({
    adminId: null,
    action: "auth_security_alert",
    entityType: "auth",
    entityId: input.user.id,
    detail: toAlertLogDetail(alert)
  });

  if (isPrivilegedRole(input.user.role)) {
    const notification = buildSuspiciousLoginNotification(input.user, alert);
    await createNotification({
      userId: input.user.id,
      title: notification.title,
      content: notification.content,
      type: notification.type
    });
  }

  return alert;
}

export async function handleLoginLockoutSecurity(input: {
  user: AlertUser | null;
  ip: string;
  requestedRole?: UserRole | null;
  failedCount: number;
  maxFailedAttempts: number;
  lockUntil: string | null;
  trigger: LoginLockoutTrigger;
}) {
  if (!input.user) {
    return null;
  }

  const alert: LoginLockoutAlert = {
    kind: "login_lockout",
    userId: input.user.id,
    email: input.user.email,
    role: input.user.role,
    ip: input.ip,
    requestedRole: input.requestedRole ?? null,
    failedCount: input.failedCount,
    maxFailedAttempts: input.maxFailedAttempts,
    lockUntil: input.lockUntil,
    trigger: input.trigger,
    severity: getSeverity(input.user.role),
    createdAt: new Date().toISOString()
  };

  await addAdminLog({
    adminId: null,
    action: "auth_login_lockout",
    entityType: "auth",
    entityId: input.user.id,
    detail: toAlertLogDetail(alert)
  });

  return alert;
}
