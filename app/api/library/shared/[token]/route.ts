import { getLearningLibraryItemByShareToken, hydrateLearningLibraryItemContent } from "@/lib/learning-library";
import { notFound, withApi } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const paramsSchema = v.object<{ token: string }>(
  {
    token: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = withApi(async (_request, context) => {
  const params = parseParams(context.params, paramsSchema);
  const item = await getLearningLibraryItemByShareToken(params.token);
  if (!item) {
    notFound("not found");
  }
  const hydrated = await hydrateLearningLibraryItemContent(item);
  const { contentStorageProvider, contentStorageKey, ...publicItem } = hydrated ?? item;
  return { data: publicItem };
});
