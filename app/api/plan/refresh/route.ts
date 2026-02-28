import { refreshStudyPlan } from "@/lib/progress";
import {
  getMasteryRecordsByUser,
  getWeaknessRankMap,
  indexMasteryByKnowledgePoint
} from "@/lib/mastery";
import { enrichPlanWithMastery } from "@/lib/plan-enrichment";
import { getStudentProfile } from "@/lib/profiles";
import { unauthorized } from "@/lib/api/http";
import { v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const refreshPlanBodySchema = v.object<{ subject?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "student",
  cache: "private-realtime",
  handler: async ({ request, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const rawBody = (await request.json().catch(() => ({}))) as unknown;
    const body = refreshPlanBodySchema(rawBody, "body");
    const profile = await getStudentProfile(user.id);
    const subjects = profile?.subjects?.length ? profile.subjects : ["math"];

    if (!body.subject || body.subject === "all") {
      const plans = await Promise.all(subjects.map((subject) => refreshStudyPlan(user.id, subject)));
      const masteryRecords = await getMasteryRecordsByUser(user.id);
      const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
      const enrichedPlans = plans.map((plan) =>
        enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, plan.subject))
      );
      const items = enrichedPlans.flatMap((plan) => plan.items.map((item) => ({ ...item, subject: plan.subject })));
      return { data: { items, plans: enrichedPlans } };
    }

    const plan = await refreshStudyPlan(user.id, body.subject);
    const masteryRecords = await getMasteryRecordsByUser(user.id, body.subject);
    const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
    return {
      data: enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, body.subject))
    };
  }
});
