import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { getSchoolOverview } from "@/lib/school-admin";
import { v } from "@/lib/api/validation";

const querySchema = v.object<{ schoolId?: string }>(
  {
    schoolId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: ["admin", "school_admin"],
  query: querySchema,
  cache: "private-short",
  handler: async ({ user, query }) => {
    if (!user) {
      forbidden("unauthorized");
    }
    const requestedSchoolId = query.schoolId?.trim();
    if (user.role === "school_admin") {
      // School admin is hard-scoped to its own tenant regardless of query params.
      if (!user.schoolId) {
        forbidden("school not bound");
      }
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        forbidden("cross school access denied");
      }
      return { data: await getSchoolOverview(user.schoolId) };
    }

    if (!requestedSchoolId) {
      // Platform admin must make tenant context explicit for safety.
      badRequest("schoolId required for platform admin");
    }
    return { data: await getSchoolOverview(requestedSchoolId) };
  }
});
