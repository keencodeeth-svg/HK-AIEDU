import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getKnowledgePoints, getQuestions } from "@/lib/content";
import { addAttempt, generateStudyPlan } from "@/lib/progress";
import { refreshMasteryAfterAttempts } from "@/lib/mastery";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const diagnosticSubmitBodySchema = v.object<{
  subject?: string;
  grade?: string;
  answers?: { questionId: string; answer: string; reason?: string }[];
}>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    answers: v.optional(
      v.array(
        v.object<{ questionId: string; answer: string; reason?: string }>(
          {
            questionId: v.string({ minLength: 1 }),
            answer: v.string({ minLength: 1 }),
            reason: v.optional(v.string({ allowEmpty: true, trim: false }))
          },
          { allowUnknown: false }
        )
      )
    )
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, diagnosticSubmitBodySchema);

    if (!body.subject || !body.grade || !body.answers?.length) {
      badRequest("missing fields");
    }

    const questions = await getQuestions();
    const kpList = await getKnowledgePoints();
    const kpMap = new Map(kpList.map((kp) => [kp.id, kp.title]));
    let correctCount = 0;
    const breakdown = new Map<string, { correct: number; total: number }>();
    const wrongReasons = new Map<string, number>();
    const attemptedKnowledgePointIds = new Set<string>();

    for (const item of body.answers) {
      const question = questions.find((q) => q.id === item.questionId);
      if (!question) continue;
      attemptedKnowledgePointIds.add(question.knowledgePointId);
      const correct = item.answer === question.answer;
      if (correct) correctCount += 1;
      const stat = breakdown.get(question.knowledgePointId) ?? { correct: 0, total: 0 };
      stat.total += 1;
      if (correct) stat.correct += 1;
      breakdown.set(question.knowledgePointId, stat);
      if (!correct && item.reason) {
        wrongReasons.set(item.reason, (wrongReasons.get(item.reason) ?? 0) + 1);
      }
      await addAttempt(
        {
          id: crypto.randomBytes(10).toString("hex"),
          userId: user.id,
          questionId: question.id,
          subject: question.subject,
          knowledgePointId: question.knowledgePointId,
          correct,
          answer: item.answer,
          reason: item.reason,
          createdAt: new Date().toISOString()
        },
        { reviewOrigin: { sourceType: "diagnostic" } }
      );
    }

    await refreshMasteryAfterAttempts(user.id, Array.from(attemptedKnowledgePointIds), body.subject);
    const plan = await generateStudyPlan(user.id, body.subject);

    return {
      total: body.answers.length,
      correct: correctCount,
      accuracy: Math.round((correctCount / body.answers.length) * 100),
      plan,
      breakdown: Array.from(breakdown.entries()).map(([knowledgePointId, stat]) => ({
        knowledgePointId,
        title: kpMap.get(knowledgePointId) ?? "知识点",
        total: stat.total,
        correct: stat.correct,
        accuracy: stat.total === 0 ? 0 : Math.round((stat.correct / stat.total) * 100)
      })),
      wrongReasons: Array.from(wrongReasons.entries()).map(([reason, count]) => ({ reason, count }))
    };
  }
});
