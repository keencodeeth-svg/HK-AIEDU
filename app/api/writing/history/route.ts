import { getCurrentUser } from "@/lib/auth";
import { getWritingSubmissionsByUser } from "@/lib/writing";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const list = await getWritingSubmissionsByUser(user.id);
    return { data: list };
  }
});
