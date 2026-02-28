import { getCurrentUser, getUserById } from "@/lib/auth";
import { getClassesByTeacher, getJoinRequestsByTeacher, getClassById } from "@/lib/classes";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-short",
  handler: async ({ user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const requests = await getJoinRequestsByTeacher(user.id);
    const classes = await getClassesByTeacher(user.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));

    const data = await Promise.all(
      requests.map(async (req) => {
        const klass = classMap.get(req.classId) ?? (await getClassById(req.classId));
        const student = await getUserById(req.studentId);
        return {
          ...req,
          className: klass?.name ?? "-",
          subject: klass?.subject ?? "-",
          grade: klass?.grade ?? "-",
          studentName: student?.name ?? "-",
          studentEmail: student?.email ?? "-"
        };
      })
    );

    return { data };
  }
});
