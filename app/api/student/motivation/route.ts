import { getCurrentUser } from "@/lib/auth";
import { getBadges, getStreak, getWeeklyStats } from "@/lib/progress";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const streak = await getStreak(user.id);
    const badges = await getBadges(user.id);
    const weekly = await getWeeklyStats(user.id);

    return {
      streak,
      badges,
      weekly
    };
  }
});
