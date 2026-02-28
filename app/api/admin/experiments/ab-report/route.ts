import { requireRole } from "@/lib/guard";
import { unauthorized } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";
import { getChallengeABReport } from "@/lib/experiments";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const reportQuerySchema = v.object<{ days?: number }>(
  {
    days: v.optional(v.number({ integer: true, min: 3, max: 30, coerce: true }))
  },
  { allowUnknown: true }
);

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    const query = parseSearchParams(request, reportQuerySchema);
    const days = query.days ?? 7;
    const data = await getChallengeABReport(days);
    return { data };
  }
});
