import { getAssignmentById, getAssignmentProgress } from "@/lib/assignments";
import { getClassById, getClassStudents } from "@/lib/classes";
import { getModuleById } from "@/lib/modules";
import { notFound, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ params, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const assignmentId = params.id;
    const assignment = await getAssignmentById(assignmentId);
    if (!assignment) {
      notFound();
    }

    const klass = await getClassById(assignment.classId);
    if (!klass || klass.teacherId !== user.id) {
      notFound();
    }

    const students = await getClassStudents(assignment.classId);
    const progress = await getAssignmentProgress(assignment.id);
    const progressMap = new Map(progress.map((item) => [item.studentId, item]));

    const roster = students.map((student) => {
      const record = progressMap.get(student.id);
      return {
        ...student,
        status: record?.status ?? "pending",
        score: record?.score ?? null,
        total: record?.total ?? null,
        completedAt: record?.completedAt ?? null
      };
    });

    return {
      assignment,
      module: assignment.moduleId ? await getModuleById(assignment.moduleId) : null,
      class: klass,
      students: roster
    };
  }
});
