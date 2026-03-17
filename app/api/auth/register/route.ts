import crypto from "crypto";
import { createUser, getUserByEmail, getUserById, hashPassword, normalizeAuthEmail } from "@/lib/auth";
import { SUBJECT_OPTIONS } from "@/lib/constants";
import { getStudentProfileByObserverCode, upsertStudentProfile } from "@/lib/profiles";
import { validatePasswordPolicy } from "@/lib/password";
import { getSchoolById, resolveSchoolIdByCodeOrDefault } from "@/lib/schools";
import { apiSuccess, badRequest, conflict, notFound } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createAuthRoute } from "@/lib/api/domains";

const registerBodySchema = v.object<{
  role: "student" | "parent";
  email: string;
  password: string;
  name: string;
  grade?: string;
  studentEmail?: string;
  observerCode?: string;
  schoolCode?: string;
}>(
  {
    role: v.enum(["student", "parent"] as const),
    email: v.string({ minLength: 1 }),
    password: v.string({ minLength: 1 }),
    name: v.string({ minLength: 1 }),
    grade: v.optional(v.string({ minLength: 1 })),
    studentEmail: v.optional(v.string({ minLength: 1 })),
    observerCode: v.optional(v.string({ minLength: 1 })),
    schoolCode: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createAuthRoute({
  cache: "private-realtime",
  handler: async ({ request, meta }) => {
    const body = await parseJson(request, registerBodySchema);
    const email = normalizeAuthEmail(body.email);
    const name = body.name.trim();
    const grade = body.grade?.trim();
    const schoolCode = body.schoolCode?.trim();
    const observerCode = body.observerCode?.trim();
    const passwordValidation = validatePasswordPolicy(body.password);
    if (!passwordValidation.ok) {
      badRequest(passwordValidation.errors[0], {
        passwordPolicy: passwordValidation.policy,
        errors: passwordValidation.errors
      });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      conflict("email exists");
    }

    if (body.role === "student") {
      if (!grade) {
        badRequest("grade required");
      }
      const schoolId = await resolveSchoolIdByCodeOrDefault({
        schoolCode,
        fallbackToDefault: true
      });
      if (schoolCode && !schoolId) {
        notFound("school code invalid");
      }
      const school = schoolId ? await getSchoolById(schoolId) : null;

      const id = `u-${crypto.randomBytes(6).toString("hex")}`;
      await createUser({
        id,
        email,
        name,
        role: "student",
        grade,
        schoolId: schoolId ?? undefined,
        password: hashPassword(body.password)
      });

      await upsertStudentProfile({
        userId: id,
        grade,
        subjects: SUBJECT_OPTIONS.map((item) => item.value),
        target: "",
        school: school?.name ?? ""
      });

      return apiSuccess(
        { ok: true },
        {
          requestId: meta.requestId,
          status: 201,
          message: "注册成功"
        }
      );
    }

    if (!observerCode) {
      if (body.studentEmail?.trim()) {
        badRequest("studentEmail binding disabled, use observerCode from student profile");
      }
      badRequest("observerCode required");
    }

    const profile = await getStudentProfileByObserverCode(observerCode);
    if (!profile) {
      notFound("observer code invalid");
    }
    const student = await getUserById(profile.userId);

    if (!student || student.role !== "student") {
      notFound("student not found");
    }

    const id = `u-${crypto.randomBytes(6).toString("hex")}`;
    await createUser({
      id,
      email,
      name,
      role: "parent",
      schoolId: student.schoolId,
      studentId: student.id,
      password: hashPassword(body.password)
    });

    return apiSuccess(
      { ok: true },
      {
        requestId: meta.requestId,
        status: 201,
        message: "注册成功"
      }
    );
  }
});
