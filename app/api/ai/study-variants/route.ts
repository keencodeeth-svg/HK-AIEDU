import { generateVariantDrafts } from "@/lib/ai";
import { getKnowledgePoints } from "@/lib/content";
import { getPracticeQuestions } from "@/lib/progress";
import { retrieveKnowledgePoints, retrieveSimilarQuestion } from "@/lib/rag";
import { buildFallbackStudyVariants, buildStudyTransferGoal } from "@/lib/ai-study-variants";
import { badRequest, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const studyVariantsBodySchema = v.object<{
  question: string;
  answer: string;
  subject?: string;
  grade?: string;
  count?: number;
}>(
  {
    question: v.string({ minLength: 1 }),
    answer: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    count: v.optional(v.number({ min: 1, max: 3, integer: true }))
  },
  { allowUnknown: false }
);

export const POST = createAiRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  body: studyVariantsBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user) {
      unauthorized();
    }

    const question = body.question.trim();
    const answer = body.answer.trim();
    if (!question || !answer) {
      badRequest("missing fields");
    }

    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    const count = Math.min(Math.max(body.count ?? 2, 1), 3);
    const matchedKnowledgePoints = await retrieveKnowledgePoints(question, subject, grade);
    let primaryKnowledgePoint: (typeof matchedKnowledgePoints)[number] | null = matchedKnowledgePoints[0] ?? null;

    if (!primaryKnowledgePoint && subject && grade) {
      const similarQuestion = await retrieveSimilarQuestion(question, subject, grade);
      if (similarQuestion?.knowledgePointId) {
        const knowledgePoints = await getKnowledgePoints();
        primaryKnowledgePoint = knowledgePoints.find((item) => item.id === similarQuestion.knowledgePointId) ?? null;
      }
    }

    let variants = [] as Array<{ stem: string; options: string[]; answer: string; explanation: string }>;
    let sourceMode: "ai" | "pool" | "fallback" = "fallback";

    if (subject && grade && primaryKnowledgePoint?.title) {
      const drafts = await generateVariantDrafts({
        subject,
        grade,
        knowledgePointTitle: primaryKnowledgePoint.title,
        chapter: primaryKnowledgePoint.chapter,
        seedQuestion: question,
        count
      });
      if (drafts?.length) {
        variants = drafts.map((item) => ({
          stem: item.stem,
          options: item.options,
          answer: item.answer,
          explanation: item.explanation
        }));
        sourceMode = "ai";
      }
    }

    if (!variants.length && subject && grade && primaryKnowledgePoint?.id) {
      const pool = await getPracticeQuestions(subject, grade, primaryKnowledgePoint.id);
      const fallbackPool = pool
        .filter((item) => item.stem.trim() !== question)
        .slice(0, count)
        .map((item) => ({
          stem: item.stem,
          options: item.options,
          answer: item.answer,
          explanation: item.explanation
        }));
      if (fallbackPool.length) {
        variants = fallbackPool;
        sourceMode = "pool";
      }
    }

    if (!variants.length) {
      variants = buildFallbackStudyVariants({
        question,
        answer,
        subject,
        knowledgePointTitle: primaryKnowledgePoint?.title ?? undefined,
        count
      });
      sourceMode = "fallback";
    }

    return {
      data: {
        transferGoal: buildStudyTransferGoal({
          question,
          answer,
          subject,
          knowledgePointTitle: primaryKnowledgePoint?.title ?? undefined
        }),
        knowledgePointId: primaryKnowledgePoint?.id ?? undefined,
        knowledgePointTitle: primaryKnowledgePoint?.title ?? undefined,
        sourceMode,
        variants: variants.slice(0, count)
      }
    };
  }
});
