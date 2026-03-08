import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { deleteSchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import { v } from "@/lib/api/validation";

const paramsSchema = v.object<{ id: string }>({
  id: v.string({ minLength: 1 })
}, { allowUnknown: false });

const querySchema = v.object<{ schoolId?: string }>({
  schoolId: v.optional(v.string({ minLength: 1 }))
}, { allowUnknown: false });

export const DELETE = createLearningRoute({
  role: ["admin", "school_admin"],
  params: paramsSchema,
  query: querySchema,
  cache: "private-realtime",
  handler: async ({ user, params, query }) => {
    if (!user) forbidden("unauthorized");
    const requestedSchoolId = query.schoolId?.trim();
    const targetSchoolId = user.role === "school_admin" ? user.schoolId : requestedSchoolId;
    if (user.role === "school_admin") {
      if (!user.schoolId) forbidden("school not bound");
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) forbidden("cross school access denied");
    }
    if (!targetSchoolId) badRequest("schoolId required for platform admin");
    return { data: await deleteSchoolScheduleTemplate(params.id, { schoolId: targetSchoolId }) };
  }
});
