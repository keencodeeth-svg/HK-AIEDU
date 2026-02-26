import { createQuestion, getQuestions } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
import { evaluateAndUpsertQuestionQuality } from "@/lib/question-quality";
import {
  importQuestionBodySchema,
  isAllowedSubject,
  normalizeDifficulty,
  trimStringArray
} from "@/lib/api/schemas/admin";
import { parseJson } from "@/lib/api/validation";
export const dynamic = "force-dynamic";

export const POST = withApi(async (request) => {
  const user = await requireRole("admin");
  if (!user) {
    unauthorized();
  }

  const body = await parseJson(request, importQuestionBodySchema);

  if (!body.items?.length) {
    badRequest("items required");
  }

  const qualityCandidates = await getQuestions();
  const created: Array<{
    id: string;
    qualityScore: number | null;
    duplicateRisk: string | null;
    ambiguityRisk: string | null;
    answerConsistency: number | null;
    duplicateClusterId: string | null;
    answerConflict: boolean;
    riskLevel: string | null;
    isolated: boolean;
  }> = [];
  const failed: { index: number; reason: string }[] = [];

  for (const [index, item] of body.items.entries()) {
    const subject = item.subject?.trim();
    const grade = item.grade?.trim();
    const knowledgePointId = item.knowledgePointId?.trim();
    const stem = item.stem?.trim();
    const answer = item.answer?.trim();
    const options = trimStringArray(item.options);

    if (!subject || !grade || !knowledgePointId || !stem || !options.length || !answer) {
      failed.push({ index, reason: "missing fields" });
      continue;
    }

    if (!isAllowedSubject(subject)) {
      failed.push({ index, reason: "invalid subject" });
      continue;
    }

    const difficulty = normalizeDifficulty(item.difficulty);

    const next = await createQuestion({
      subject,
      grade,
      knowledgePointId,
      stem,
      options,
      answer,
      explanation: item.explanation?.trim() ?? "",
      difficulty,
      questionType: item.questionType?.trim() || "choice",
      tags: trimStringArray(item.tags),
      abilities: trimStringArray(item.abilities)
    });
    if (!next?.id) {
      failed.push({ index, reason: "save failed" });
      continue;
    }

    const quality = await evaluateAndUpsertQuestionQuality({
      question: next,
      candidates: qualityCandidates
    });
    qualityCandidates.push(next);
    created.push({
      id: next.id,
      qualityScore: quality?.qualityScore ?? null,
      duplicateRisk: quality?.duplicateRisk ?? null,
      ambiguityRisk: quality?.ambiguityRisk ?? null,
      answerConsistency: quality?.answerConsistency ?? null,
      duplicateClusterId: quality?.duplicateClusterId ?? null,
      answerConflict: quality?.answerConflict ?? false,
      riskLevel: quality?.riskLevel ?? null,
      isolated: quality?.isolated ?? false
    });
  }

  await addAdminLog({
    adminId: user.id,
    action: "import_questions",
    entityType: "question",
    entityId: null,
    detail: `created=${created.length}, failed=${failed.length}`
  });

  return { created: created.length, failed, items: created };
});
