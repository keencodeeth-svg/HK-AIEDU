import { getAdaptiveQuestions, getPracticeQuestions, getWrongQuestionIds } from "@/lib/progress";
import { getUnifiedReviewQuestionCandidates } from "@/lib/review-scheduler";
import { getQuestions } from "@/lib/content";
import { getMasteryRecordsByUser, getWeaknessRankMap } from "@/lib/mastery";
import { getStudentProfile } from "@/lib/profiles";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

function normalizeSubjectInput(value?: string) {
  return value?.trim().toLowerCase();
}

const nextQuestionBodySchema = v.object<{
  subject?: string;
  grade?: string;
  knowledgePointId?: string;
  mode?: "normal" | "challenge" | "timed" | "wrong" | "adaptive" | "review";
}>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    knowledgePointId: v.optional(v.string({ minLength: 1 })),
    mode: v.optional(v.enum(["normal", "challenge", "timed", "wrong", "adaptive", "review"] as const))
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

    const body = await parseJson(request, nextQuestionBodySchema);
    const subject = normalizeSubjectInput(body.subject) ?? "math";
    const profile = await getStudentProfile(user.id);
    const grade = body.grade ?? profile?.grade ?? (user.grade ?? "4");
    let questions = await getPracticeQuestions(subject, grade, body.knowledgePointId);
    let reviewSourceType: "wrong" | "memory" | null = null;
    let reviewDueAt: string | null = null;
    if (body.mode === "wrong") {
      const wrongIds = await getWrongQuestionIds(user.id);
      const all = await getQuestions();
      questions = all.filter(
        (q) =>
          wrongIds.includes(q.id) &&
          (!body.subject || q.subject === subject) &&
          (!body.grade || q.grade === grade) &&
          (!body.knowledgePointId || q.knowledgePointId === body.knowledgePointId)
      );
    }
    if (body.mode === "adaptive") {
      questions = await getAdaptiveQuestions({
        userId: user.id,
        subject,
        grade,
        knowledgePointId: body.knowledgePointId
      });
    }
    if (body.mode === "review") {
      const reviewCandidates = await getUnifiedReviewQuestionCandidates({
        userId: user.id,
        subject,
        grade,
        knowledgePointId: body.knowledgePointId,
        limit: 10
      });
      questions = reviewCandidates.map((item) => item.question);
      reviewSourceType = reviewCandidates[0]?.task.sourceType ?? null;
      reviewDueAt = reviewCandidates[0]?.task.nextReviewAt ?? null;
    }
    let question = body.mode === "review" ? questions[0] : questions[Math.floor(Math.random() * questions.length)];
    let weaknessRank: number | null = null;
    let recommendationReason = "随机练习巩固";

    if (!body.knowledgePointId && questions.length > 0) {
      const masteryRecords = await getMasteryRecordsByUser(user.id, subject);
      const rankMap = getWeaknessRankMap(masteryRecords, subject);

      if (body.mode === "adaptive") {
        const ranked = questions
          .slice()
          .sort((a, b) => {
            const rankA = rankMap.get(a.knowledgePointId) ?? Number.MAX_SAFE_INTEGER;
            const rankB = rankMap.get(b.knowledgePointId) ?? Number.MAX_SAFE_INTEGER;
            if (rankA !== rankB) return rankA - rankB;
            return a.id.localeCompare(b.id);
          })
          .slice(0, 3);
        question = ranked[Math.floor(Math.random() * ranked.length)] ?? question;
        recommendationReason = "薄弱知识点优先推荐";
      }

      weaknessRank = rankMap.get(question.knowledgePointId) ?? null;
      if (body.mode === "review") {
        recommendationReason = reviewSourceType === "wrong" ? "统一复练队列：错题优先" : "统一复练队列：记忆复习";
      } else if (weaknessRank !== null && body.mode !== "adaptive") {
        recommendationReason = `知识点薄弱度第 ${weaknessRank} 位`;
      }
    }

    if (!question) {
      notFound("no questions");
    }

    return {
      question: {
        id: question.id,
        stem: question.stem,
        options: question.options,
        knowledgePointId: question.knowledgePointId,
        recommendation: {
          reason: recommendationReason,
          weaknessRank
        }
      },
      reviewSourceType,
      reviewDueAt
    };
  }
});
