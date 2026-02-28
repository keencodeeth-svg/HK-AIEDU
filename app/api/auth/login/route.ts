import {
  createSession,
  getUserByEmail,
  hashPassword,
  setSessionCookie,
  updateUserPassword,
  verifyPassword
} from "@/lib/auth";
import { addAdminLog } from "@/lib/admin-log";
import { ApiError, apiSuccess, forbidden, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { allowLegacyPlainPasswords } from "@/lib/password";
import {
  buildLoginAttemptIdentity,
  clearLoginAttempt,
  getLoginAttemptStatus,
  registerFailedLoginAttempt
} from "@/lib/auth-security";
import { createAuthRoute } from "@/lib/api/domains";

const loginBodySchema = v.object<{
  email: string;
  password: string;
  role?: "student" | "teacher" | "parent" | "admin";
}>(
  {
    email: v.string({ minLength: 1 }),
    password: v.string({ minLength: 1 }),
    role: v.optional(v.enum(["student", "teacher", "parent", "admin"] as const))
  },
  { allowUnknown: false }
);

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
      throw new ApiError(429, "登录失败次数过多，请稍后再试", {
        lockUntil: attemptStatus.lockUntil
      });
    }

    const user = await getUserByEmail(body.email);
    const legacyPasswordDisabled = Boolean(
      user?.password.startsWith("plain:") && !allowLegacyPlainPasswords()
    );

    if (!user || legacyPasswordDisabled || !verifyPassword(body.password, user.password)) {
      const failed = await registerFailedLoginAttempt(attemptIdentity);
      if (failed.locked) {
        throw new ApiError(429, "登录失败次数过多，请稍后再试", {
          lockUntil: failed.lockUntil
        });
      }
      if (legacyPasswordDisabled) {
        unauthorized("legacy password disabled, run security:migrate-passwords");
      }
      unauthorized("invalid credentials");
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

    return response;
  }
});
