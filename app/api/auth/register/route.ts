import crypto from "crypto";
import { createUser, getUserByEmail, getUserById, hashPassword } from "@/lib/auth";
import { SUBJECT_OPTIONS } from "@/lib/constants";
import { getStudentProfileByObserverCode, upsertStudentProfile } from "@/lib/profiles";
import { validatePasswordPolicy } from "@/lib/password";
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
}>(
  {
    role: v.enum(["student", "parent"] as const),
    email: v.string({ minLength: 1 }),
    password: v.string({ minLength: 1 }),
    name: v.string({ minLength: 1 }),
    grade: v.optional(v.string({ minLength: 1 })),
    studentEmail: v.optional(v.string({ minLength: 1 })),
    observerCode: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createAuthRoute({
  cache: "private-realtime",
  handler: async ({ request, meta }) => {
    const body = await parseJson(request, registerBodySchema);
    const passwordValidation = validatePasswordPolicy(body.password);
    if (!passwordValidation.ok) {
      badRequest(passwordValidation.errors[0], {
        passwordPolicy: passwordValidation.policy,
        errors: passwordValidation.errors
      });
    }

    const existing = await getUserByEmail(body.email);
    if (existing) {
      conflict("email exists");
    }

    if (body.role === "student") {
      if (!body.grade) {
        badRequest("grade required");
      }

      const id = `u-${crypto.randomBytes(6).toString("hex")}`;
      await createUser({
        id,
        email: body.email,
        name: body.name,
        role: "student",
        grade: body.grade,
        password: hashPassword(body.password)
      });

      await upsertStudentProfile({
        userId: id,
        grade: body.grade,
        subjects: SUBJECT_OPTIONS.map((item) => item.value),
        target: "",
        school: ""
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

    let student = null;
    const observerCode = body.observerCode?.trim();

    if (observerCode) {
      const profile = await getStudentProfileByObserverCode(observerCode);
      if (!profile) {
        notFound("observer code invalid");
      }
      student = await getUserById(profile.userId);
    } else if (body.studentEmail) {
      student = await getUserByEmail(body.studentEmail);
    } else {
      badRequest("studentEmail or observerCode required");
    }

    if (!student || student.role !== "student") {
      notFound("student not found");
    }

    const id = `u-${crypto.randomBytes(6).toString("hex")}`;
    await createUser({
      id,
      email: body.email,
      name: body.name,
      role: "parent",
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
