import { generateStudyPlan, generateStudyPlans, getStudyPlan, getStudyPlans } from "@/lib/progress";
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

const planQuerySchema = v.object<{ subject?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

function normalizeSubjectInput(value?: string) {
  return value?.trim().toLowerCase();
}

export const GET = createLearningRoute({
  role: "student",
  query: planQuerySchema,
  cache: "private-short",
  handler: async ({ query, user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const subject = normalizeSubjectInput(query.subject);
    const profile = await getStudentProfile(user.id);
    const subjects = (profile?.subjects?.length ? profile.subjects : ["math"])
      .map((item) => normalizeSubjectInput(item))
      .filter((item): item is string => Boolean(item));

    if (!subject || subject === "all") {
      const existing = await getStudyPlans(user.id, subjects);
      const plans = existing.length ? existing : await generateStudyPlans(user.id, subjects);
      const masteryRecords = await getMasteryRecordsByUser(user.id);
      const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
      const enrichedPlans = plans.map((plan) =>
        enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, plan.subject))
      );
      const items = enrichedPlans.flatMap((plan) =>
        plan.items.map((item) => ({ ...item, subject: plan.subject }))
      );
      return { data: { items, plans: enrichedPlans } };
    }

    const existing = await getStudyPlan(user.id, subject);
    const plan = existing ?? await generateStudyPlan(user.id, subject);
    const masteryRecords = await getMasteryRecordsByUser(user.id, subject);
    const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
    return { data: enrichPlanWithMastery(plan, masteryMap, getWeaknessRankMap(masteryRecords, subject)) };
  }
});
