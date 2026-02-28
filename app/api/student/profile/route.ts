import { getCurrentUser } from "@/lib/auth";
import { getStudentProfile, upsertStudentProfile } from "@/lib/profiles";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const updateProfileBodySchema = v.object<{
  grade?: string;
  subjects?: string[];
  target?: string;
  school?: string;
}>(
  {
    grade: v.optional(v.string({ minLength: 1 })),
    subjects: v.optional(v.array(v.string({ minLength: 1 }))),
    target: v.optional(v.string({ allowEmpty: true, trim: false })),
    school: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const profile = await getStudentProfile(user.id);
    return { data: profile };
  }
});

export const PUT = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, updateProfileBodySchema);

    if (!body.grade || !body.subjects?.length) {
      badRequest("missing fields");
    }

    const profile = await upsertStudentProfile({
      userId: user.id,
      grade: body.grade,
      subjects: body.subjects,
      target: body.target ?? "",
      school: body.school ?? ""
    });

    return { data: profile };
  }
});
