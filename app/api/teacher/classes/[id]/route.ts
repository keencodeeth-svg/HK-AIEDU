import { getCurrentUser } from "@/lib/auth";
import { getClassById, updateClassSettings } from "@/lib/classes";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const updateClassBodySchema = v.object<{
  joinMode?: "approval" | "auto";
}>(
  {
    joinMode: v.optional(v.enum(["approval", "auto"] as const))
  },
  { allowUnknown: false }
);

const classParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const PATCH = createLearningRoute({
  role: "teacher",
  params: classParamsSchema,
  body: updateClassBodySchema,
  cache: "private-realtime",
  handler: async ({ params, body, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = params.id;
    const klass = await getClassById(classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const updated = await updateClassSettings(classId, { joinMode: body.joinMode });
    return { data: updated };
  }
});
