import { getCurrentUser } from "@/lib/auth";
import { getKnowledgePoints } from "@/lib/content";
import { getAttemptsByUser } from "@/lib/progress";
import { getAssignmentSubmissionsByStudent } from "@/lib/assignments";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const attempts = await getAttemptsByUser(user.id);
    const submissions = await getAssignmentSubmissionsByStudent(user.id);
    const knowledgePoints = await getKnowledgePoints();
    const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp]));

    const total = attempts.length;
    const correct = attempts.filter((item) => item.correct).length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    const last7 = attempts.filter((item) => Date.now() - new Date(item.createdAt).getTime() <= 7 * 86400000);
    const last7Total = last7.length;
    const last7Correct = last7.filter((item) => item.correct).length;
    const last7Accuracy = last7Total ? Math.round((last7Correct / last7Total) * 100) : 0;

    const subjectStats = new Map<string, { correct: number; total: number }>();
    attempts.forEach((item) => {
      const current = subjectStats.get(item.subject) ?? { correct: 0, total: 0 };
      current.total += 1;
      current.correct += item.correct ? 1 : 0;
      subjectStats.set(item.subject, current);
    });

    const subjects = Array.from(subjectStats.entries()).map(([subject, stat]) => ({
      subject,
      accuracy: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0,
      total: stat.total
    }));

    const kpStats = new Map<string, { correct: number; total: number }>();
    attempts.forEach((item) => {
      const current = kpStats.get(item.knowledgePointId) ?? { correct: 0, total: 0 };
      current.total += 1;
      current.correct += item.correct ? 1 : 0;
      kpStats.set(item.knowledgePointId, current);
    });

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
      .slice(0, 6);

    const assignments = submissions.map((item) => ({
      assignmentId: item.assignmentId,
      score: item.score,
      total: item.total,
      submittedAt: item.submittedAt
    }));

    return {
      summary: {
        totalAttempts: total,
        accuracy,
        last7Total,
        last7Accuracy,
        assignmentsCompleted: submissions.length
      },
      subjects,
      weakPoints,
      assignments
    };
  }
});
