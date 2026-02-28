import { getCurrentUser } from "@/lib/auth";
import { ensureObserverCode, rotateObserverCode } from "@/lib/profiles";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const code = await ensureObserverCode(user.id);
    return { data: { code } };
  }
});

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }
    const code = await rotateObserverCode(user.id);
    return { data: { code } };
  }
});
