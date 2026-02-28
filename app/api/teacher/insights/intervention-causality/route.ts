import { createLearningRoute } from "@/lib/api/domains";
import { v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { buildInterventionCausalityReport } from "@/lib/intervention-causality";

const querySchema = v.object<{ classId?: string; days?: number }>(
  {
    classId: v.optional(v.string({ minLength: 1 })),
    days: v.optional(v.number({ min: 3, max: 30, integer: true, coerce: true }))
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "teacher",
  query: querySchema,
  cache: "private-realtime",
  handler: async ({ user, query }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const report = await buildInterventionCausalityReport({
      teacherId: user.id,
      classId: query.classId,
      days: query.days
    });

    return { data: report };
  }
});

