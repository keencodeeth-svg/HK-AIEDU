import { getCurrentUser } from "@/lib/auth";
import { getQuestions, getKnowledgePoints } from "@/lib/content";
import { getFavoritesByUser, upsertFavorite } from "@/lib/favorites";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const favoritesQuerySchema = v.object<{ includeQuestion?: string }>(
  {
    includeQuestion: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

const createFavoriteBodySchema = v.object<{ questionId?: string; tags?: string[]; note?: string }>(
  {
    questionId: v.optional(v.string({ allowEmpty: true, trim: false })),
    tags: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    note: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const query = parseSearchParams(request, favoritesQuerySchema);
    const includeQuestion = query.includeQuestion === "1";

    const favorites = await getFavoritesByUser(user.id);
    if (!includeQuestion) {
      return { data: favorites };
    }

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

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, createFavoriteBodySchema);
    const questionId = body.questionId?.trim();
    if (!questionId) {
      badRequest("missing questionId");
    }

    const tags = Array.isArray(body.tags)
      ? body.tags.map((item) => String(item).trim()).filter(Boolean)
      : [];

    const record = await upsertFavorite({
      userId: user.id,
      questionId,
      tags,
      note: body.note
    });

    return { data: record };
  }
});
