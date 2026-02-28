import { getCurrentUser } from "@/lib/auth";
import { getChallengePoints, getChallengeState } from "@/lib/challenges";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const state = await getChallengeState(user.id);
    const points = await getChallengePoints(user.id);
    return { data: { tasks: state.tasks, points, experiment: state.experiment } };
  }
});
