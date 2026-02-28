import { getLearningLibraryItemByShareToken, hydrateLearningLibraryItemContent } from "@/lib/learning-library";
import { notFound } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const paramsSchema = v.object<{ token: string }>(
  {
    token: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  cache: "public-short",
  handler: async ({ params }) => {
    const parsed = parseParams(params, paramsSchema);
    const item = await getLearningLibraryItemByShareToken(parsed.token);
    if (!item) {
      notFound("not found");
    }
    const hydrated = await hydrateLearningLibraryItemContent(item);
    const { contentStorageProvider, contentStorageKey, ...publicItem } = hydrated ?? item;
    return { data: publicItem };
  }
});
