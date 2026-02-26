import { getCurrentUser } from "@/lib/auth";
import { generateAssistAnswer } from "@/lib/ai";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const coachBodySchema = v.object<{
  question: string;
  subject?: string;
  grade?: string;
  studentAnswer?: string;
}>(
  {
    question: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    studentAnswer: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const POST = withApi(async (request) => {
  const user = await getCurrentUser();
  if (!user) {
    unauthorized();
  }

  const body = await parseJson(request, coachBodySchema);
  if (!body.question?.trim()) {
    badRequest("missing question");
  }

  const assist = await generateAssistAnswer({
    question: body.question.trim(),
    subject: body.subject,
    grade: body.grade
  });

  const checkpoints = [
    "你能先说出题目里给了哪些已知条件吗？",
    "这道题对应哪个知识点或公式？",
    "下一步你准备怎么做？"
  ];

  const feedback = body.studentAnswer
    ? `我看到你的思路：${body.studentAnswer}。我们先对照已知条件和关键公式，再把步骤拆成 2-3 步。`
    : null;
  const quality = assessAiQuality({
    kind: "coach",
    provider: assist.provider,
    textBlocks: [assist.answer, ...(assist.steps ?? []), ...(assist.hints ?? []), feedback ?? ""],
    listCountHint: checkpoints.length + (assist.steps?.length ?? 0)
  });

  return {
    data: {
      answer: assist.answer,
      steps: assist.steps,
      hints: assist.hints,
      checkpoints,
      feedback,
      provider: assist.provider,
      quality
    }
  };
});
