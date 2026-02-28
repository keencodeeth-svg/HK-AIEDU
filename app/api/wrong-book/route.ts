import { getCurrentUser } from "@/lib/auth";
import { getQuestions } from "@/lib/content";
import { getLastAttemptByQuestion, getWrongQuestionIds } from "@/lib/progress";
import { getMasteryRecordsByUser } from "@/lib/mastery";
import { getIntervalLabel, getWrongReviewItemsByUser } from "@/lib/wrong-review";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const wrongIds = await getWrongQuestionIds(user.id);
    const questions = (await getQuestions()).filter((q) => wrongIds.includes(q.id));
    const reviews = await getWrongReviewItemsByUser(user.id, true);
    const reviewByQuestion = new Map(reviews.map((item) => [item.questionId, item]));
    const lastAttempts = await getLastAttemptByQuestion(user.id);
    const masteryRecords = await getMasteryRecordsByUser(user.id);
    const weaknessRankByKp = new Map(
      masteryRecords
        .slice()
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .map((item, index) => [item.knowledgePointId, index + 1])
    );

    return {
      data: questions.map((question) => {
        const review = reviewByQuestion.get(question.id);
        const lastAttempt = lastAttempts.get(question.id);
        return {
          ...question,
          weaknessRank: weaknessRankByKp.get(question.knowledgePointId) ?? null,
          lastAttemptAt: lastAttempt?.createdAt ?? null,
          nextReviewAt: review?.nextReviewAt ?? null,
          intervalLevel: review?.intervalLevel ?? null,
          intervalLabel: review ? getIntervalLabel(review.intervalLevel) : null,
          lastReviewResult: review?.lastReviewResult ?? null
        };
      })
    };
  }
});
