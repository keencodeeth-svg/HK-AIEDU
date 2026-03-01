import { getCurrentUser } from "@/lib/auth";
import { listLearningLibraryItems, type LearningLibraryItem } from "@/lib/learning-library";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import { indexLibraryChunks } from "@/lib/library-rag";
import { badRequest, forbidden, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const bodySchema = v.object<{
  itemIds?: string[];
  subject?: string;
  grade?: string;
  replace?: boolean;
}>(
  {
    itemIds: v.optional(v.array(v.string({ minLength: 1 }), { maxLength: 500 })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    replace: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }
    if (user.role !== "admin" && user.role !== "teacher") {
      forbidden();
    }

    const body = await parseJson(request, bodySchema);
    const items = await listLearningLibraryItems({
      subject: body.subject?.trim() || undefined,
      grade: body.grade?.trim() || undefined
    });
    const requestedItemIds = new Set((body.itemIds ?? []).map((item) => item.trim()).filter(Boolean));
    // Re-check ACL per item to prevent indexing teacher/private assets that caller cannot retrieve later.
    const scoped = (
      await Promise.all(
        items.map(async (item) => {
          if (requestedItemIds.size && !requestedItemIds.has(item.id)) return null;
          const allowed = await canAccessLearningLibraryItem(user, item);
          if (!allowed) return null;
          if (item.status !== "published" && user.role !== "admin" && item.ownerId !== user.id) {
            return null;
          }
          return item;
        })
      )
    ).filter((item): item is LearningLibraryItem => Boolean(item));

    if (!scoped.length) {
      badRequest("no accessible library items to index");
    }

    const result = await indexLibraryChunks({
      itemIds: scoped.map((item) => item.id),
      // Default replace=true keeps vector index aligned with latest content edits.
      replace: body.replace !== false
    });

    return {
      data: {
        ...result,
        accessibleItems: scoped.length
      }
    };
  }
});
