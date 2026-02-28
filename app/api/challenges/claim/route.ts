import { getCurrentUser } from "@/lib/auth";
import { claimChallenge, getChallengePoints, getChallengeState } from "@/lib/challenges";
import { badRequest, unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const claimChallengeBodySchema = v.object<{ taskId?: string }>(
  {
    taskId: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "student",
  body: claimChallengeBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const taskId = body.taskId?.trim();
    if (!taskId) {
      badRequest("missing taskId");
    }

    const result = await claimChallenge(user.id, taskId);
    const state = await getChallengeState(user.id);
    const points = await getChallengePoints(user.id);
    return { data: { tasks: state.tasks, points, result, experiment: state.experiment } };
  }
});
