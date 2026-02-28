import { getKnowledgePoints, getQuestions } from "@/lib/content";
import { generateVariantDrafts, generateWrongExplanation } from "@/lib/ai";
import { getPracticeQuestions } from "@/lib/progress";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const variantsBodySchema = v.object<{
  questionId: string;
  studentAnswer?: string;
}>(
  {
    questionId: v.string({ minLength: 1 }),
    studentAnswer: v.optional(v.string({ allowEmpty: true, trim: false }))
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

    const body = await parseJson(request, variantsBodySchema);

    const question = (await getQuestions()).find((q) => q.id === body.questionId);
    if (!question) {
      notFound("not found");
    }

    const kp = (await getKnowledgePoints()).find((item) => item.id === question.knowledgePointId);
    const wrongExplanation = await generateWrongExplanation({
      subject: question.subject,
      grade: question.grade,
      question: question.stem,
      studentAnswer: body.studentAnswer ?? "",
      correctAnswer: question.answer,
      explanation: question.explanation,
      knowledgePointTitle: kp?.title
    });

    const drafts = await generateVariantDrafts({
      subject: question.subject,
      grade: question.grade,
      knowledgePointTitle: kp?.title ?? "",
      chapter: kp?.chapter,
      seedQuestion: question.stem,
      count: 3,
      difficulty: question.difficulty ?? "medium"
    });

    let variants = drafts ?? [];
    if (!variants.length) {
      const pool = await getPracticeQuestions(question.subject, question.grade, question.knowledgePointId);
      const fallback = pool.filter((q) => q.id !== question.id).slice(0, 3);
      variants = fallback.map((item) => ({
        stem: item.stem,
        options: item.options,
        answer: item.answer,
        explanation: item.explanation
      }));
    }

    if (!variants.length) {
      badRequest("暂未生成可用变式题，请先补充同知识点题库或稍后重试");
    }

    return {
      data: {
        explanation:
          wrongExplanation ?? {
            analysis: "建议先回顾题目对应的知识点，再关注关键条件与运算顺序。",
            hints: ["先找出题干已知条件", "对照正确答案检查步骤"]
          },
        variants
      }
    };
  }
});
