import { getQuestions } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { parseJson } from "@/lib/api/validation";
import { questionQualityCheckBodySchema, trimStringArray } from "@/lib/api/schemas/admin";
import { evaluateQuestionQuality, upsertQuestionQualityMetric } from "@/lib/question-quality";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

  const body = await parseJson(request, questionQualityCheckBodySchema);
  const allQuestions = await getQuestions();
  const questionId = body.questionId?.trim();

  if (questionId) {
    const question = allQuestions.find((item) => item.id === questionId);
    if (!question) {
      notFound("question not found");
    }

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

    // Persist metric when questionId is provided so quality panel can query latest governance state.
    const metric = await upsertQuestionQualityMetric({
      questionId: question.id,
      ...snapshot
    });

    if (metric) {
      return { data: metric, saved: true };
    }

    return {
      data: {
        questionId: question.id,
        ...snapshot,
        checkedAt: new Date().toISOString()
      },
      saved: false
    };
  }

  const stem = body.stem?.trim() ?? "";
  const options = trimStringArray(body.options);
  const answer = body.answer?.trim() ?? "";
  if (!stem || !options.length || !answer) {
    badRequest("missing fields");
  }

  const snapshot = evaluateQuestionQuality(
    {
      subject: body.subject?.trim(),
      grade: body.grade?.trim(),
      knowledgePointId: body.knowledgePointId?.trim(),
      stem,
      options,
      answer,
      explanation: body.explanation?.trim() ?? ""
    },
    allQuestions
  );
  // Ad-hoc preview mode: evaluate arbitrary draft without writing persistence.

    return {
      data: {
        questionId: null,
        ...snapshot,
        checkedAt: new Date().toISOString()
      },
      saved: false
    };
  }
});
