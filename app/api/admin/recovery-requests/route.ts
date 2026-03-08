import { createAdminRoute } from "@/lib/api/domains";
import { listAccountRecoveryRequests, type AccountRecoveryRequestStatus } from "@/lib/account-recovery";
import { v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const listQuerySchema = v.object<{
  limit?: number;
  status?: AccountRecoveryRequestStatus;
  query?: string;
}>(
  {
    limit: v.optional(v.number({ integer: true, min: 1, max: 100, coerce: true })),
    status: v.optional(v.enum(["pending", "in_progress", "resolved", "rejected"] as const)),
    query: v.optional(v.string({ allowEmpty: true }))
  },
  { allowUnknown: false }
);

export const GET = createAdminRoute({
  role: "admin",
  cache: "private-short",
  query: listQuerySchema,
  handler: async ({ query }) => {
    const status = query.status ?? null;
    const result = await listAccountRecoveryRequests({
      limit: query.limit ?? 50,
      status,
      query: query.query ?? ""
    });

    return {
      data: {
        items: result.items,
        summary: result.summary,
        filters: {
          status: status ?? "all",
          query: query.query?.trim() ?? ""
        }
      }
    };
  }
});
