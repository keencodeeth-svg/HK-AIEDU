import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { listSchoolScheduleTemplates, saveSchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import { v } from "@/lib/api/validation";

const querySchema = v.object<{ schoolId?: string }>({
  schoolId: v.optional(v.string({ minLength: 1 }))
}, { allowUnknown: false });

const bodySchema = v.object<{
  id?: string;
  schoolId?: string;
  grade: string;
  subject: string;
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: number[];
  dayStartTime: string;
  shortBreakMinutes: number;
  lunchBreakAfterPeriod?: number;
  lunchBreakMinutes: number;
  campus?: string;
}>({
  id: v.optional(v.string({ minLength: 1 })),
  schoolId: v.optional(v.string({ minLength: 1 })),
  grade: v.string({ minLength: 1 }),
  subject: v.string({ minLength: 1 }),
  weeklyLessonsPerClass: v.number({ coerce: true, integer: true, min: 1, max: 30 }),
  lessonDurationMinutes: v.number({ coerce: true, integer: true, min: 30, max: 120 }),
  periodsPerDay: v.number({ coerce: true, integer: true, min: 1, max: 12 }),
  weekdays: v.array(v.number({ coerce: true, integer: true, min: 1, max: 7 }), { minLength: 1, maxLength: 7 }),
  dayStartTime: v.string({ minLength: 5 }),
  shortBreakMinutes: v.number({ coerce: true, integer: true, min: 0, max: 30 }),
  lunchBreakAfterPeriod: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 12 })),
  lunchBreakMinutes: v.number({ coerce: true, integer: true, min: 0, max: 180 }),
  campus: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 80 }))
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
    return { data: await listSchoolScheduleTemplates({ schoolId: targetSchoolId }) };
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
    return { data: await saveSchoolScheduleTemplate({ ...body, schoolId: targetSchoolId }) };
  }
});
