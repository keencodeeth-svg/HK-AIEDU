import { requireRole } from "@/lib/guard";
import { createQuestion, getKnowledgePoints, getQuestions } from "@/lib/content";
import { generateQuestionDraft } from "@/lib/ai";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import { evaluateAndUpsertQuestionQuality } from "@/lib/question-quality";
import {
  generateBatchBodySchema,
  isAllowedSubject,
  normalizeDifficulty
} from "@/lib/api/schemas/admin";
import { parseJson } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

function normalizeStem(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？,.!?;:；：、]/g, "");
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

  const body = await parseJson(request, generateBatchBodySchema);
  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const chapter = body.chapter?.trim();

  if (!subject || !grade) {
    badRequest("missing fields");
  }

  if (!isAllowedSubject(subject)) {
    badRequest("invalid subject");
  }

  const difficulty = normalizeDifficulty(body.difficulty);

  const allKps = await getKnowledgePoints();
  const available = allKps.filter((kp) => {
    if (kp.subject !== subject) return false;
    if (kp.grade !== grade) return false;
    if (chapter && kp.chapter !== chapter) return false;
    return true;
  });

  if (!available.length) {
    badRequest("no knowledge points");
  }

  const total = Math.min(Math.max(Number(body.count) || 10, 10), 50);
  const kpList = shuffle(available);

  const existing = (await getQuestions()).filter((q) => q.subject === subject && q.grade === grade);
  const existingStems = new Set(existing.map((q) => normalizeStem(q.stem)));
  const createdStems = new Set<string>();
  const qualityCandidates = [...existing];

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

  for (let i = 0; i < total; i += 1) {
    const kp = kpList[i % kpList.length];
    let draft = null;
    let attempts = 0;

    while (!draft && attempts < 3) {
      // Retry a few times to avoid duplicate stems from stochastic model sampling.
      attempts += 1;
      const next = await generateQuestionDraft({
        subject,
        grade,
        knowledgePointTitle: kp.title,
        chapter: kp.chapter,
        difficulty
      });
      if (!next) continue;
      const key = normalizeStem(next.stem);
      if (existingStems.has(key) || createdStems.has(key)) {
        continue;
      }
      draft = next;
      createdStems.add(key);
    }

    if (!draft) {
      failed.push({ index: i, reason: "AI 生成失败" });
      continue;
    }

    const next = await createQuestion({
      subject,
      grade,
      knowledgePointId: kp.id,
      stem: draft.stem,
      options: draft.options,
      answer: draft.answer,
      explanation: draft.explanation,
      difficulty,
      questionType: "choice",
      tags: [],
      abilities: []
    });

    if (!next) {
      failed.push({ index: i, reason: "保存题目失败" });
      continue;
    }

    const quality = await evaluateAndUpsertQuestionQuality({
      question: next,
      candidates: qualityCandidates
    });
    // Feed newly created question back into candidate pool to reduce same-batch duplicates/conflicts.
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

  if (!created.length) {
    const brief = failed
      .slice(0, 3)
      .map((item) => `第 ${item.index + 1} 题：${item.reason}`)
      .join("；");
    badRequest(brief ? `AI 批量生成失败：${brief}` : "AI 批量生成失败，请检查模型配置");
  }

    await addAdminLog({
      adminId: user.id,
      action: "ai_generate_batch",
      entityType: "question",
      entityId: null,
      detail: `count=${total}, created=${created.length}, failed=${failed.length}`
    });

    return { created, failed };
  }
});
