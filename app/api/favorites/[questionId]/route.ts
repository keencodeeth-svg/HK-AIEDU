import { getCurrentUser } from "@/lib/auth";
import { getFavoriteByUserQuestion, removeFavorite, upsertFavorite } from "@/lib/favorites";
import { unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const favoriteParamsSchema = v.object<{ questionId: string }>(
  {
    questionId: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const updateFavoriteBodySchema = v.object<{ tags?: string[]; note?: string }>(
  {
    tags: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    note: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const parsed = parseParams(params, favoriteParamsSchema);
    const favorite = await getFavoriteByUserQuestion(user.id, parsed.questionId);
    return { data: favorite };
  }
});

export const PATCH = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const parsed = parseParams(params, favoriteParamsSchema);
    const body = await parseJson(request, updateFavoriteBodySchema);
    const tags = Array.isArray(body.tags)
      ? body.tags.map((item) => String(item).trim()).filter(Boolean)
      : undefined;

    const record = await upsertFavorite({
      userId: user.id,
      questionId: parsed.questionId,
      tags,
      note: body.note
    });

    return { data: record };
  }
});

export const DELETE = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const parsed = parseParams(params, favoriteParamsSchema);
    const removed = await removeFavorite(user.id, parsed.questionId);
    return { removed };
  }
});
