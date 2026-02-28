import { getCurrentUser } from "@/lib/auth";
import { deleteHistoryItem, getHistoryByUser, updateHistoryItem } from "@/lib/ai-history";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createAiRoute } from "@/lib/api/domains";

const historyParamsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const updateHistoryBodySchema = v.object<{ favorite?: boolean; tags?: string[] }>(
  {
    favorite: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string({ minLength: 1 })))
  },
  { allowUnknown: false }
);

export const PATCH = createAiRoute({
  role: ["student", "teacher", "parent", "admin"],
  cache: "private-realtime",
  handler: async ({ request, params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, historyParamsSchema);
    const body = await parseJson(request, updateHistoryBodySchema);
    const ownsRecord = (await getHistoryByUser(user.id)).some((item) => item.id === parsed.id);
    if (!ownsRecord) {
      notFound("not found");
    }

    const next = await updateHistoryItem(parsed.id, body);
    if (!next) {
      notFound("not found");
    }

    return { data: next };
  }
});

export const DELETE = createAiRoute({
  role: ["student", "teacher", "parent", "admin"],
  cache: "private-realtime",
  handler: async ({ params }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, historyParamsSchema);
    const ownsRecord = (await getHistoryByUser(user.id)).some((item) => item.id === parsed.id);
    if (!ownsRecord) {
      notFound("not found");
    }

    const ok = await deleteHistoryItem(parsed.id);
    if (!ok) {
      notFound("not found");
    }

    return { ok: true };
  }
});
