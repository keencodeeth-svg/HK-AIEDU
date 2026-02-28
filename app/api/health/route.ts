import { createAdminRoute } from "@/lib/api/domains";

export const GET = createAdminRoute({
  cache: "public-short",
  handler: async () => {
    return {
      ok: true,
      service: "k12-ai-tutor",
      ts: new Date().toISOString()
    };
  }
});
