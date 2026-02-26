import { getQuestions } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { badRequest, notFound, unauthorized, withApi } from "@/lib/api/http";
import { parseJson } from "@/lib/api/validation";
import {
  listQuestionQualityMetrics,
  setQuestionIsolation
} from "@/lib/question-quality";
import { questionIsolationBodySchema } from "@/lib/api/schemas/admin";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const user = await requireRole("admin");
  if (!user) {
    unauthorized();
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(rawLimit) ? Math.min(300, Math.max(1, Math.floor(rawLimit))) : 80;

  const metrics = await listQuestionQualityMetrics({ isolated: true });
  const questions = await getQuestions();
  const questionMap = new Map(questions.map((item) => [item.id, item]));

  return {
    data: metrics.slice(0, limit).map((metric) => {
      const question = questionMap.get(metric.questionId);
      return {
        questionId: metric.questionId,
        stem: question?.stem ?? null,
        subject: question?.subject ?? null,
        grade: question?.grade ?? null,
        qualityScore: metric.qualityScore,
        riskLevel: metric.riskLevel,
        isolationReason: metric.isolationReason,
        checkedAt: metric.checkedAt
      };
    })
  };
});

export const POST = withApi(async (request) => {
  const user = await requireRole("admin");
  if (!user) {
    unauthorized();
  }

  const body = await parseJson(request, questionIsolationBodySchema);
  const questionId = body.questionId?.trim();
  if (!questionId) {
    badRequest("questionId required");
  }
  if (typeof body.isolated !== "boolean") {
    badRequest("isolated required");
  }

  const questions = await getQuestions();
  const question = questions.find((item) => item.id === questionId);
  if (!question) {
    notFound("question not found");
  }

  const metric = await setQuestionIsolation({
    questionId,
    isolated: body.isolated,
    isolationReason: body.reason ?? []
  });
  if (!metric) {
    notFound("quality metric not found");
  }

  return {
    data: {
      questionId,
      isolated: metric.isolated,
      riskLevel: metric.riskLevel,
      isolationReason: metric.isolationReason,
      checkedAt: metric.checkedAt
    }
  };
});
