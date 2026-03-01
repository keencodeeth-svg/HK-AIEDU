import { getCurrentUser } from "@/lib/auth";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import {
  getLearningLibraryItemById,
  issueLearningLibraryShareToken
} from "@/lib/learning-library";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, paramsSchema);
    const item = await getLearningLibraryItemById(parsed.id);
    if (!item) {
      notFound("not found");
    }
    const allowed = await canAccessLearningLibraryItem(user, item);
    if (!allowed) {
      notFound("not found");
    }

    const shared = await issueLearningLibraryShareToken(item.id);
    if (!shared?.shareToken) {
      notFound("not found");
    }

    const origin = new URL(request.url).origin;
    // Share url points to tokenized public endpoint with read-only payload.
    return {
      data: {
        shareToken: shared.shareToken,
        shareUrl: `${origin}/library/shared/${shared.shareToken}`
      }
    };
  }
});
