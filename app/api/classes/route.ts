import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import { getStudentContext } from "@/lib/user-context";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    if (user.role === "teacher") {
      const classes = await getClassesByTeacher(user.id);
      return { data: classes };
    }

    if (user.role === "student") {
      const classes = await getClassesByStudent(user.id);
      return { data: classes };
    }

    if (user.role === "parent") {
      const student = await getStudentContext();
      if (!student) return { data: [] };
      const classes = await getClassesByStudent(student.id);
      return { data: classes };
    }

    return { data: [] };
  }
});
