import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { generateAndApplySchoolAiSchedule, type SchoolAiScheduleMode } from "@/lib/school-schedule-ai";
import { v } from "@/lib/api/validation";

const bodySchema = v.object<{
  schoolId?: string;
  classIds?: string[];
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: number[];
  dayStartTime: string;
  shortBreakMinutes?: number;
  lunchBreakAfterPeriod?: number;
  lunchBreakMinutes?: number;
  mode?: SchoolAiScheduleMode;
  campus?: string;
}>(
  {
    schoolId: v.optional(v.string({ minLength: 1 })),
    classIds: v.optional(v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 500 })),
    weeklyLessonsPerClass: v.number({ coerce: true, integer: true, min: 1, max: 30 }),
    lessonDurationMinutes: v.number({ coerce: true, integer: true, min: 30, max: 120 }),
    periodsPerDay: v.number({ coerce: true, integer: true, min: 1, max: 12 }),
    weekdays: v.array(v.number({ coerce: true, integer: true, min: 1, max: 7 }), { minLength: 1, maxLength: 7 }),
    dayStartTime: v.string({ minLength: 5 }),
    shortBreakMinutes: v.optional(v.number({ coerce: true, integer: true, min: 0, max: 30 })),
    lunchBreakAfterPeriod: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 12 })),
    lunchBreakMinutes: v.optional(v.number({ coerce: true, integer: true, min: 0, max: 180 })),
    mode: v.optional(v.enum(["fill_missing", "replace_all"] as const)),
    campus: v.optional(v.string({ allowEmpty: true, trim: false, maxLength: 80 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: ["admin", "school_admin"],
  body: bodySchema,
  cache: "private-realtime",
  handler: async ({ user, body }) => {
    if (!user) {
      forbidden("unauthorized");
    }

    const requestedSchoolId = body.schoolId?.trim();
    const targetSchoolId = user.role === "school_admin" ? user.schoolId : requestedSchoolId;

    if (user.role === "school_admin") {
      if (!user.schoolId) {
        forbidden("school not bound");
      }
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        forbidden("cross school access denied");
      }
    }

    if (!targetSchoolId) {
      badRequest("schoolId required for platform admin");
    }

    return {
      data: await generateAndApplySchoolAiSchedule({
        schoolId: targetSchoolId,
        classIds: body.classIds,
        weeklyLessonsPerClass: body.weeklyLessonsPerClass,
        lessonDurationMinutes: body.lessonDurationMinutes,
        periodsPerDay: body.periodsPerDay,
        weekdays: body.weekdays as Array<1 | 2 | 3 | 4 | 5 | 6 | 7>,
        dayStartTime: body.dayStartTime,
        shortBreakMinutes: body.shortBreakMinutes ?? 10,
        lunchBreakAfterPeriod: body.lunchBreakAfterPeriod,
        lunchBreakMinutes: body.lunchBreakMinutes ?? 60,
        mode: body.mode ?? "fill_missing",
        campus: body.campus
      })
    };
  }
});
