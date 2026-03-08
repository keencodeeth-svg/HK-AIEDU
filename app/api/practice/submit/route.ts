import crypto from "crypto";
import { getQuestions } from "@/lib/content";
import { addAttempt } from "@/lib/progress";
import { getMasteryRecord, getWeaknessRankMap, updateMasteryByAttempt } from "@/lib/mastery";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const submitBodySchema = v.object<{
  questionId: string;
  answer: string;
}>(
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

    const body = await parseJson(request, submitBodySchema);

    const question = (await getQuestions()).find((q) => q.id === body.questionId);
    if (!question) {
      notFound("not found");
    }

    const previousMastery = await getMasteryRecord(user.id, question.knowledgePointId, question.subject);
    const previousScore = previousMastery?.masteryScore ?? 0;
    const correct = body.answer === question.answer;
    await addAttempt(
      {
        id: crypto.randomBytes(10).toString("hex"),
        userId: user.id,
        questionId: question.id,
        subject: question.subject,
        knowledgePointId: question.knowledgePointId,
        correct,
        answer: body.answer,
        createdAt: new Date().toISOString()
      },
      { reviewOrigin: { sourceType: "practice" } }
    );

    const masteryUpdate = await updateMasteryByAttempt({
      userId: user.id,
      knowledgePointId: question.knowledgePointId,
      subject: question.subject
    });
    const masteryRecords = masteryUpdate.records;
    const mastery = masteryUpdate.record;
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
      masteryUpdateMode: masteryUpdate.mode,
      mastery: {
        knowledgePointId: question.knowledgePointId,
        subject: question.subject,
        masteryScore,
        masteryDelta,
        weaknessRank,
        masteryLevel: mastery?.masteryLevel ?? "weak",
        confidenceScore: mastery?.confidenceScore ?? 0,
        recencyWeight: mastery?.recencyWeight ?? 0,
        masteryTrend7d: mastery?.masteryTrend7d ?? 0,
        correct: mastery?.correct ?? 0,
        total: mastery?.total ?? 0,
        lastAttemptAt: mastery?.lastAttemptAt ?? null
      }
    };
  }
});
