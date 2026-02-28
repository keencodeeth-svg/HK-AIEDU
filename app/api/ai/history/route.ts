import { addHistoryItem, getHistoryByUser } from "@/lib/ai-history";
import { badRequest, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const createHistoryBodySchema = v.object<{ question?: string; answer?: string }>(
  {
    question: v.optional(v.string({ allowEmpty: true, trim: false })),
    answer: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const GET = createAiRoute({
  role: ["student", "teacher", "parent", "admin"],
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
  role: ["student", "teacher", "parent", "admin"],
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
      tags: []
    });

    return { data: next };
  }
});
