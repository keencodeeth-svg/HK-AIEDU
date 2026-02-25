import { getCurrentUser } from "@/lib/auth";
import { generateStudyPlan, generateStudyPlans, getStudyPlan, getStudyPlans } from "@/lib/progress";
import { getMasteryRecordsByUser, indexMasteryByKnowledgePoint } from "@/lib/mastery";
import { getStudentProfile } from "@/lib/profiles";
import { unauthorized, withApi } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";
export const dynamic = "force-dynamic";

const planQuerySchema = v.object<{ subject?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

function enrichPlanWithMastery(
  plan: { subject: string; items: { knowledgePointId: string; targetCount: number; dueDate: string }[] },
  masteryMap: Map<
    string,
    { masteryScore: number; masteryLevel: string; correct: number; total: number }
  >
) {
  return {
    ...plan,
    items: plan.items.map((item) => {
      const mastery = masteryMap.get(item.knowledgePointId);
      return {
        ...item,
        masteryScore: mastery?.masteryScore ?? 0,
        masteryLevel: mastery?.masteryLevel ?? "weak",
        masteryCorrect: mastery?.correct ?? 0,
        masteryTotal: mastery?.total ?? 0
      };
    })
  };
}

export const GET = withApi(async (request) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    unauthorized();
  }

  const query = parseSearchParams(request, planQuerySchema);
  const subject = query.subject;
  const profile = await getStudentProfile(user.id);
  const subjects = profile?.subjects?.length ? profile.subjects : ["math"];

  if (!subject || subject === "all") {
    const existing = await getStudyPlans(user.id, subjects);
    const plans = existing.length ? existing : await generateStudyPlans(user.id, subjects);
    const masteryRecords = await getMasteryRecordsByUser(user.id);
    const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
    const enrichedPlans = plans.map((plan) => enrichPlanWithMastery(plan, masteryMap));
    const items = enrichedPlans.flatMap((plan) =>
      plan.items.map((item) => ({ ...item, subject: plan.subject }))
    );
    return { data: { items, plans: enrichedPlans } };
  }

  const existing = await getStudyPlan(user.id, subject);
  const plan = existing ?? await generateStudyPlan(user.id, subject);
  const masteryRecords = await getMasteryRecordsByUser(user.id, subject);
  const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
  return { data: enrichPlanWithMastery(plan, masteryMap) };
});
