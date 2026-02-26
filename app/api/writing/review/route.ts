import { getCurrentUser } from "@/lib/auth";
import { generateWritingFeedback } from "@/lib/ai";
import { addWritingSubmission } from "@/lib/writing";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const writingReviewBodySchema = v.object<{
  subject?: string;
  grade?: string;
  title?: string;
  content?: string;
}>(
  {
    subject: v.optional(v.string({ allowEmpty: true, trim: false })),
    grade: v.optional(v.string({ allowEmpty: true, trim: false })),
    title: v.optional(v.string({ allowEmpty: true, trim: false })),
    content: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

function fallbackFeedback(content: string) {
  const length = content.trim().length;
  const base = Math.min(85, Math.max(60, Math.round(length / 3)));
  return {
    scores: {
      structure: base,
      grammar: Math.max(55, base - 5),
      vocab: Math.max(55, base - 8)
    },
    summary: "已完成基础批改，请根据建议优化结构与表达。",
    strengths: ["表达较完整", "有一定连贯性"],
    improvements: ["增加过渡句", "注意语法与标点"],
    corrected: undefined
  };
}

export const POST = withApi(async (request) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    unauthorized();
  }

  const body = await parseJson(request, writingReviewBodySchema);
  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const title = body.title?.trim() || undefined;
  const content = body.content?.trim();

  if (!content || !subject || !grade) {
    badRequest("missing fields");
  }

  const generated = await generateWritingFeedback({
    subject,
    grade,
    title,
    content
  });
  const feedback = generated ?? fallbackFeedback(content);
  const provider = generated ? process.env.LLM_PROVIDER ?? "llm" : "rule";

  const quality = assessAiQuality({
    kind: "writing",
    provider,
    textBlocks: [
      feedback.summary,
      ...(feedback.strengths ?? []),
      ...(feedback.improvements ?? []),
      feedback.corrected ?? ""
    ],
    listCountHint: (feedback.strengths?.length ?? 0) + (feedback.improvements?.length ?? 0)
  });

  const feedbackWithQuality = {
    ...feedback,
    quality
  };

  const submission = await addWritingSubmission({
    userId: user.id,
    subject,
    grade,
    title,
    content,
    feedback: feedbackWithQuality
  });

  return {
    data: {
      ...submission,
      quality,
      manualReviewRule: quality.needsHumanReview ? "建议教师/家长抽检关键结论后再采用。" : ""
    }
  };
});
