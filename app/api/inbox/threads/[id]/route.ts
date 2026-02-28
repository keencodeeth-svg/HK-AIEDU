import { getCurrentUser } from "@/lib/auth";
import { getThreadMessages } from "@/lib/inbox";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const threadParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, threadParamsSchema);
    const data = await getThreadMessages(parsed.id, user.id);
    const isParticipant = data.participants.some((p) => p.id === user.id);
    if (!isParticipant) {
      notFound("not found");
    }

    return { data };
  }
});
