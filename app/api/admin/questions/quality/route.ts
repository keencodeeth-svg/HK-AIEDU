import { getQuestions } from "@/lib/content";
import { notFound, unauthorized } from "@/lib/api/http";
import { questionQualityQuerySchema } from "@/lib/api/schemas/admin";
import { evaluateAndUpsertQuestionQuality, listQuestionQualityMetrics } from "@/lib/question-quality";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

type QualityItem = {
  questionId: string;
  subject: string;
  grade: string;
  knowledgePointId: string;
  stem: string;
  qualityScore: number;
  duplicateRisk: "low" | "medium" | "high";
  ambiguityRisk: "low" | "medium" | "high";
  answerConsistency: number;
  duplicateClusterId: string | null;
  answerConflict: boolean;
  riskLevel: "low" | "medium" | "high";
  isolated: boolean;
  isolationReason: string[];
  issues: string[];
  checkedAt: string | null;
};

function toQualityLevel(score: number) {
  if (score >= 80) return "good";
  if (score >= 60) return "watch";
  return "bad";
}

export const GET = createAdminRoute({
  role: "admin",
  query: questionQualityQuerySchema,
  cache: "private-realtime",
  handler: async ({ query, user }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }

    const questionId = query.questionId?.trim();
    const subject = query.subject?.trim();
    const grade = query.grade?.trim();
    const pool = query.pool?.trim();
    const isolatedOnly = pool === "isolated";
    const limit = query.limit ? Math.min(query.limit, 300) : undefined;

    const allQuestions = await getQuestions();
    let filtered = allQuestions.filter((question) => {
      if (questionId && question.id !== questionId) return false;
      if (subject && question.subject !== subject) return false;
      if (grade && question.grade !== grade) return false;
      return true;
    });

    if (questionId && !filtered.length) {
      notFound("question not found");
    }

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    const existingMetrics = await listQuestionQualityMetrics({
      questionIds: filtered.map((item) => item.id),
      isolated: isolatedOnly ? true : undefined
    });
    const metricMap = new Map(existingMetrics.map((item) => [item.questionId, item]));

    for (const question of filtered) {
      if (metricMap.has(question.id)) {
        continue;
      }
      const metric = await evaluateAndUpsertQuestionQuality({
        question,
        candidates: allQuestions
      });
      if (metric) {
        metricMap.set(question.id, metric);
      }
    }

    let data: QualityItem[] = filtered.map((question) => {
      const metric = metricMap.get(question.id);
      return {
        questionId: question.id,
        subject: question.subject,
        grade: question.grade,
        knowledgePointId: question.knowledgePointId,
        stem: question.stem,
        qualityScore: metric?.qualityScore ?? 0,
        duplicateRisk: metric?.duplicateRisk ?? "low",
        ambiguityRisk: metric?.ambiguityRisk ?? "low",
        answerConsistency: metric?.answerConsistency ?? 0,
        duplicateClusterId: metric?.duplicateClusterId ?? null,
        answerConflict: metric?.answerConflict ?? false,
        riskLevel: metric?.riskLevel ?? "low",
        isolated: metric?.isolated ?? false,
        isolationReason: metric?.isolationReason ?? [],
        issues: metric?.issues ?? [],
        checkedAt: metric?.checkedAt ?? null
      };
    });
    if (isolatedOnly) {
      data = data.filter((item) => item.isolated);
    }

    const duplicateClusterCount = new Set(
      data.filter((item) => item.duplicateClusterId).map((item) => item.duplicateClusterId)
    ).size;
    const answerConflictCount = data.filter((item) => item.answerConflict).length;
    const isolatedCount = data.filter((item) => item.isolated).length;

    const summary = {
      total: data.length,
      averageQualityScore: data.length
        ? Math.round(data.reduce((sum, item) => sum + item.qualityScore, 0) / data.length)
        : 0,
      isolatedCount,
      duplicateClusterCount,
      answerConflictCount,
      highRiskCount: data.filter(
        (item) =>
          item.duplicateRisk === "high" ||
          item.ambiguityRisk === "high" ||
          toQualityLevel(item.qualityScore) === "bad"
      ).length,
      mediumRiskCount: data.filter(
        (item) =>
          item.duplicateRisk === "medium" ||
          item.ambiguityRisk === "medium" ||
          toQualityLevel(item.qualityScore) === "watch"
      ).length
    };

    return { data, summary };
  }
});
