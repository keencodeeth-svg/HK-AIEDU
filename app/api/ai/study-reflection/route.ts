import { generateWrongExplanation } from "@/lib/ai";
import { buildStudyVariantReflection } from "@/lib/ai-study-reflection";
import { retrieveKnowledgePoints } from "@/lib/rag";
import { badRequest, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const studyReflectionVariantSchema = v.object<{
  stem: string;
  answer: string;
  explanation: string;
  studentAnswer?: string;
}>(
  {
    stem: v.string({ minLength: 1 }),
    answer: v.string({ minLength: 1 }),
    explanation: v.string({ minLength: 1 }),
    studentAnswer: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

const studyReflectionBodySchema = v.object<{
  question: string;
  subject?: string;
  grade?: string;
  knowledgePointTitle?: string;
  variants: Array<{
    stem: string;
    answer: string;
    explanation: string;
    studentAnswer?: string;
  }>;
}>(
  {
    question: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    knowledgePointTitle: v.optional(v.string({ minLength: 1 })),
    variants: v.array(studyReflectionVariantSchema, { minLength: 1, maxLength: 4 })
  },
  { allowUnknown: false }
);

export const POST = createAiRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  body: studyReflectionBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user) {
      unauthorized();
    }

    const question = body.question.trim();
    if (!question) {
      badRequest("missing question");
    }

    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    let knowledgePointTitle = body.knowledgePointTitle?.trim() || "";

    if (!knowledgePointTitle && subject) {
      try {
        const matchedKnowledgePoints = await retrieveKnowledgePoints(question, subject, grade);
        knowledgePointTitle = matchedKnowledgePoints[0]?.title?.trim() ?? "";
      } catch {
        knowledgePointTitle = "";
      }
    }

    const reflection = buildStudyVariantReflection({
      subject,
      knowledgePointTitle: knowledgePointTitle || undefined,
      variants: body.variants
    });

    const firstWrongVariant = body.variants.find((variant) => {
      const studentAnswer = variant.studentAnswer?.trim();
      return studentAnswer && studentAnswer !== variant.answer.trim();
    });

    if (firstWrongVariant && subject && grade) {
      const wrongExplanation = await generateWrongExplanation({
        subject,
        grade,
        question: firstWrongVariant.stem,
        studentAnswer: firstWrongVariant.studentAnswer?.trim() ?? "",
        correctAnswer: firstWrongVariant.answer,
        explanation: firstWrongVariant.explanation,
        knowledgePointTitle: knowledgePointTitle || undefined
      });

      if (wrongExplanation?.analysis) {
        reflection.detailSource = "ai";
        reflection.detail = {
          title: "重点错因",
          analysis: wrongExplanation.analysis,
          hints: wrongExplanation.hints?.length ? wrongExplanation.hints : reflection.detail.hints,
          variantStem: firstWrongVariant.stem
        };
      }
    }

    return {
      data: reflection
    };
  }
});
