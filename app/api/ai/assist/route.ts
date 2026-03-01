import { generateAssistAnswer } from "@/lib/ai";
import { assessAiQuality } from "@/lib/ai-quality-control";
import { badRequest } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

type AssistRequest = {
  question: string;
  subject?: string;
  grade?: string;
  knowledgePoint?: string;
};

const assistBodySchema = v.object<AssistRequest>(
  {
    question: v.string({ minLength: 1 }),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    knowledgePoint: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

export const POST = createAiRoute({
  body: assistBodySchema,
  cache: "private-realtime",
  handler: async ({ body }) => {
    if (!body.question?.trim()) {
      badRequest("question is required");
    }

    const response = await generateAssistAnswer({
      question: body.question.trim(),
      subject: body.subject,
      grade: body.grade
    });
    // Route-level quality snapshot feeds runtime observability and admin diagnostics.
    const quality = assessAiQuality({
      kind: "assist",
      taskType: "assist",
      provider: response.provider,
      textBlocks: [response.answer, ...(response.steps ?? []), ...(response.hints ?? [])],
      listCountHint: (response.steps?.length ?? 0) + (response.hints?.length ?? 0)
    });

    return {
      answer: response.answer,
      steps: response.steps,
      hints: response.hints,
      source: response.sources,
      provider: response.provider,
      quality
    };
  }
});
