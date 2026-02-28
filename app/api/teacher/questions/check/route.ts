import { getCurrentUser } from "@/lib/auth";
import { getQuestions } from "@/lib/content";
import { generateQuestionCheck } from "@/lib/ai";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const questionCheckBodySchema = v.object<{
  questionId?: string;
  stem?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  subject?: string;
  grade?: string;
}>(
  {
    questionId: v.optional(v.string({ minLength: 1 })),
    stem: v.optional(v.string({ allowEmpty: true, trim: false })),
    options: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    answer: v.optional(v.string({ allowEmpty: true, trim: false })),
    explanation: v.optional(v.string({ allowEmpty: true, trim: false })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

function basicCheck(payload: {
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
}) {
  const issues: string[] = [];
  const trimmedOptions = payload.options.map((opt) => opt.trim()).filter(Boolean);
  const uniqueOptions = new Set(trimmedOptions);
  if (trimmedOptions.length < 4) {
    issues.push("选项数量不足 4 个。");
  }
  if (uniqueOptions.size !== trimmedOptions.length) {
    issues.push("存在重复选项，可能导致歧义。");
  }
  if (!trimmedOptions.includes(payload.answer.trim())) {
    issues.push("答案不在选项中，需检查答案是否正确。");
  }
  if (!payload.explanation || payload.explanation.trim().length < 5) {
    issues.push("解析过短，建议补充解题步骤。");
  }
  const risk = issues.length >= 3 ? "high" : issues.length >= 1 ? "medium" : "low";
  return { issues, risk };
}

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "teacher") {
      unauthorized();
    }

    const body = await parseJson(request, questionCheckBodySchema);

    let stem = body.stem ?? "";
    let options = Array.isArray(body.options) ? body.options : [];
    let answer = body.answer ?? "";
    let explanation = body.explanation ?? "";
    let subject = body.subject;
    let grade = body.grade;

    if (body.questionId) {
      const question = (await getQuestions()).find((q) => q.id === body.questionId);
      if (!question) {
        notFound("not found");
      }
      stem = question.stem;
      options = question.options;
      answer = question.answer;
      explanation = question.explanation;
      subject = question.subject;
      grade = question.grade;
    }

    if (!stem || !options.length || !answer) {
      badRequest("missing fields");
    }

    const base = basicCheck({ stem, options, answer, explanation });
    const ai = await generateQuestionCheck({
      stem,
      options,
      answer,
      explanation,
      subject,
      grade
    });

    const issues = [...base.issues, ...(ai?.issues ?? [])];
    const risk = ai?.risk ?? base.risk;

    return {
      data: {
        issues,
        risk,
        suggestedAnswer: ai?.suggestedAnswer,
        notes: ai?.notes
      }
    };
  }
});
