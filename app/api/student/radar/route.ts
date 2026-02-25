import { getCurrentUser } from "@/lib/auth";
import { getAbilityRadar } from "@/lib/portrait";
import { getKnowledgePoints } from "@/lib/content";
import { getMasteryRecordsByUser } from "@/lib/mastery";
import { unauthorized, withApi } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    unauthorized();
  }

  const abilities = await getAbilityRadar(user.id);
  const masteryRecords = await getMasteryRecordsByUser(user.id);
  const knowledgePoints = await getKnowledgePoints();
  const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp]));

  const weakKnowledgePoints = masteryRecords
    .map((item) => ({
      knowledgePointId: item.knowledgePointId,
      title: kpMap.get(item.knowledgePointId)?.title ?? "知识点",
      subject: item.subject,
      masteryScore: item.masteryScore,
      masteryLevel: item.masteryLevel,
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

  const subjectStats = new Map<string, { total: number; scoreSum: number }>();
  masteryRecords.forEach((item) => {
    const current = subjectStats.get(item.subject) ?? { total: 0, scoreSum: 0 };
    current.total += 1;
    current.scoreSum += item.masteryScore;
    subjectStats.set(item.subject, current);
  });

  const subjects = Array.from(subjectStats.entries())
    .map(([subject, stat]) => ({
      subject,
      averageMasteryScore: stat.total ? Math.round(stat.scoreSum / stat.total) : 0,
      trackedKnowledgePoints: stat.total
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return {
    data: {
      abilities,
      mastery: {
        averageMasteryScore,
        trackedKnowledgePoints: masteryRecords.length,
        weakKnowledgePoints,
        subjects
      }
    }
  };
});
