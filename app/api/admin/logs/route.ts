import { requireRole } from "@/lib/guard";
import { listAdminLogs } from "@/lib/admin-log";
import { unauthorized } from "@/lib/api/http";
import { adminLogsQuerySchema } from "@/lib/api/schemas/admin";
import { parseSearchParams } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, adminLogsQuerySchema);
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 200);
    const logs = await listAdminLogs({
      limit,
      action: query.action,
      entityType: query.entityType,
      query: query.query
    });
    return { data: logs };
  }
});
