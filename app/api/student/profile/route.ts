import { badRequest } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";
import { v } from "@/lib/api/validation";
import { getStudentProfile, upsertStudentProfile } from "@/lib/profiles";
import {
  calculateStudentPersonaCompleteness,
  STUDENT_EYESIGHT_LEVEL_VALUES,
  STUDENT_GENDER_VALUES,
  STUDENT_PERSONALITY_VALUES,
  STUDENT_PERSONA_MUTABLE_FIELDS,
  STUDENT_SEAT_PREFERENCE_VALUES
} from "@/lib/student-persona-options";
import { getStudentPersona, upsertStudentPersona } from "@/lib/student-personas";

const updateProfileBodySchema = v.object<{
  grade?: string;
  subjects?: string[];
  target?: string;
  school?: string;
  preferredName?: string;
  gender?: (typeof STUDENT_GENDER_VALUES)[number];
  heightCm?: number;
  eyesightLevel?: (typeof STUDENT_EYESIGHT_LEVEL_VALUES)[number];
  seatPreference?: (typeof STUDENT_SEAT_PREFERENCE_VALUES)[number];
  personality?: (typeof STUDENT_PERSONALITY_VALUES)[number];
  strengths?: string;
  supportNotes?: string;
}>(
  {
    grade: v.optional(v.string({ minLength: 1 })),
    subjects: v.optional(v.array(v.string({ minLength: 1 }))),
    target: v.optional(v.string({ allowEmpty: true, trim: false })),
    school: v.optional(v.string({ allowEmpty: true, trim: false })),
    preferredName: v.optional(v.string({ allowEmpty: true })),
    gender: v.optional(v.enum(STUDENT_GENDER_VALUES)),
    heightCm: v.optional(v.number({ integer: true, min: 100, max: 220 })),
    eyesightLevel: v.optional(v.enum(STUDENT_EYESIGHT_LEVEL_VALUES)),
    seatPreference: v.optional(v.enum(STUDENT_SEAT_PREFERENCE_VALUES)),
    personality: v.optional(v.enum(STUDENT_PERSONALITY_VALUES)),
    strengths: v.optional(v.string({ allowEmpty: true, trim: false })),
    supportNotes: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

function buildMergedProfile(
  userId: string,
  profile: Awaited<ReturnType<typeof getStudentProfile>>,
  persona: Awaited<ReturnType<typeof getStudentPersona>>
) {
  const completeness = calculateStudentPersonaCompleteness(persona);

  return {
    userId,
    grade: profile?.grade ?? "",
    subjects: profile?.subjects ?? [],
    target: profile?.target ?? "",
    school: profile?.school ?? "",
    observerCode: profile?.observerCode,
    preferredName: persona?.preferredName ?? "",
    gender: persona?.gender,
    heightCm: persona?.heightCm,
    eyesightLevel: persona?.eyesightLevel,
    seatPreference: persona?.seatPreference,
    personality: persona?.personality,
    strengths: persona?.strengths ?? "",
    supportNotes: persona?.supportNotes ?? "",
    profileCompleteness: completeness.percentage,
    missingPersonaFields: completeness.missingFields,
    updatedAt: persona?.updatedAt ?? profile?.updatedAt ?? new Date().toISOString()
  };
}

export const GET = createLearningRoute({
  role: "student",
  cache: "private-short",
  handler: async ({ user }) => {
    const studentUser = user!;
    const [profile, persona] = await Promise.all([
      getStudentProfile(studentUser.id),
      getStudentPersona(studentUser.id)
    ]);
    return { data: buildMergedProfile(studentUser.id, profile, persona) };
  }
});

export const PUT = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    const studentUser = user!;
    let rawBody: unknown = null;
    try {
      rawBody = await request.json();
    } catch {
      badRequest("invalid json body");
    }

    const body = updateProfileBodySchema(rawBody, "body");
    const rawRecord = rawBody as Record<string, unknown>;

    if (!body.grade || !body.subjects?.length) {
      badRequest("missing fields");
    }

    const profile = await upsertStudentProfile({
      userId: studentUser.id,
      grade: body.grade,
      subjects: body.subjects,
      target: body.target ?? "",
      school: body.school ?? ""
    });

    const hasPersonaPatch = STUDENT_PERSONA_MUTABLE_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(rawRecord, field)
    );
    const persona = hasPersonaPatch
      ? await upsertStudentPersona({
          userId: studentUser.id,
          preferredName: Object.prototype.hasOwnProperty.call(rawRecord, "preferredName")
            ? body.preferredName ?? null
            : undefined,
          gender: Object.prototype.hasOwnProperty.call(rawRecord, "gender") ? body.gender ?? null : undefined,
          heightCm: Object.prototype.hasOwnProperty.call(rawRecord, "heightCm") ? body.heightCm ?? null : undefined,
          eyesightLevel: Object.prototype.hasOwnProperty.call(rawRecord, "eyesightLevel")
            ? body.eyesightLevel ?? null
            : undefined,
          seatPreference: Object.prototype.hasOwnProperty.call(rawRecord, "seatPreference")
            ? body.seatPreference ?? null
            : undefined,
          personality: Object.prototype.hasOwnProperty.call(rawRecord, "personality")
            ? body.personality ?? null
            : undefined,
          strengths: Object.prototype.hasOwnProperty.call(rawRecord, "strengths") ? body.strengths ?? null : undefined,
          supportNotes: Object.prototype.hasOwnProperty.call(rawRecord, "supportNotes")
            ? body.supportNotes ?? null
            : undefined
        })
      : await getStudentPersona(studentUser.id);

    return { data: buildMergedProfile(studentUser.id, profile, persona) };
  }
});
