import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent } from "@/lib/classes";
import { getAssignmentsByClassIds, getAssignmentProgressByStudent } from "@/lib/assignments";
import { getModulesByClass } from "@/lib/modules";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const classes = await getClassesByStudent(user.id);
    const assignments = await getAssignmentsByClassIds(classes.map((item) => item.id));
    const progress = await getAssignmentProgressByStudent(user.id);
    const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));

    const modulesByClass = new Map<string, any[]>();
    for (const klass of classes) {
      const modules = await getModulesByClass(klass.id);
      modulesByClass.set(klass.id, modules);
    }

    const data = classes.map((klass) => {
      const modules = modulesByClass.get(klass.id) ?? [];
      const moduleItems = modules.map((module) => {
        const moduleAssignments = assignments.filter((assignment) => assignment.moduleId === module.id);
        const completed = moduleAssignments.filter(
          (assignment) => progressMap.get(assignment.id)?.status === "completed"
        );
        return {
          ...module,
          assignmentCount: moduleAssignments.length,
          completedCount: completed.length
        };
      });
      return {
        classId: klass.id,
        className: klass.name,
        subject: klass.subject,
        grade: klass.grade,
        modules: moduleItems
      };
    });

    return { data };
  }
});
