import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getQuestions } from "@/lib/content";
import { addAttempt } from "@/lib/progress";
import { getMasteryRecord, syncMasteryFromAttempts } from "@/lib/mastery";
import { notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

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

export const POST = withApi(async (request) => {
  const user = await getCurrentUser();
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
  await addAttempt({
    id: crypto.randomBytes(10).toString("hex"),
    userId: user.id,
    questionId: question.id,
    subject: question.subject,
    knowledgePointId: question.knowledgePointId,
    correct,
    answer: body.answer,
    createdAt: new Date().toISOString()
  });

  const masteryRecords = await syncMasteryFromAttempts(user.id, question.subject);
  const mastery = masteryRecords.find((item) => item.knowledgePointId === question.knowledgePointId);
  const masteryScore = mastery?.masteryScore ?? previousScore;
  const masteryDelta = masteryScore - previousScore;

  return {
    correct,
    answer: question.answer,
    explanation: question.explanation,
    knowledgePointId: question.knowledgePointId,
    masteryScore,
    masteryDelta,
    mastery: {
      knowledgePointId: question.knowledgePointId,
      subject: question.subject,
      masteryScore,
      masteryDelta,
      masteryLevel: mastery?.masteryLevel ?? "weak",
      correct: mastery?.correct ?? 0,
      total: mastery?.total ?? 0,
      lastAttemptAt: mastery?.lastAttemptAt ?? null
    }
  };
});
