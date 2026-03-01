import { getCurrentUser } from "@/lib/auth";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import {
  deleteLearningLibraryItem,
  getLearningLibraryItemById,
  hydrateLearningLibraryItemContent
} from "@/lib/learning-library";
import { addAdminLog } from "@/lib/admin-log";
import { requireRole } from "@/lib/guard";
import { notFound, unauthorized } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ params }) => {
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

    if (item.status !== "published" && user.role !== "admin" && item.ownerId !== user.id) {
      notFound("not found");
    }

    const hydrated = await hydrateLearningLibraryItemContent(item);
    // Strip storage internals from API payload; clients consume only resolved content fields.
    const { contentStorageProvider, contentStorageKey, ...publicItem } = hydrated ?? item;
    return { data: publicItem };
  }
});

export const DELETE = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ params }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const parsed = parseParams(params, paramsSchema);
    const item = await getLearningLibraryItemById(parsed.id);
    if (!item) {
      notFound("not found");
    }

    const deleted = await deleteLearningLibraryItem(parsed.id);
    if (!deleted) {
      notFound("not found");
    }

    try {
      await addAdminLog({
        adminId: user.id,
        action: "delete_library_item",
        entityType: "library",
        entityId: parsed.id,
        detail: item.title
      });
    } catch {
      // Logging failure should not block a completed delete operation.
    }

    return {
      data: {
        id: parsed.id
      }
    };
  }
});
