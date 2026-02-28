import { getCurrentUser } from "@/lib/auth";
import { createAuthRoute } from "@/lib/api/domains";

export const GET = createAuthRoute({
  cache: "private-realtime",
  handler: async () => {
    const user = await getCurrentUser();
    return { user };
  }
});
