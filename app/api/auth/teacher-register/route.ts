import crypto from "crypto";
import {
  createSession,
  createUser,
  getTeacherCount,
  getUserByEmail,
  hashPassword,
  normalizeAuthEmail,
  setSessionCookie
} from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/password";
import { decideSelfRegisterAccess, isInitialSelfRegisterEnabled } from "@/lib/self-register-policy";
import { resolveSchoolIdByCodeOrDefault } from "@/lib/schools";
import { apiSuccess, badRequest, conflict, forbidden } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createAuthRoute } from "@/lib/api/domains";

const teacherRegisterSchema = v.object<{
  email: string;
  password: string;
  name: string;
  inviteCode?: string;
  schoolCode?: string;
}>(
  {
    email: v.string({ minLength: 1 }),
    password: v.string({ minLength: 1 }),
    name: v.string({ minLength: 1 }),
    inviteCode: v.optional(v.string({ minLength: 1 })),
    schoolCode: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createAuthRoute({
  cache: "private-realtime",
  handler: async ({ request, meta }) => {
    const body = await parseJson(request, teacherRegisterSchema);
    const email = normalizeAuthEmail(body.email);
    const name = body.name.trim();
    const inviteCode = body.inviteCode?.trim();
    const schoolCode = body.schoolCode?.trim();
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
    const decision = decideSelfRegisterAccess({
      existingCount: teacherCount,
      inputInviteCode: inviteCode,
      configuredInviteCodes: [expectedInvite, ...(inviteList ? inviteList.split(/[,;\s]+/) : [])],
      bootstrapEnabled: isInitialSelfRegisterEnabled(process.env.TEACHER_ALLOW_INITIAL_SELF_REGISTER)
    });
    if (!decision.accepted) {
      forbidden(decision.error ?? "invite code required");
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      conflict("email exists");
    }
    const schoolId = await resolveSchoolIdByCodeOrDefault({
      schoolCode,
      fallbackToDefault: true
    });
    if (schoolCode && !schoolId) {
      forbidden("invalid school code");
    }

    const id = `u-teacher-${crypto.randomBytes(6).toString("hex")}`;
    const user = {
      id,
      email,
      name,
      role: "teacher" as const,
      schoolId: schoolId ?? undefined,
      password: hashPassword(body.password)
    };

    await createUser(user);
    const session = await createSession(user);

    const response = apiSuccess(
      {
        ok: true,
        role: "teacher",
        name
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
