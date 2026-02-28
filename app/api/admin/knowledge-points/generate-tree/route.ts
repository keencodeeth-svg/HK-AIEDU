import { requireRole } from "@/lib/guard";
import { createKnowledgePoint, getKnowledgePoints } from "@/lib/content";
import { generateKnowledgeTreeDraft } from "@/lib/ai";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, unauthorized } from "@/lib/api/http";
import {
  generateKnowledgeTreeBodySchema,
  isAllowedSubject
} from "@/lib/api/schemas/admin";
import { parseJson } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

function normalizeKey(unit: string, chapter: string, title: string) {
  return `${unit}`.toLowerCase().replace(/\s+/g, "") + "|" + `${chapter}`.toLowerCase().replace(/\s+/g, "") + "|" + `${title}`.toLowerCase().replace(/\s+/g, "");
}

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

    const body = await parseJson(request, generateKnowledgeTreeBodySchema);
    const subject = body.subject?.trim();
    const grade = body.grade?.trim();
    const edition = body.edition?.trim() || "人教版";
    const volume = body.volume?.trim() || "上册";

    if (!subject || !grade) {
      badRequest("missing fields");
    }
    if (!isAllowedSubject(subject)) {
      badRequest("invalid subject");
    }

    const draft = await generateKnowledgeTreeDraft({
      subject,
      grade,
      edition,
      volume,
      unitCount: body.unitCount
    });

    if (!draft) {
      badRequest("AI 生成失败，请检查模型配置");
    }

    const existing = (await getKnowledgePoints()).filter(
      (kp) => kp.subject === subject && kp.grade === grade
    );
    const existingKeys = new Set(existing.map((kp) => normalizeKey(kp.unit ?? "未分单元", kp.chapter, kp.title)));

    const created: Array<{ id: string }> = [];
    const skipped: { index: number; reason: string }[] = [];

    let index = 0;
    for (const unit of draft.units) {
      for (const chapter of unit.chapters) {
        for (const point of chapter.points) {
          const key = normalizeKey(unit.title, chapter.title, point.title);
          if (existingKeys.has(key)) {
            skipped.push({ index, reason: "已存在" });
            index += 1;
            continue;
          }
          const next = await createKnowledgePoint({
            subject,
            grade,
            title: point.title,
            chapter: chapter.title,
            unit: unit.title
          });
          if (!next) {
            skipped.push({ index, reason: "保存失败" });
          } else {
            created.push(next);
            existingKeys.add(key);
          }
          index += 1;
        }
      }
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
      action: "ai_generate_tree",
      entityType: "knowledge_point",
      entityId: null,
      detail: `created=${created.length}, skipped=${skipped.length}`
    });

    return { created, skipped };
  }
});
