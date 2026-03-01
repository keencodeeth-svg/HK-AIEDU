import { getClassById, getClassStudentIds, getClassesByTeacher } from "@/lib/classes";
import { getKnowledgePoints } from "@/lib/content";
import { getAttemptsByUsers } from "@/lib/progress";
import { notFound, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const heatmapQuerySchema = v.object<{ classId?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  role: "teacher",
  query: heatmapQuerySchema,
  cache: "private-realtime",
  handler: async ({ query, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classId = query.classId ?? "";

    let targetClasses: Awaited<ReturnType<typeof getClassesByTeacher>> = [];
    if (classId) {
      const klass = await getClassById(classId);
      if (!klass || klass.teacherId !== user.id) {
        notFound("not found");
      }
      targetClasses = [klass];
    } else {
      targetClasses = await getClassesByTeacher(user.id);
    }

    const studentSet = new Set<string>();
    for (const klass of targetClasses) {
      const ids = await getClassStudentIds(klass.id);
      ids.forEach((id) => studentSet.add(id));
    }
    const studentIds = Array.from(studentSet);
    const attempts = await getAttemptsByUsers(studentIds);
    const kpStats = new Map<string, { correct: number; total: number }>();
    attempts.forEach((attempt) => {
      const current = kpStats.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
      current.total += 1;
      current.correct += attempt.correct ? 1 : 0;
      kpStats.set(attempt.knowledgePointId, current);
    });

    const knowledgePoints = await getKnowledgePoints();
    const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp]));

    const items = Array.from(kpStats.entries())
      .map(([id, stat]) => {
        const kp = kpMap.get(id);
        const ratio = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
        return {
          id,
          title: kp?.title ?? "未知知识点",
          chapter: kp?.chapter ?? "",
          unit: kp?.unit ?? "",
          subject: kp?.subject ?? "-",
          grade: kp?.grade ?? "-",
          ratio,
          total: stat.total
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
    // Heatmap sorts by lowest ratio first to surface weakest knowledge points on top.

    return {
      data: {
        classId: classId || "all",
        classes: targetClasses.map((item) => ({ id: item.id, name: item.name })),
        items
      }
    };
  }
});
