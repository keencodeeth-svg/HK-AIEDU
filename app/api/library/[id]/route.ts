import { getCurrentUser } from "@/lib/auth";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import {
  deleteLearningLibraryItem,
  getLearningLibraryItemById
} from "@/lib/learning-library";
import { addAdminLog } from "@/lib/admin-log";
import { requireRole } from "@/lib/guard";
import { notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseParams, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

export const GET = withApi(async (_request, context) => {
  const user = await getCurrentUser();
  if (!user) {
    unauthorized();
  }

  const params = parseParams(context.params, paramsSchema);
  const item = await getLearningLibraryItemById(params.id);
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

  return { data: item };
});

export const DELETE = withApi(async (_request, context) => {
  const user = await requireRole("admin");
  if (!user) {
    unauthorized();
  }

  const params = parseParams(context.params, paramsSchema);
  const item = await getLearningLibraryItemById(params.id);
  if (!item) {
    notFound("not found");
  }

  const deleted = await deleteLearningLibraryItem(params.id);
  if (!deleted) {
    notFound("not found");
  }

  await addAdminLog({
    adminId: user.id,
    action: "delete_library_item",
    entityType: "library",
    entityId: params.id,
    detail: item.title
  });

  return {
    data: {
      id: params.id
    }
  };
});
