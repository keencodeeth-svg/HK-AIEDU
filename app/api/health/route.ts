import { createAdminRoute } from "@/lib/api/domains";
import { getLivenessPayload } from "@/lib/health";

export const GET = createAdminRoute({
  cache: "public-short",
  runtimeGuardrails: "off",
  handler: async () => getLivenessPayload()
});
