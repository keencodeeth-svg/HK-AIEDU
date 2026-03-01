import { requireRole } from "@/lib/guard";
import { createKnowledgePoint, getKnowledgePoints } from "@/lib/content";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, unauthorized } from "@/lib/api/http";
import {
  importTreeBodySchema,
  isAllowedSubject
} from "@/lib/api/schemas/admin";
import { parseJson } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

function normalizeKey(subject: string, grade: string, unit: string, chapter: string, title: string) {
  return (
    `${subject}`.toLowerCase().replace(/\s+/g, "") +
    "|" +
    `${grade}`.toLowerCase().replace(/\s+/g, "") +
    "|" +
    `${unit}`.toLowerCase().replace(/\s+/g, "") +
    "|" +
    `${chapter}`.toLowerCase().replace(/\s+/g, "") +
    "|" +
    `${title}`.toLowerCase().replace(/\s+/g, "")
  );
}

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

  const body = await parseJson(request, importTreeBodySchema);

  if (!body.items?.length) {
    badRequest("items required");
  }

  const created: Array<{ id: string }> = [];
  const skipped: { index: number; reason: string }[] = [];

  const existing = await getKnowledgePoints();
  // Build full-scope key to prevent cross-batch duplicate imports.
  const existingKeys = new Set(
    existing.map((kp) => normalizeKey(kp.subject, kp.grade, kp.unit ?? "未分单元", kp.chapter, kp.title))
  );

  let index = 0;
  for (const item of body.items) {
    const subject = item.subject?.trim();
    const grade = item.grade?.trim();
    if (!subject || !grade) {
      skipped.push({ index, reason: "missing fields" });
      index += 1;
      continue;
    }

    if (!isAllowedSubject(subject)) {
      skipped.push({ index, reason: "invalid subject" });
      index += 1;
      continue;
    }

    const units = item.units ?? [];
    for (const unit of units) {
      const unitTitle = unit.title?.trim() || "未分单元";
      for (const chapter of unit.chapters ?? []) {
        const chapterTitle = chapter.title?.trim() || "未归类";
        for (const point of chapter.points ?? []) {
          const pointTitle = point.title?.trim();
          if (!pointTitle) {
            skipped.push({ index, reason: "missing title" });
            index += 1;
            continue;
          }

          const key = normalizeKey(subject, grade, unitTitle, chapterTitle, pointTitle);
          if (existingKeys.has(key)) {
            skipped.push({ index, reason: "已存在" });
            index += 1;
            continue;
          }
          const next = await createKnowledgePoint({
            subject,
            grade,
            title: pointTitle,
            chapter: chapterTitle,
            unit: unitTitle
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
  }

    await addAdminLog({
      adminId: user.id,
      action: "import_knowledge_tree",
      entityType: "knowledge_point",
      entityId: null,
      detail: `created=${created.length}, skipped=${skipped.length}`
    });

    return { created, skipped };
  }
});
