import { getQuestions } from "@/lib/content";
import { getUnifiedReviewQueue } from "@/lib/review-scheduler";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const queue = await getUnifiedReviewQueue({
      userId: user.id,
      sources: ["wrong"]
    });
    const questions = await getQuestions();
    const questionMap = new Map(questions.map((item) => [item.id, item]));

    const mapItem = (item: (typeof queue.dueToday)[number]) => ({
      ...item,
      question: (() => {
        const question = questionMap.get(item.questionId);
        if (!question) return null;
        return {
          id: question.id,
          stem: question.stem,
          options: question.options,
          subject: question.subject,
          grade: question.grade,
          knowledgePointId: question.knowledgePointId
        };
      })()
    });

    return {
      data: {
        summary: queue.summary,
        today: queue.dueToday.map(mapItem),
        upcoming: queue.upcoming.slice(0, 20).map(mapItem)
      }
    };
  }
});
