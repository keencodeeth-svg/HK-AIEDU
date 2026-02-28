import { getCurrentUser } from "@/lib/auth";
import { getClassById, updateClassSettings } from "@/lib/classes";
import crypto from "crypto";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

function generateJoinCode() {
  return crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

const classParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const POST = createLearningRoute({
  role: "teacher",
  params: classParamsSchema,
  cache: "private-realtime",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = params.id;
    const klass = await getClassById(classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound("not found");
    }

    const updated = await updateClassSettings(classId, { joinCode: generateJoinCode() });
    return { data: updated };
  }
});
