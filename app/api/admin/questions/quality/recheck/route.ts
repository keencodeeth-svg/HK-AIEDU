import { getQuestions } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson } from "@/lib/api/validation";
import { questionQualityRecheckBodySchema, trimStringArray } from "@/lib/api/schemas/admin";
import {
  evaluateQuestionQuality,
  listQuestionQualityMetrics,
  type QuestionQualityMetric,
  upsertQuestionQualityMetric
} from "@/lib/question-quality";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const DEFAULT_RECHECK_LIMIT = 500;
const MAX_TOP_CLUSTERS = 10;

function metricSignature(metric: QuestionQualityMetric) {
  return JSON.stringify({
    qualityScore: metric.qualityScore,
    duplicateRisk: metric.duplicateRisk,
    ambiguityRisk: metric.ambiguityRisk,
    answerConsistency: metric.answerConsistency,
    duplicateClusterId: metric.duplicateClusterId,
    answerConflict: metric.answerConflict,
    riskLevel: metric.riskLevel,
    isolated: metric.isolated,
    isolationReason: metric.isolationReason,
    issues: metric.issues
  });
}

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

  const startedAt = Date.now();
  const body = await parseJson(request, questionQualityRecheckBodySchema);
  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const questionIdList = trimStringArray(body.questionIds);
  const questionIdSet = new Set(questionIdList);
  const includeIsolated = body.includeIsolated !== false;
  const limit = body.limit ?? DEFAULT_RECHECK_LIMIT;

  const allQuestions = await getQuestions();
  let scoped = allQuestions.filter((question) => {
    if (subject && question.subject !== subject) return false;
    if (grade && question.grade !== grade) return false;
    if (questionIdSet.size && !questionIdSet.has(question.id)) return false;
    return true;
  });

  if (!scoped.length) {
    badRequest("no questions matched");
  }

  const matchedCount = scoped.length;
  scoped = scoped.slice(0, limit);

  const existingList = await listQuestionQualityMetrics({
    questionIds: scoped.map((item) => item.id)
  });
  const existingMap = new Map(existingList.map((item) => [item.questionId, item]));

  let skippedIsolated = 0;
  if (!includeIsolated) {
    const filtered = scoped.filter((question) => {
      const isolated = existingMap.get(question.id)?.isolated === true;
      if (isolated) {
        skippedIsolated += 1;
        return false;
      }
      return true;
    });
    scoped = filtered;
  }

  if (!scoped.length) {
    badRequest("no questions to recheck");
  }

  let newlyTracked = 0;
  let updated = 0;
  let unchanged = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let isolatedCount = 0;
  let answerConflictCount = 0;
  const clusterStats = new Map<
    string,
    { id: string; count: number; highRiskCount: number; isolatedCount: number }
  >();

  for (const question of scoped) {
    const snapshot = evaluateQuestionQuality(
      {
        questionId: question.id,
        subject: question.subject,
        grade: question.grade,
        knowledgePointId: question.knowledgePointId,
        stem: question.stem,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation
      },
      allQuestions
    );

    const nextMetric = await upsertQuestionQualityMetric({
      questionId: question.id,
      ...snapshot
    });
    if (!nextMetric) {
      continue;
    }

    const previousMetric = existingMap.get(question.id);
    if (!previousMetric) {
      newlyTracked += 1;
    } else if (metricSignature(previousMetric) === metricSignature(nextMetric)) {
      unchanged += 1;
    } else {
      updated += 1;
    }

    if (nextMetric.riskLevel === "high") {
      highRiskCount += 1;
    } else if (nextMetric.riskLevel === "medium") {
      mediumRiskCount += 1;
    }
    if (nextMetric.isolated) {
      isolatedCount += 1;
    }
    if (nextMetric.answerConflict) {
      answerConflictCount += 1;
    }

    if (nextMetric.duplicateClusterId) {
      const current = clusterStats.get(nextMetric.duplicateClusterId) ?? {
        id: nextMetric.duplicateClusterId,
        count: 0,
        highRiskCount: 0,
        isolatedCount: 0
      };
      current.count += 1;
      if (nextMetric.riskLevel === "high") {
        current.highRiskCount += 1;
      }
      if (nextMetric.isolated) {
        current.isolatedCount += 1;
      }
      clusterStats.set(nextMetric.duplicateClusterId, current);
    }
  }

  const topDuplicateClusters = Array.from(clusterStats.values())
    .sort((a, b) => b.count - a.count || b.highRiskCount - a.highRiskCount || a.id.localeCompare(b.id))
    .slice(0, MAX_TOP_CLUSTERS);

    return {
      data: {
        scope: {
          subject: subject ?? "all",
          grade: grade ?? "all",
          requestedQuestionIds: questionIdList.length,
          matchedCount,
          processedCount: scoped.length,
          skippedIsolated,
          includeIsolated,
          limit
        },
        summary: {
          newlyTracked,
          updated,
          unchanged,
          highRiskCount,
          mediumRiskCount,
          isolatedCount,
          answerConflictCount,
          duplicateClusterCount: clusterStats.size,
          topDuplicateClusters
        },
        durationMs: Date.now() - startedAt
      }
    };
  }
});
