import { withApi, unauthorized } from "@/lib/api/http";
import { requireRole } from "@/lib/guard";
import { getApiMetricsSummary } from "@/lib/observability";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const admin = await requireRole("admin");
  if (!admin) {
    unauthorized();
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;

  return {
    data: getApiMetricsSummary(limit)
  };
});
