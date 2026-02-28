import { getParentsByStudentId } from "@/lib/auth";
import { getClassesByTeacher, getClassStudentIds } from "@/lib/classes";
import { getAssignmentsByClassIds, getAssignmentProgress } from "@/lib/assignments";
import { getKnowledgePoints } from "@/lib/content";
import { getAttemptsByUsers } from "@/lib/progress";
import { getTeacherAlerts } from "@/lib/teacher-alerts";
import { listParentActionReceipts } from "@/lib/parent-action-receipts";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  role: "teacher",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const classes = await getClassesByTeacher(user.id);
    const classIds = classes.map((item) => item.id);

    const studentSet = new Set<string>();
    for (const klass of classes) {
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
          subject: kp?.subject ?? "-",
          grade: kp?.grade ?? "-",
          ratio,
          total: stat.total
        };
      })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);

    const alertsOverview = await getTeacherAlerts({
      teacherId: user.id,
      includeAcknowledged: true
    });

    const parentPairs = (
      await Promise.all(
        studentIds.map(async (studentId) => ({
          studentId,
          parents: await getParentsByStudentId(studentId)
        }))
      )
    ).flatMap((item) => item.parents.map((parent) => ({ studentId: item.studentId, parentId: parent.id })));

    const receiptLists = await Promise.all(
      parentPairs.map((pair) =>
        listParentActionReceipts({
          parentId: pair.parentId,
          studentId: pair.studentId
        })
      )
    );

    const start7d = new Date();
    start7d.setDate(start7d.getDate() - 6);
    start7d.setHours(0, 0, 0, 0);
    const start7dTs = start7d.getTime();

    let receiptCount = 0;
    let doneCount = 0;
    let skippedCount = 0;
    let doneMinutes = 0;
    let effectScoreSum = 0;
    let last7dDoneCount = 0;
    let last7dSkippedCount = 0;
    const sourceStats = {
      weeklyReport: { total: 0, done: 0 },
      assignmentPlan: { total: 0, done: 0 }
    };
    const activeParentSet = new Set<string>();
    const coveredStudentSet = new Set<string>();

    receiptLists.forEach((receipts, index) => {
      const pair = parentPairs[index];
      if (!pair) return;
      let hasRecentAction = false;

      receipts.forEach((item) => {
        receiptCount += 1;
        const isDone = item.status === "done";
        const isSkipped = item.status === "skipped";
        if (isDone) {
          doneCount += 1;
          doneMinutes += Math.max(0, Math.round(item.estimatedMinutes || 0));
        }
        if (isSkipped) {
          skippedCount += 1;
        }
        effectScoreSum += Number(item.effectScore) || 0;

        if (item.source === "weekly_report") {
          sourceStats.weeklyReport.total += 1;
          if (isDone) sourceStats.weeklyReport.done += 1;
        } else {
          sourceStats.assignmentPlan.total += 1;
          if (isDone) sourceStats.assignmentPlan.done += 1;
        }

        const ts = new Date(item.completedAt).getTime();
        if (Number.isFinite(ts) && ts >= start7dTs) {
          hasRecentAction = true;
          if (isDone) last7dDoneCount += 1;
          if (isSkipped) last7dSkippedCount += 1;
        }
      });

      if (receipts.length > 0) {
        coveredStudentSet.add(pair.studentId);
      }
      if (hasRecentAction) {
        activeParentSet.add(pair.parentId);
      }
    });

    const trackedActionCount = doneCount + skippedCount;
    const last7dTrackedCount = last7dDoneCount + last7dSkippedCount;
    const totalParentSet = new Set(parentPairs.map((item) => item.parentId));

    return {
      summary: {
        classes: classes.length,
        students: studentIds.length,
        assignments: assignments.length,
        completionRate,
        accuracy,
        classRiskScore: alertsOverview.summary.classRiskScore,
        activeAlerts: alertsOverview.summary.activeAlerts,
        highRiskAlerts: alertsOverview.summary.highRiskAlerts,
        parentCollaboration: {
          totalParentCount: totalParentSet.size,
          activeParentCount7d: activeParentSet.size,
          coveredStudentCount: coveredStudentSet.size,
          receiptCount,
          doneMinutes,
          doneRate: trackedActionCount ? Math.round((doneCount / trackedActionCount) * 100) : 0,
          last7dDoneRate: last7dTrackedCount ? Math.round((last7dDoneCount / last7dTrackedCount) * 100) : 0,
          avgEffectScore: receiptCount ? Math.round(effectScoreSum / receiptCount) : 0,
          sourceDoneRate: {
            weeklyReport: sourceStats.weeklyReport.total
              ? Math.round((sourceStats.weeklyReport.done / sourceStats.weeklyReport.total) * 100)
              : 0,
            assignmentPlan: sourceStats.assignmentPlan.total
              ? Math.round((sourceStats.assignmentPlan.done / sourceStats.assignmentPlan.total) * 100)
              : 0
          }
        }
      },
      weakPoints,
      riskClasses: alertsOverview.classRisk.slice(0, 5),
      riskStudents: alertsOverview.riskStudents.slice(0, 8),
      riskKnowledgePoints: alertsOverview.riskKnowledgePoints.slice(0, 8),
      alerts: alertsOverview.alerts.slice(0, 12)
    };
  }
});
