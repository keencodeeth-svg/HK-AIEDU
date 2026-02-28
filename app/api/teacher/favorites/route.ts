import { getCurrentUser } from "@/lib/auth";
import { getQuestions, getKnowledgePoints } from "@/lib/content";
import { getFavoritesByUser } from "@/lib/favorites";
import { isStudentInTeacherClasses } from "@/lib/classes";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const favoritesQuerySchema = v.object<{ studentId: string }>(
  {
    studentId: v.string({ minLength: 1 })
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

    const query = parseSearchParams(request, favoritesQuerySchema);
    const studentId = query.studentId;

    const allowed = await isStudentInTeacherClasses(user.id, studentId);
    if (!allowed) {
      notFound("not found");
    }

    const favorites = await getFavoritesByUser(studentId);
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
