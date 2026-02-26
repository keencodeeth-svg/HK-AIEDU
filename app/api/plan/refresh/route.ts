import { getCurrentUser } from "@/lib/auth";
import { refreshStudyPlan } from "@/lib/progress";
import {
  getMasteryRecordsByUser,
  getWeaknessRankMap,
  indexMasteryByKnowledgePoint,
  type MasteryRecord
} from "@/lib/mastery";
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
  masteryMap: Map<string, MasteryRecord>,
  weaknessRankMap: Map<string, number>
) {
  return {
    ...plan,
    items: plan.items.map((item) => {
      const mastery = masteryMap.get(item.knowledgePointId);
      const weaknessRank = weaknessRankMap.get(item.knowledgePointId) ?? null;
      let recommendedReason = "保持巩固，防止遗忘";
      if ((mastery?.masteryLevel ?? "weak") === "weak") {
        recommendedReason = `薄弱点优先（第 ${weaknessRank ?? "-"} 位）`;
      } else if ((mastery?.masteryTrend7d ?? 0) < 0) {
        recommendedReason = `近期下滑 ${Math.abs(mastery?.masteryTrend7d ?? 0)} 分，建议回补`;
      } else if ((mastery?.confidenceScore ?? 0) < 40) {
        recommendedReason = "样本偏少，建议继续练习巩固";
      }
      return {
        ...item,
        masteryScore: mastery?.masteryScore ?? 0,
        masteryLevel: mastery?.masteryLevel ?? "weak",
        confidenceScore: mastery?.confidenceScore ?? 0,
        recencyWeight: mastery?.recencyWeight ?? 0,
        masteryTrend7d: mastery?.masteryTrend7d ?? 0,
        weaknessRank,
        masteryCorrect: mastery?.correct ?? 0,
        masteryTotal: mastery?.total ?? 0,
        recommendedReason
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
});
