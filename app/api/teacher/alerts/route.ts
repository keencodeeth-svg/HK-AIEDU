import { getClassById } from "@/lib/classes";
import { getTeacherAlerts } from "@/lib/teacher-alerts";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const teacherAlertsQuerySchema = v.object<{ classId?: string; includeAcknowledged?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    includeAcknowledged: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "teacher",
  query: teacherAlertsQuerySchema,
  cache: "private-realtime",
  handler: async ({ query, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = query.classId;
    if (classId) {
      const klass = await getClassById(classId);
      if (!klass || klass.teacherId !== user.id) {
        notFound("not found");
      }
    }

    const includeAcknowledged = query.includeAcknowledged !== "false";
    // Include acknowledged by default so teachers can audit handled alerts.
    const overview = await getTeacherAlerts({
      teacherId: user.id,
      classId,
      includeAcknowledged
    });

    return { data: overview };
  }
});
