import { getCurrentUser } from "@/lib/auth";
import { getClassById, getClassesByStudent } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { getAssignmentsByClass } from "@/lib/assignments";
import { getModulesByClass } from "@/lib/modules";
import { getCourseFilesByClassIds } from "@/lib/course-files";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const summaryQuerySchema = v.object<{ classId: string }>(
  {
    classId: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

async function canAccessClass(userId: string, role: string, classId: string) {
  const klass = await getClassById(classId);
  if (!klass) return null;
  if (role === "teacher") {
    return klass.teacherId === userId ? klass : null;
  }
  if (role === "student") {
    const classes = await getClassesByStudent(userId);
    return classes.find((item) => item.id === classId) ?? null;
  }
  if (role === "parent") {
    const student = await getStudentContext();
    if (!student) return null;
    const classes = await getClassesByStudent(student.id);
    return classes.find((item) => item.id === classId) ?? null;
  }
  return null;
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, summaryQuerySchema);
    const classId = query.classId;
    const klass = await canAccessClass(user.id, user.role, classId);
    if (!klass) {
      notFound("not found");
    }

    const assignments = await getAssignmentsByClass(classId);
    const upcoming = assignments
      .filter((item) => new Date(item.dueDate).getTime() >= Date.now())
      .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        dueDate: item.dueDate,
        submissionType: item.submissionType ?? "quiz"
      }));

    const modules = await getModulesByClass(classId);
    const files = await getCourseFilesByClassIds([classId]);

    return {
      class: klass,
      summary: {
        moduleCount: modules.length,
        resourceCount: files.length,
        upcomingAssignments: upcoming
      }
    };
  }
});
