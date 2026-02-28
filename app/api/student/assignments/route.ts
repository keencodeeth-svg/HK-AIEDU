import { getClassesByStudent } from "@/lib/classes";
import { getAssignmentProgressByStudent, getAssignmentsByClassIds } from "@/lib/assignments";
import { getModulesByClass } from "@/lib/modules";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-short",
  handler: async ({ user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const classes = await getClassesByStudent(user.id);
    const classMap = new Map(classes.map((item) => [item.id, item]));
    const assignments = await getAssignmentsByClassIds(classes.map((item) => item.id));
    const progress = await getAssignmentProgressByStudent(user.id);
    const progressMap = new Map(progress.map((item) => [item.assignmentId, item]));
    const moduleMap = new Map<string, { id: string; title: string }>();
    for (const klass of classes) {
      const modules = await getModulesByClass(klass.id);
      modules.forEach((module) => moduleMap.set(module.id, module));
    }

    const data = assignments.map((assignment) => {
      const klass = classMap.get(assignment.classId);
      const record = progressMap.get(assignment.id);
      return {
        ...assignment,
        className: klass?.name ?? "-",
        classSubject: klass?.subject ?? "-",
        classGrade: klass?.grade ?? "-",
        moduleTitle: assignment.moduleId ? moduleMap.get(assignment.moduleId)?.title ?? "" : "",
        status: record?.status ?? "pending",
        score: record?.score ?? null,
        total: record?.total ?? null,
        completedAt: record?.completedAt ?? null
      };
    });

    return { data };
  }
});
