import { getCurrentUser } from "@/lib/auth";
import { getLearningLibraryItemById } from "@/lib/learning-library";
import { canAccessLearningLibraryItem } from "@/lib/library-access";
import { retrieveLibraryCitations, type LibraryCitation } from "@/lib/library-rag";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const querySchema = v.object<{
  q?: string;
  subject?: string;
  grade?: string;
  limit?: number;
}>(
  {
    q: v.optional(v.string({ minLength: 1 })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    limit: v.optional(v.number({ coerce: true, integer: true, min: 1, max: 20 }))
  },
  { allowUnknown: true }
);

export const GET = withApi(async (request) => {
  const user = await getCurrentUser();
  if (!user) {
    unauthorized();
  }

  const query = parseSearchParams(request, querySchema);
  const q = query.q?.trim();
  if (!q) {
    badRequest("q is required");
  }

  const candidates = await retrieveLibraryCitations({
    query: q,
    subject: query.subject?.trim() || undefined,
    grade: query.grade?.trim() || undefined,
    limit: query.limit ?? 6
  });

  const accessible = (
    await Promise.all(
      candidates.map(async (item) => {
        const libraryItem = await getLearningLibraryItemById(item.itemId);
        if (!libraryItem) return null;
        const allowed = await canAccessLearningLibraryItem(user, libraryItem);
        if (!allowed) return null;
        if (libraryItem.status !== "published" && user.role !== "admin" && libraryItem.ownerId !== user.id) {
          return null;
        }
        return item;
      })
    )
  ).filter((item): item is LibraryCitation => Boolean(item));

  return {
    data: accessible
  };
});
