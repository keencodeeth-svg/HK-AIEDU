import crypto from "crypto";
import { getQuestions } from "@/lib/content";
import { addAttempt } from "@/lib/progress";
import { getMasteryRecord, getWeaknessRankMap, syncMasteryForKnowledgePoints } from "@/lib/mastery";
import { enqueueWrongReview, getIntervalLabel, submitWrongReviewResult } from "@/lib/wrong-review";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const reviewResultBodySchema = v.object<{ questionId: string; answer: string }>(
  {
    questionId: v.string({ minLength: 1 }),
    answer: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, reviewResultBodySchema);
    const question = (await getQuestions()).find((item) => item.id === body.questionId);
    if (!question) {
      notFound("not found");
    }

    const previousMastery = await getMasteryRecord(user.id, question.knowledgePointId, question.subject);
    const previousScore = previousMastery?.masteryScore ?? 0;
    const correct = body.answer === question.answer;

    await addAttempt({
      id: crypto.randomBytes(10).toString("hex"),
      userId: user.id,
      questionId: question.id,
      subject: question.subject,
      knowledgePointId: question.knowledgePointId,
      correct,
      answer: body.answer,
      reason: "wrong-book-review",
      createdAt: new Date().toISOString()
    });

    let review = await submitWrongReviewResult({
      userId: user.id,
      questionId: question.id,
      correct
    });
    if (!review) {
      await enqueueWrongReview({
        userId: user.id,
        questionId: question.id,
        subject: question.subject,
        knowledgePointId: question.knowledgePointId
      });
      review = await submitWrongReviewResult({
        userId: user.id,
        questionId: question.id,
        correct
      });
    }

    const masteryRecords = await syncMasteryForKnowledgePoints(user.id, [question.knowledgePointId], question.subject);
    const mastery = masteryRecords.find((item) => item.knowledgePointId === question.knowledgePointId);
    const weaknessRankMap = getWeaknessRankMap(masteryRecords, question.subject);
    const weaknessRank = weaknessRankMap.get(question.knowledgePointId) ?? null;
    const masteryScore = mastery?.masteryScore ?? previousScore;
    const masteryDelta = masteryScore - previousScore;

    return {
      correct,
      answer: question.answer,
      explanation: question.explanation,
      knowledgePointId: question.knowledgePointId,
      masteryScore,
      masteryDelta,
      weaknessRank,
      nextReviewAt: review?.nextReviewAt ?? null,
      intervalLevel: review?.intervalLevel ?? null,
      lastReviewResult: review?.lastReviewResult ?? null,
      review: review
        ? {
            status: review.status,
            intervalLevel: review.intervalLevel,
            intervalLabel: getIntervalLabel(review.intervalLevel),
            reviewCount: review.reviewCount,
            nextReviewAt: review.nextReviewAt,
            lastReviewResult: review.lastReviewResult,
            lastReviewAt: review.lastReviewAt
          }
        : null
    };
  }
});
