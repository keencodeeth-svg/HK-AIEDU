import { getAnalyticsFunnel } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";

const funnelQuerySchema = v.object<{
  from?: string;
  to?: string;
  subject?: string;
  grade?: string;
}>(
  {
    from: v.optional(v.string({ minLength: 1 })),
    to: v.optional(v.string({ minLength: 1 })),
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

function toIsoOrNull(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, funnelQuerySchema);
    const from = query.from?.trim();
    const to = query.to?.trim();

    const fromIso = toIsoOrNull(from);
    const toIso = toIsoOrNull(to);
    if (from && !fromIso) {
      badRequest("invalid from");
    }
    if (to && !toIso) {
      badRequest("invalid to");
    }
    if (fromIso && toIso && fromIso > toIso) {
      badRequest("from must be <= to");
    }

    const data = await getAnalyticsFunnel({
      from: fromIso ?? undefined,
      to: toIso ?? undefined,
      subject: query.subject?.trim() || undefined,
      grade: query.grade?.trim() || undefined
    });

    return { data };
  }
});
