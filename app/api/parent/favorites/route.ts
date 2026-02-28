import { getCurrentUser } from "@/lib/auth";
import { getQuestions, getKnowledgePoints } from "@/lib/content";
import { getFavoritesByUser } from "@/lib/favorites";
import { badRequest, unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  role: "parent",
  cache: "private-realtime",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "parent") {
      unauthorized();
    }
    if (!user.studentId) {
      badRequest("missing student");
    }

    const favorites = await getFavoritesByUser(user.studentId);
    const questions = await getQuestions();
    const knowledgePoints = await getKnowledgePoints();
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp]));

    const data = favorites.map((fav) => {
      const question = questionMap.get(fav.questionId);
      const kp = question ? kpMap.get(question.knowledgePointId) : null;
      return {
        ...fav,
        question: question
          ? {
              id: question.id,
              stem: question.stem,
              subject: question.subject,
              grade: question.grade,
              knowledgePointId: question.knowledgePointId,
              knowledgePointTitle: kp?.title ?? "知识点"
            }
          : null
      };
    });

    return { data };
  }
});
