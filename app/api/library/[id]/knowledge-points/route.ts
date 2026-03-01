import { getCurrentUser } from "@/lib/auth";
import { getKnowledgePoints } from "@/lib/content";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import {
  getLearningLibraryItemById,
  updateLearningLibraryKnowledgePoints
} from "@/lib/learning-library";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api/http";
import { parseJson, parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const bodySchema = v.object<{ knowledgePointIds?: string[] }>(
  {
    knowledgePointIds: v.optional(v.array(v.string({ minLength: 1 })))
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
    if (user.role !== "admin" && user.role !== "teacher") {
      forbidden();
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

    const body = await parseJson(request, bodySchema);
    const nextIds = Array.from(new Set((body.knowledgePointIds ?? []).map((id) => id.trim()).filter(Boolean)));
    if (!nextIds.length) {
      badRequest("knowledgePointIds required");
    }

    // Limit bindable knowledge points to the same subject/grade as the library item.
    const scopedKps = (await getKnowledgePoints()).filter(
      (kp) => kp.subject === item.subject && kp.grade === item.grade
    );
    const scopedMap = new Map(scopedKps.map((kp) => [kp.id, kp]));
    const filteredIds = nextIds.filter((id) => scopedMap.has(id));
    if (!filteredIds.length) {
      badRequest("knowledgePointIds not match subject/grade");
    }

    const updated = await updateLearningLibraryKnowledgePoints({
      id: item.id,
      knowledgePointIds: filteredIds,
      extractedKnowledgePoints: filteredIds.map((id) => scopedMap.get(id)?.title ?? "").filter(Boolean)
    });
    if (!updated) {
      notFound("not found");
    }

    return { data: updated };
  }
});
