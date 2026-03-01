import { getClassById, getClassStudentIds, getClassesByTeacher } from "@/lib/classes";
import { getAssignmentsByClassIds, getAssignmentProgress } from "@/lib/assignments";
import { getKnowledgePoints } from "@/lib/content";
import { getAttemptsByUsers } from "@/lib/progress";
import { generateLearningReport } from "@/lib/ai";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const reportBodySchema = v.object<{ classId?: string }>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, reportBodySchema);
    const classId = body.classId ?? "";

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

    const classIds = targetClasses.map((item) => item.id);
    const studentSet = new Set<string>();
    for (const klass of targetClasses) {
      const ids = await getClassStudentIds(klass.id);
      ids.forEach((id) => studentSet.add(id));
    }
    const studentIds = Array.from(studentSet);

    const assignments = await getAssignmentsByClassIds(classIds);
    const progressLists = await Promise.all(assignments.map((item) => getAssignmentProgress(item.id)));
    const progress = progressLists.flat();
    const completed = progress.filter((item) => item.status === "completed").length;
    const totalProgress = progress.length;
    const completionRate = totalProgress ? Math.round((completed / totalProgress) * 100) : 0;

    const scored = progress.filter(
      (item) => typeof item.score === "number" && typeof item.total === "number" && (item.total ?? 0) > 0
    );
    const scoreSum = scored.reduce((sum, item) => sum + (item.score ?? 0), 0);
    const totalSum = scored.reduce((sum, item) => sum + (item.total ?? 0), 0);
    const accuracy = totalSum ? Math.round((scoreSum / totalSum) * 100) : 0;

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
    const weakPoints = Array.from(kpStats.entries())
      .map(([id, stat]) => {
        const kp = kpMap.get(id);
        const ratio = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
        return {
          id,
          title: kp?.title ?? "未知知识点",
          ratio,
          total: stat.total
        };
      })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);

    const summaryLine = `班级数 ${targetClasses.length}；学生数 ${studentIds.length}；作业完成率 ${completionRate}%；总体正确率 ${accuracy}%。`;
    const report =
      (await generateLearningReport({
        className: classId ? targetClasses[0]?.name : undefined,
        summary: summaryLine,
        weakPoints: weakPoints.map((item) => item.title)
      })) ?? {
        // Deterministic fallback keeps report endpoint usable when model chain is unavailable.
        report: `本阶段共覆盖 ${studentIds.length} 名学生，作业完成率 ${completionRate}%，总体正确率 ${accuracy}%。建议聚焦薄弱知识点并安排针对练习。`,
        highlights: [`作业完成率 ${completionRate}%`, `总体正确率 ${accuracy}%`],
        reminders: weakPoints.map((item) => `重点关注：${item.title}`)
      };

    return {
      data: {
        classId: classId || "all",
        summary: {
          classes: targetClasses.length,
          students: studentIds.length,
          assignments: assignments.length,
          completionRate,
          accuracy
        },
        weakPoints,
        report
      }
    };
  }
});
