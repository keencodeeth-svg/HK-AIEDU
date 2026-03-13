import { unauthorized } from "@/lib/api/http";
import { createAdminRoute } from "@/lib/api/domains";
import { requireRole } from "@/lib/guard";
import { getObservabilityAlertsSummary } from "@/lib/observability-alerts";

export const dynamic = "force-dynamic";

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async () => {
    const admin = await requireRole("admin");
    if (!admin) {
      unauthorized();
    }

    return {
      data: await getObservabilityAlertsSummary()
    };
  }
});

