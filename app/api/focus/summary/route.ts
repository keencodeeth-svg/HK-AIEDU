import { getCurrentUser } from "@/lib/auth";
import { getFocusSummary } from "@/lib/focus";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const data = await getFocusSummary(user.id);
    return { data };
  }
});
