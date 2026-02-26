import {
  createSession,
  getUserByEmail,
  hashPassword,
  setSessionCookie,
  updateUserPassword,
  verifyPassword
} from "@/lib/auth";
import { addAdminLog } from "@/lib/admin-log";
import { apiSuccess, forbidden, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { allowLegacyPlainPasswords } from "@/lib/password";

export const dynamic = "force-dynamic";

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

export const POST = withApi(async (request, _context, { requestId }) => {
  const body = await parseJson(request, loginBodySchema);
  const user = await getUserByEmail(body.email);

  if (user?.password.startsWith("plain:") && !allowLegacyPlainPasswords()) {
    unauthorized("legacy password disabled, run security:migrate-passwords");
  }

  if (!user || !verifyPassword(body.password, user.password)) {
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
      requestId,
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
});
