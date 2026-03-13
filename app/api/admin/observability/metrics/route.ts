import { unauthorized } from "@/lib/api/http";
import { requireRole } from "@/lib/guard";
import { getErrorTrackingStatus } from "@/lib/error-tracker";
import { getApiMetricsSummary } from "@/lib/observability";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const admin = await requireRole("admin");
    if (!admin) {
      unauthorized();
    }

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;

    const summary = await getApiMetricsSummary(limit);
    return {
      data: {
        ...summary,
        errorTracking: getErrorTrackingStatus()
      }
    };
  }
});
