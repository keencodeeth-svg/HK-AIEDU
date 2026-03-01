import { createLearningRoute } from "@/lib/api/domains";
import { badRequest, forbidden } from "@/lib/api/http";
import { listSchoolUsers } from "@/lib/school-admin";
import { v } from "@/lib/api/validation";

const querySchema = v.object<{
  schoolId?: string;
  role?: "teacher" | "student" | "parent" | "school_admin";
}>(
  {
    schoolId: v.optional(v.string({ minLength: 1 })),
    role: v.optional(v.enum(["teacher", "student", "parent", "school_admin"] as const))
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
    const role = query.role;
    if (user.role === "school_admin") {
      // School admin is hard-scoped to its own tenant regardless of query params.
      if (!user.schoolId) {
        forbidden("school not bound");
      }
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        forbidden("cross school access denied");
      }
      return { data: await listSchoolUsers(user.schoolId, role) };
    }

    if (!requestedSchoolId) {
      // Platform admin must make tenant context explicit for safety.
      badRequest("schoolId required for platform admin");
    }
    return { data: await listSchoolUsers(requestedSchoolId, role) };
  }
});
