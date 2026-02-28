import {
  getAssignmentById,
  getAssignmentItems,
  getAssignmentProgress,
  getAssignmentSubmissionsByAssignment
} from "@/lib/assignments";
import { getClassById, getClassStudents } from "@/lib/classes";
import { getQuestions } from "@/lib/content";
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
    const completed = progress.filter((item) => item.status === "completed").length;
    const pending = students.length - completed;
    const dueTime = new Date(assignment.dueDate).getTime();
    const overdue = progress.filter((item) => item.status !== "completed" && dueTime < Date.now()).length;

    const scored = progress.filter(
      (item) => typeof item.score === "number" && typeof item.total === "number" && (item.total ?? 0) > 0
    );
    const scoreSum = scored.reduce((sum, item) => sum + (item.score ?? 0), 0);
    const totalSum = scored.reduce((sum, item) => sum + (item.total ?? 0), 0);
    const avgScore = totalSum ? Math.round((scoreSum / totalSum) * 100) : 0;
    const maxScore = scored.length
      ? Math.max(...scored.map((item) => Math.round(((item.score ?? 0) / (item.total ?? 1)) * 100)))
      : 0;
    const minScore = scored.length
      ? Math.min(...scored.map((item) => Math.round(((item.score ?? 0) / (item.total ?? 1)) * 100)))
      : 0;

    const distributionBuckets = [
      { label: "<60", min: 0, max: 59 },
      { label: "60-69", min: 60, max: 69 },
      { label: "70-79", min: 70, max: 79 },
      { label: "80-89", min: 80, max: 89 },
      { label: "90-100", min: 90, max: 100 }
    ];
    const distribution = distributionBuckets.map((bucket) => {
      const count = scored.filter((item) => {
        const ratio = Math.round(((item.score ?? 0) / (item.total ?? 1)) * 100);
        return ratio >= bucket.min && ratio <= bucket.max;
      }).length;
      return { label: bucket.label, count };
    });

    let questionStats: Array<{ id: string; stem: string; correct: number; total: number; ratio: number }> = [];
    if (assignment.submissionType === "quiz") {
      const items = await getAssignmentItems(assignment.id);
      const questions = await getQuestions();
      const questionMap = new Map(questions.map((item) => [item.id, item]));
      const submissions = await getAssignmentSubmissionsByAssignment(assignment.id);

      questionStats = items
        .map((item) => {
          const question = questionMap.get(item.questionId);
          if (!question) return null;
          let correct = 0;
          let total = 0;
          submissions.forEach((submission) => {
            const answer = submission.answers?.[question.id];
            total += 1;
            if (answer === question.answer) correct += 1;
          });
          const ratio = total ? Math.round((correct / total) * 100) : 0;
          return { id: question.id, stem: question.stem, correct, total, ratio };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    return {
      assignment,
      class: klass,
      summary: {
        students: students.length,
        completed,
        pending,
        overdue,
        avgScore,
        maxScore,
        minScore
      },
      distribution,
      questionStats
    };
  }
});
