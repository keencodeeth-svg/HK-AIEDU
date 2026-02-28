import { requireRole } from "@/lib/guard";
import { parseJson, v } from "@/lib/api/validation";
import { unauthorized } from "@/lib/api/http";
import { probeLlmProviders } from "@/lib/ai";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const testBodySchema = v.object<{
  providers?: string[];
  capability?: "chat" | "vision";
}>(
  {
    providers: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    capability: v.optional(v.enum(["chat", "vision"] as const))
  },
  { allowUnknown: false }
);

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const body = await parseJson(request, testBodySchema);
    const providers = (body.providers ?? []).map((item) => item.trim()).filter(Boolean);
    const capability = body.capability ?? "chat";
    const results = await probeLlmProviders({
      providers,
      capability
    });

    return {
      data: {
        capability,
        testedAt: new Date().toISOString(),
        results
      }
    };
  }
});
