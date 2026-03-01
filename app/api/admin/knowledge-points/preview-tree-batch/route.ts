import { requireRole } from "@/lib/guard";
import { generateKnowledgeTreeDraft } from "@/lib/ai";
import { badRequest, unauthorized } from "@/lib/api/http";
import { isAllowedSubject, previewTreeBatchBodySchema } from "@/lib/api/schemas/admin";
import { parseJson } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

  const body = await parseJson(request, previewTreeBatchBodySchema);

  const explicitCombos = Array.isArray(body.combos)
    ? body.combos
        .map((item) => ({
          subject: item.subject?.trim() ?? "",
          grade: item.grade?.trim() ?? ""
        }))
        .filter((item) => item.subject && item.grade)
    : [];
  let combos: Array<{ subject: string; grade: string }> = [];
  if (explicitCombos.length) {
    combos = explicitCombos;
  } else {
    const subjects = Array.isArray(body.subjects)
      ? body.subjects.map((item) => item.trim()).filter(Boolean)
      : [];
    const grades = Array.isArray(body.grades) ? body.grades.map((item) => item.trim()).filter(Boolean) : [];

    if (!subjects.length || !grades.length) {
      badRequest("subjects and grades required");
    }

    subjects.forEach((subject) => {
      grades.forEach((grade) => combos.push({ subject, grade }));
    });
  }

  const deduped = new Map<string, { subject: string; grade: string }>();
  // Normalize subject-grade pairs so preview generation stays idempotent for repeated inputs.
  combos.forEach((combo) => {
    if (!isAllowedSubject(combo.subject)) return;
    const key = `${combo.subject}|${combo.grade}`;
    deduped.set(key, combo);
  });
  combos = Array.from(deduped.values());

  if (!combos.length) {
    badRequest("invalid subjects");
  }

  const items: any[] = [];
  const failed: { subject: string; grade: string; reason: string }[] = [];

  for (const combo of combos) {
    // Preview endpoint only returns generated tree draft; no persistence side-effects.
    const draft = await generateKnowledgeTreeDraft({
      subject: combo.subject,
      grade: combo.grade,
      edition: body.edition?.trim() || "人教版",
      volume: body.volume?.trim() || "上册",
      unitCount: body.unitCount,
      chaptersPerUnit: body.chaptersPerUnit,
      pointsPerChapter: body.pointsPerChapter
    });

    if (!draft) {
      failed.push({ subject: combo.subject, grade: combo.grade, reason: "AI 生成失败" });
      continue;
    }

    items.push({ subject: combo.subject, grade: combo.grade, units: draft.units });
  }

  if (!items.length && failed.length) {
    const brief = failed
      .slice(0, 3)
      .map((item) => `${item.subject}-${item.grade}：${item.reason}`)
      .join("；");
    badRequest(brief ? `批量预览失败：${brief}` : "批量预览失败，请检查模型配置");
  }

    return { items, failed, summary: { requested: combos.length, generated: items.length, failed: failed.length } };
  }
});
