import { requireRole } from "@/lib/guard";
import { createKnowledgePoint, getKnowledgePoints } from "@/lib/content";
import { generateKnowledgePointsDraft } from "@/lib/ai";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import {
  generateKnowledgePointBodySchema,
  isAllowedSubject
} from "@/lib/api/schemas/admin";
import { parseJson } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

function normalizeKey(title: string, chapter: string) {
  return `${title}`.toLowerCase().replace(/\s+/g, "") + "|" + `${chapter}`.toLowerCase().replace(/\s+/g, "");
}

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

    const body = await parseJson(request, generateKnowledgePointBodySchema);
    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    const chapter = body.chapter?.trim() || undefined;

    if (!subject || !grade) {
      badRequest("missing fields");
    }
    if (!isAllowedSubject(subject)) {
      badRequest("invalid subject");
    }

    const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);

    const drafts = await generateKnowledgePointsDraft({
      subject,
      grade,
      chapter,
      count
    });

    if (!drafts) {
      badRequest("AI 生成失败，请检查模型配置");
    }

    const existing = (await getKnowledgePoints()).filter(
      (kp) => kp.subject === subject && kp.grade === grade
    );
    // Deduplicate by title+chapter before persistence to avoid repeated AI artifacts.
    const existingKeys = new Set(existing.map((kp) => normalizeKey(kp.title, kp.chapter)));

    const created: Array<{ id: string }> = [];
    const skipped: { index: number; reason: string }[] = [];

    for (const [index, draft] of drafts.entries()) {
      const draftChapter = draft.chapter || chapter || "未归类";
      const key = normalizeKey(draft.title, draftChapter);
      if (existingKeys.has(key)) {
        skipped.push({ index, reason: "已存在" });
        continue;
      }

      const next = await createKnowledgePoint({
        subject,
        grade,
        title: draft.title,
        chapter: draftChapter
      });

      if (!next) {
        skipped.push({ index, reason: "保存失败" });
        continue;
      }
      created.push(next);
      existingKeys.add(key);
    }

    if (!created.length) {
      const brief = skipped
        .slice(0, 3)
        .map((item) => `第 ${item.index + 1} 条：${item.reason}`)
        .join("；");
      badRequest(brief ? `AI 生成失败：${brief}` : "AI 生成失败，请检查模型配置");
    }

    await addAdminLog({
      adminId: user.id,
      action: "ai_generate_knowledge_points",
      entityType: "knowledge_point",
      entityId: null,
      detail: `count=${count}, created=${created.length}, skipped=${skipped.length}`
    });

    return { created, skipped };
  }
});
