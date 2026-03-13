import crypto from "crypto";
import {
  createSession,
  createUser,
  getAdminCount,
  getUserByEmail,
  hashPassword,
  setSessionCookie
} from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/password";
import { decideSelfRegisterAccess, isInitialSelfRegisterEnabled } from "@/lib/self-register-policy";
import { apiSuccess, badRequest, conflict, forbidden } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createAuthRoute } from "@/lib/api/domains";

const adminRegisterSchema = v.object<{
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
    const body = await parseJson(request, adminRegisterSchema);
    const passwordValidation = validatePasswordPolicy(body.password);
    if (!passwordValidation.ok) {
      badRequest(passwordValidation.errors[0], {
        passwordPolicy: passwordValidation.policy,
        errors: passwordValidation.errors
      });
    }

    const expectedInvite = process.env.ADMIN_INVITE_CODE?.trim();
    const adminCount = await getAdminCount();
    const decision = decideSelfRegisterAccess({
      existingCount: adminCount,
      inputInviteCode: body.inviteCode,
      configuredInviteCodes: [expectedInvite],
      bootstrapEnabled: isInitialSelfRegisterEnabled(process.env.ADMIN_ALLOW_INITIAL_SELF_REGISTER)
    });
    if (!decision.accepted) {
      forbidden(decision.error ?? "invite code required");
    }

    const existing = await getUserByEmail(body.email);
    if (existing) {
      conflict("email exists");
    }

    const id = `u-admin-${crypto.randomBytes(6).toString("hex")}`;
    const user = {
      id,
      email: body.email,
      name: body.name,
      role: "admin" as const,
      password: hashPassword(body.password)
    };

    await createUser(user);
    const session = await createSession(user);

    const response = apiSuccess(
      {
        ok: true,
        role: "admin",
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
