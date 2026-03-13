import { addHistoryItem, AI_HISTORY_ORIGINS, getHistoryByUser, type AiHistoryMeta } from "@/lib/ai-history";
import type { AiQualityMeta } from "@/lib/ai-types";
import { badRequest, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const ANSWER_MODE_OPTIONS = ["answer_only", "step_by_step", "hints_first"] as const;
const LEARNING_MODE_OPTIONS = ["direct", "study"] as const;
const QUALITY_RISK_OPTIONS = ["low", "medium", "high"] as const;

const qualitySchema = v.object<AiQualityMeta>(
  {
    confidenceScore: v.number({ min: 0, max: 100, integer: true }),
    riskLevel: v.enum(QUALITY_RISK_OPTIONS),
    needsHumanReview: v.boolean(),
    fallbackAction: v.string({ maxLength: 200 }),
    reasons: v.array(v.string({ minLength: 1, maxLength: 120 }), { maxLength: 8 }),
    minQualityScore: v.optional(v.number({ min: 0, max: 100, integer: true })),
    policyViolated: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

const historyMetaSchema = v.object<AiHistoryMeta>(
  {
    origin: v.optional(v.enum(AI_HISTORY_ORIGINS)),
    learningMode: v.optional(v.enum(LEARNING_MODE_OPTIONS)),
    subject: v.optional(v.string({ maxLength: 40 })),
    grade: v.optional(v.string({ maxLength: 20 })),
    answerMode: v.optional(v.enum(ANSWER_MODE_OPTIONS)),
    provider: v.optional(v.string({ maxLength: 60 })),
    recognizedQuestion: v.optional(v.string({ maxLength: 600 })),
    imageCount: v.optional(v.number({ min: 1, max: 3, integer: true })),
    quality: v.optional(qualitySchema)
  },
  { allowUnknown: false }
);

const createHistoryBodySchema = v.object<{ question?: string; answer?: string; meta?: AiHistoryMeta }>(
  {
    question: v.optional(v.string({ allowEmpty: true, trim: false })),
    answer: v.optional(v.string({ allowEmpty: true, trim: false })),
    meta: v.optional(historyMetaSchema)
  },
  { allowUnknown: false }
);

export const GET = createAiRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user) {
      unauthorized();
    }
    const list = await getHistoryByUser(user.id);
    return { data: list };
  }
});

export const POST = createAiRoute({
  role: ["student", "teacher", "parent", "admin", "school_admin"],
  body: createHistoryBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user) {
      unauthorized();
    }

    const question = body.question?.trim();
    const answer = body.answer?.trim();
    if (!question || !answer) {
      badRequest("missing fields");
    }

    const next = await addHistoryItem({
      userId: user.id,
      question,
      answer,
      favorite: false,
      tags: [],
      meta: body.meta
    });

    return { data: next };
  }
});
