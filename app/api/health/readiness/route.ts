import { apiSuccess } from "@/lib/api/http";
import { createAdminRoute } from "@/lib/api/domains";
import { getReadinessPayload } from "@/lib/health";
import { assertReadinessProbeAccess } from "@/lib/readiness-probe";

export const dynamic = "force-dynamic";

export const GET = createAdminRoute({
  cache: "private-realtime",
  runtimeGuardrails: "off",
  handler: async ({ request, meta }) => {
    await assertReadinessProbeAccess(request);
    const payload = await getReadinessPayload();
    return apiSuccess(payload, {
      request,
      requestId: meta.requestId,
      traceId: meta.traceId,
      status: payload.ready ? 200 : 503
    });
  }
});
