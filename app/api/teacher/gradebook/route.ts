import { getCurrentUser } from "@/lib/auth";
import { getAssignmentsByClass, getAssignmentProgress } from "@/lib/assignments";
import { getClassById, getClassesByTeacher, getClassStudents } from "@/lib/classes";
import { parseSearchParams, v } from "@/lib/api/validation";
import { notFound, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

const gradebookQuerySchema = v.object<{
  classId?: string;
}>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classes = await getClassesByTeacher(user.id);
    if (!classes.length) {
      return { classes: [], class: null, assignments: [], students: [], summary: null };
    }

    const query = parseSearchParams(request, gradebookQuerySchema);
    const classId = query.classId ?? classes[0].id;
    const klass = classes.find((item) => item.id === classId) ?? classes[0];

    if (!klass || klass.teacherId !== user.id) {
      notFound("class not found");
    }

    const assignments = await getAssignmentsByClass(klass.id);
    const students = await getClassStudents(klass.id);

    const progressLists = await Promise.all(assignments.map((assignment) => getAssignmentProgress(assignment.id)));
    const progressMaps = progressLists.map((list) => new Map(list.map((item) => [item.studentId, item])));
    const now = Date.now();

    let totalProgress = 0;
    let completedProgress = 0;
    let scoreSum = 0;
    let totalSum = 0;

    const assignmentStats = assignments.map((assignment, index) => {
      const progress = progressLists[index] ?? [];
      const completed = progress.filter((item) => item.status === "completed").length;
      const total = students.length;
      const dueTime = new Date(assignment.dueDate).getTime();
      const pending = total - completed;
      const overdue = dueTime < now ? pending : 0;
      // Overdue is derived from unfinished students at current time, not historical due misses.
      return { assignmentId: assignment.id, completed, total, overdue };
    });

    const studentRows = students.map((student) => {
      let completed = 0;
      let pending = 0;
      let overdue = 0;
      let late = 0;
      let studentScore = 0;
      let studentTotal = 0;
      const progress: Record<
        string,
        { status: string; score: number | null; total: number | null; completedAt: string | null }
      > = {};

      assignments.forEach((assignment, index) => {
        const record = progressMaps[index]?.get(student.id) ?? null;
        const status = record?.status ?? "pending";
        const dueTime = new Date(assignment.dueDate).getTime();
        const completedAt = record?.completedAt ? new Date(record.completedAt).getTime() : null;

        if (status === "completed") {
          completed += 1;
          if (completedAt && completedAt > dueTime) {
            late += 1;
          }
        } else {
          pending += 1;
          if (dueTime < now) {
            overdue += 1;
          }
        }

        if (
          assignment.submissionType === "quiz" &&
          typeof record?.score === "number" &&
          typeof record?.total === "number" &&
          record.total > 0
        ) {
          // Gradebook averages are quiz-only to avoid mixing upload/essay scoring scales.
          studentScore += record.score;
          studentTotal += record.total;
        }

        progress[assignment.id] = {
          status,
          score: record?.score ?? null,
          total: record?.total ?? null,
          completedAt: record?.completedAt ?? null
        };
      });

      totalProgress += assignments.length;
      completedProgress += completed;
      scoreSum += studentScore;
      totalSum += studentTotal;

      const avgScore = studentTotal ? Math.round((studentScore / studentTotal) * 100) : 0;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.grade,
        stats: { completed, pending, overdue, late, avgScore },
        progress
      };
    });

    const completionRate = totalProgress ? Math.round((completedProgress / totalProgress) * 100) : 0;
    const avgScore = totalSum ? Math.round((scoreSum / totalSum) * 100) : 0;

    const distributionBuckets = [
      { label: "<60", min: 0, max: 59 },
      { label: "60-69", min: 60, max: 69 },
      { label: "70-79", min: 70, max: 79 },
      { label: "80-89", min: 80, max: 89 },
      { label: "90-100", min: 90, max: 100 }
    ];
    const distribution = distributionBuckets.map((bucket) => {
      const count = studentRows.filter(
        (student) => student.stats.avgScore >= bucket.min && student.stats.avgScore <= bucket.max
      ).length;
      return { label: bucket.label, count };
    });

    const trend = assignments
      .map((assignment, index) => {
        const progress = progressLists[index] ?? [];
        const scored = progress.filter(
          (item) => typeof item.score === "number" && typeof item.total === "number" && (item.total ?? 0) > 0
        );
        const scoreSum = scored.reduce((sum, item) => sum + (item.score ?? 0), 0);
        const totalSum = scored.reduce((sum, item) => sum + (item.total ?? 0), 0);
        const avgScore = totalSum ? Math.round((scoreSum / totalSum) * 100) : 0;
        const completed = progress.filter((item) => item.status === "completed").length;
        const completionRate = students.length ? Math.round((completed / students.length) * 100) : 0;
        return {
          assignmentId: assignment.id,
          title: assignment.title,
          dueDate: assignment.dueDate,
          avgScore,
          completionRate
        };
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    // Trend is ordered by due date to reflect teacher planning timeline.

    return {
      classes,
      class: klass,
      assignments,
      assignmentStats,
      students: studentRows,
      summary: {
        students: students.length,
        assignments: assignments.length,
        completionRate,
        avgScore
      },
      distribution,
      trend
    };
  }
});
