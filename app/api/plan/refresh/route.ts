import { getCurrentUser } from "@/lib/auth";
import { refreshStudyPlan } from "@/lib/progress";
import { getMasteryRecordsByUser, indexMasteryByKnowledgePoint } from "@/lib/mastery";
import { getStudentProfile } from "@/lib/profiles";
import { unauthorized, withApi } from "@/lib/api/http";
import { v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const refreshPlanBodySchema = v.object<{ subject?: string }>(
  {
    subject: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: false }
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

export const POST = withApi(async (request) => {
  const user = await getCurrentUser();
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
    const enrichedPlans = plans.map((plan) => enrichPlanWithMastery(plan, masteryMap));
    const items = enrichedPlans.flatMap((plan) => plan.items.map((item) => ({ ...item, subject: plan.subject })));
    return { data: { items, plans: enrichedPlans } };
  }

  const plan = await refreshStudyPlan(user.id, body.subject);
  const masteryRecords = await getMasteryRecordsByUser(user.id, body.subject);
  const masteryMap = indexMasteryByKnowledgePoint(masteryRecords);
  return { data: enrichPlanWithMastery(plan, masteryMap) };
});
