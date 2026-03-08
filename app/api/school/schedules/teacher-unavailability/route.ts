import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { createTeacherUnavailableSlot, listTeacherUnavailableSlots } from "@/lib/teacher-unavailability";
import { v } from "@/lib/api/validation";

const querySchema = v.object<{ schoolId?: string; teacherId?: string }>({
  schoolId: v.optional(v.string({ minLength: 1 })),
  teacherId: v.optional(v.string({ minLength: 1 }))
}, { allowUnknown: false });

const bodySchema = v.object<{
  schoolId?: string;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  reason?: string;
}>({
  schoolId: v.optional(v.string({ minLength: 1 })),
  teacherId: v.string({ minLength: 1 }),
  weekday: v.number({ coerce: true, integer: true, min: 1, max: 7 }),
  startTime: v.string({ minLength: 1 }),
  endTime: v.string({ minLength: 1 }),
  reason: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 120 }))
}, { allowUnknown: false });

export const GET = createLearningRoute({
  role: ["admin", "school_admin"],
  query: querySchema,
  cache: "private-short",
  handler: async ({ user, query }) => {
    if (!user) forbidden("unauthorized");
    const requestedSchoolId = query.schoolId?.trim();
    const targetSchoolId = user.role === "school_admin" ? user.schoolId : requestedSchoolId;
    if (user.role === "school_admin") {
      if (!user.schoolId) forbidden("school not bound");
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) forbidden("cross school access denied");
    }
    if (!targetSchoolId) badRequest("schoolId required for platform admin");
    return { data: await listTeacherUnavailableSlots({ schoolId: targetSchoolId, teacherId: query.teacherId }) };
  }
});

export const POST = createLearningRoute({
  role: ["admin", "school_admin"],
  body: bodySchema,
  cache: "private-realtime",
  handler: async ({ user, body }) => {
    if (!user) forbidden("unauthorized");
    const requestedSchoolId = body.schoolId?.trim();
    const targetSchoolId = user.role === "school_admin" ? user.schoolId : requestedSchoolId;
    if (user.role === "school_admin") {
      if (!user.schoolId) forbidden("school not bound");
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) forbidden("cross school access denied");
    }
    if (!targetSchoolId) badRequest("schoolId required for platform admin");
    return { data: await createTeacherUnavailableSlot({ ...body, schoolId: targetSchoolId }) };
  }
});
