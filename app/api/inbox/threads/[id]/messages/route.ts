import { getCurrentUser } from "@/lib/auth";
import { addMessage, getThreadMessages } from "@/lib/inbox";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const threadParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const addMessageBodySchema = v.object<{ content?: string }>(
  {
    content: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, threadParamsSchema);
    const body = await parseJson(request, addMessageBodySchema);
    const content = body.content?.trim();
    if (!content) {
      badRequest("missing content");
    }

    const threadInfo = await getThreadMessages(parsed.id);
    const isParticipant = threadInfo.participants.some((p) => p.id === user.id);
    if (!isParticipant) {
      notFound("not found");
    }

    const message = await addMessage({ threadId: parsed.id, senderId: user.id, content });
    return { data: message };
  }
});
