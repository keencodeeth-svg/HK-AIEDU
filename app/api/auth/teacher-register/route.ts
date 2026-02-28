import crypto from "crypto";
import {
  createSession,
  createUser,
  getTeacherCount,
  getUserByEmail,
  hashPassword,
  setSessionCookie
} from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/password";
import { apiSuccess, badRequest, conflict, forbidden } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createAuthRoute } from "@/lib/api/domains";

const teacherRegisterSchema = v.object<{
  email: string;
  password: string;
  name: string;
  inviteCode?: string;
}>(
  {
    email: v.string({ minLength: 1 }),
    password: v.string({ minLength: 1 }),
    name: v.string({ minLength: 1 }),
    inviteCode: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createAuthRoute({
  cache: "private-realtime",
  handler: async ({ request, meta }) => {
    const body = await parseJson(request, teacherRegisterSchema);
    const passwordValidation = validatePasswordPolicy(body.password);
    if (!passwordValidation.ok) {
      badRequest(passwordValidation.errors[0], {
        passwordPolicy: passwordValidation.policy,
        errors: passwordValidation.errors
      });
    }

    const expectedInvite = process.env.TEACHER_INVITE_CODE?.trim();
    const inviteList = process.env.TEACHER_INVITE_CODES?.trim();
    const teacherCount = await getTeacherCount();
    const allowWithoutInvite = !expectedInvite && teacherCount === 0;

    const normalize = (code?: string) => (code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    const normalizedInput = normalize(body.inviteCode);
    const allowed = new Set(
      [expectedInvite, ...(inviteList ? inviteList.split(/[,;\s]+/) : [])]
        .map((item) => normalize(item))
        .filter(Boolean)
    );
    const requireInvite = allowed.size > 0;

    if (requireInvite) {
      if (!normalizedInput) {
        forbidden("invite code required");
      }
      if (!allowed.has(normalizedInput)) {
        forbidden("invalid invite code");
      }
    } else if (!allowWithoutInvite) {
      forbidden("invite code required");
    }

    const existing = await getUserByEmail(body.email);
    if (existing) {
      conflict("email exists");
    }

    const id = `u-teacher-${crypto.randomBytes(6).toString("hex")}`;
    const user = {
      id,
      email: body.email,
      name: body.name,
      role: "teacher" as const,
      password: hashPassword(body.password)
    };

    await createUser(user);
    const session = await createSession(user);

    const response = apiSuccess(
      {
        ok: true,
        role: "teacher",
        name: body.name
      },
      {
        requestId: meta.requestId,
        status: 201,
        message: "注册成功"
      }
    );

    setSessionCookie(response, session.id);
    return response;
  }
});
