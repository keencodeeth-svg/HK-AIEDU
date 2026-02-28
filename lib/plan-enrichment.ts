import type { MasteryRecord } from "./mastery";

type PlanItem = {
  knowledgePointId: string;
  targetCount: number;
  dueDate: string;
};

type PlanLike = {
  subject: string;
  items: PlanItem[];
};

export function enrichPlanWithMastery(
  plan: PlanLike,
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
