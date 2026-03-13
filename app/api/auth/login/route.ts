import {
  createSession,
  getUserByEmail,
  hashPassword,
  setSessionCookie,
  updateUserPassword,
  verifyPassword
} from "@/lib/auth";
import { addAdminLog } from "@/lib/admin-log";
import { clearAdminStepUpCookie } from "@/lib/admin-step-up";
import { ApiError, apiSuccess, forbidden, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { allowLegacyPlainPasswords } from "@/lib/password";
import {
  buildLoginAttemptIdentity,
  clearLoginAttempt,
  getLoginAttemptStatus,
  registerFailedLoginAttempt,
  type LoginAttemptStatus
} from "@/lib/auth-security";
import {
  handleLoginLockoutSecurity,
  handleSuccessfulLoginSecurity
} from "@/lib/auth-login-alerts";
import { createAuthRoute } from "@/lib/api/domains";

const loginBodySchema = v.object<{
  email: string;
  password: string;
  role?: "student" | "teacher" | "parent" | "admin" | "school_admin";
}>(
  {
    email: v.string({ minLength: 1 }),
    password: v.string({ minLength: 1 }),
    role: v.optional(v.enum(["student", "teacher", "parent", "admin", "school_admin"] as const))
  },
  { allowUnknown: false }
);

function toAttemptDetails(status: LoginAttemptStatus) {
  return {
    enforced: status.enforced,
    remainingAttempts: status.remainingAttempts,
    failedCount: status.failedCount,
    maxFailedAttempts: status.maxFailedAttempts,
    lockUntil: status.lockUntil
  };
}

export const POST = createAuthRoute({
  cache: "private-realtime",
  handler: async ({ request, meta }) => {
    const body = await parseJson(request, loginBodySchema);
    const attemptIdentity = buildLoginAttemptIdentity({
      email: body.email,
      forwardedFor: request.headers.get("x-forwarded-for")
    });
    const attemptStatus = await getLoginAttemptStatus(attemptIdentity);
    if (attemptStatus.locked) {
      try {
        await handleLoginLockoutSecurity({
          user: await getUserByEmail(body.email),
          ip: attemptIdentity.ip,
          requestedRole: body.role ?? null,
          failedCount: attemptStatus.failedCount,
          maxFailedAttempts: attemptStatus.maxFailedAttempts,
          lockUntil: attemptStatus.lockUntil,
          trigger: "locked_before_password_check"
        });
      } catch {
        // login alert side effects should not block auth responses
      }
      throw new ApiError(429, "登录失败次数过多，请稍后再试", toAttemptDetails(attemptStatus));
    }

    const user = await getUserByEmail(body.email);
    const legacyPasswordDisabled = Boolean(
      user?.password.startsWith("plain:") && !allowLegacyPlainPasswords()
    );

    if (!user || legacyPasswordDisabled || !verifyPassword(body.password, user.password)) {
      const failed = await registerFailedLoginAttempt(attemptIdentity);
      if (failed.locked) {
        try {
          await handleLoginLockoutSecurity({
            user,
            ip: attemptIdentity.ip,
            requestedRole: body.role ?? null,
            failedCount: failed.failedCount,
            maxFailedAttempts: failed.maxFailedAttempts,
            lockUntil: failed.lockUntil,
            trigger: "lockout_threshold_reached"
          });
        } catch {
          // login alert side effects should not block auth responses
        }
        throw new ApiError(429, "登录失败次数过多，请稍后再试", toAttemptDetails(failed));
      }
      if (legacyPasswordDisabled) {
        unauthorized("legacy password disabled, run security:migrate-passwords", toAttemptDetails(failed));
      }
      unauthorized("邮箱或密码错误", toAttemptDetails(failed));
    }

    if (user.password.startsWith("plain:")) {
      try {
        const hashed = hashPassword(body.password);
        await updateUserPassword(user.id, hashed);
        user.password = hashed;
      } catch {
        // keep login available even if background migration fails
      }
    }

    const failedCountBeforeSuccess = attemptStatus.failedCount;

    try {
      await clearLoginAttempt(attemptIdentity);
    } catch {
      // lockout cleanup should not block successful login
    }

    if (body.role && user.role !== body.role) {
      forbidden("账号身份不匹配，请确认选择的身份");
    }

    const session = await createSession(user);
    const response = apiSuccess(
      {
        ok: true,
        role: user.role,
        name: user.name
      },
      {
        requestId: meta.requestId,
        message: "登录成功"
      }
    );

    clearAdminStepUpCookie(response);
    setSessionCookie(response, session.id);

    if (user.role === "admin") {
      await addAdminLog({
        adminId: user.id,
        action: "admin_login",
        entityType: "auth",
        entityId: user.id,
        detail: user.email
      });
    }

    try {
      await handleSuccessfulLoginSecurity({
        user,
        ip: attemptIdentity.ip,
        failedCountBeforeSuccess
      });
    } catch {
      // login alert side effects should not block successful auth
    }

    return response;
  }
});
