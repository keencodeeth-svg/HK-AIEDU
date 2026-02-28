import { getAbilityRadar } from "@/lib/portrait";
import { getKnowledgePoints } from "@/lib/content";
import { getMasteryRecordsByUser, getWeaknessRankMap } from "@/lib/mastery";
import { unauthorized } from "@/lib/api/http";
import { createLearningRoute } from "@/lib/api/domains";

export const GET = createLearningRoute({
  role: "student",
  cache: "private-short",
  handler: async ({ user }) => {
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const abilities = await getAbilityRadar(user.id);
    const masteryRecords = await getMasteryRecordsByUser(user.id);
    const knowledgePoints = await getKnowledgePoints();
    const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp]));
    const weaknessRankMap = getWeaknessRankMap(masteryRecords);

    const weakKnowledgePoints = masteryRecords
      .map((item) => ({
        knowledgePointId: item.knowledgePointId,
        title: kpMap.get(item.knowledgePointId)?.title ?? "知识点",
        subject: item.subject,
        masteryScore: item.masteryScore,
        masteryLevel: item.masteryLevel,
        confidenceScore: item.confidenceScore,
        recencyWeight: item.recencyWeight,
        masteryTrend7d: item.masteryTrend7d,
        weaknessRank: weaknessRankMap.get(item.knowledgePointId) ?? null,
        correct: item.correct,
        total: item.total,
        lastAttemptAt: item.lastAttemptAt
      }))
      .sort((a, b) => {
        if (a.masteryScore === b.masteryScore) return b.total - a.total;
        return a.masteryScore - b.masteryScore;
      })
      .slice(0, 5);

    const averageMasteryScore = masteryRecords.length
      ? Math.round(masteryRecords.reduce((sum, item) => sum + item.masteryScore, 0) / masteryRecords.length)
      : 0;
    const averageConfidenceScore = masteryRecords.length
      ? Math.round(masteryRecords.reduce((sum, item) => sum + item.confidenceScore, 0) / masteryRecords.length)
      : 0;
    const averageTrend7d = masteryRecords.length
      ? Math.round(masteryRecords.reduce((sum, item) => sum + item.masteryTrend7d, 0) / masteryRecords.length)
      : 0;

    const subjectStats = new Map<
      string,
      { total: number; scoreSum: number; confidenceSum: number; trendSum: number }
    >();
    masteryRecords.forEach((item) => {
      const current = subjectStats.get(item.subject) ?? {
        total: 0,
        scoreSum: 0,
        confidenceSum: 0,
        trendSum: 0
      };
      current.total += 1;
      current.scoreSum += item.masteryScore;
      current.confidenceSum += item.confidenceScore;
      current.trendSum += item.masteryTrend7d;
      subjectStats.set(item.subject, current);
    });

    const subjects = Array.from(subjectStats.entries())
      .map(([subject, stat]) => ({
        subject,
        averageMasteryScore: stat.total ? Math.round(stat.scoreSum / stat.total) : 0,
        averageConfidenceScore: stat.total ? Math.round(stat.confidenceSum / stat.total) : 0,
        averageTrend7d: stat.total ? Math.round(stat.trendSum / stat.total) : 0,
        trackedKnowledgePoints: stat.total
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    return {
      data: {
        abilities,
        mastery: {
          averageMasteryScore,
          averageConfidenceScore,
          averageTrend7d,
          trackedKnowledgePoints: masteryRecords.length,
          weakKnowledgePoints,
          subjects
        }
      }
    };
  }
});
