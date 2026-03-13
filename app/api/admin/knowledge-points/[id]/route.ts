import { deleteKnowledgePoint, updateKnowledgePoint } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import type { KnowledgePoint } from "@/lib/types";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import {
  adminIdParamsSchema,
  isAllowedSubject,
  updateKnowledgePointBodySchema
} from "@/lib/api/schemas/admin";
import { parseJson, parseParams } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

export const PATCH = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request, params: rawParams }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);
    const params = parseParams(rawParams, adminIdParamsSchema);
    const body = await parseJson(request, updateKnowledgePointBodySchema);

    const updates: Partial<KnowledgePoint> = {};

  if (body.subject !== undefined) {
    const subject = body.subject.trim();
    if (!subject || !isAllowedSubject(subject)) {
      badRequest("invalid subject");
    }
    updates.subject = subject;
  }

  if (body.grade !== undefined) {
    const grade = body.grade.trim();
    if (!grade) {
      badRequest("grade cannot be empty");
    }
    updates.grade = grade;
  }

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) {
      badRequest("title cannot be empty");
    }
    updates.title = title;
  }

  if (body.chapter !== undefined) {
    const chapter = body.chapter.trim();
    if (!chapter) {
      badRequest("chapter cannot be empty");
    }
    updates.chapter = chapter;
  }

  if (body.unit !== undefined) {
    const unit = body.unit.trim();
    updates.unit = unit || "未分单元";
  }

    const next = await updateKnowledgePoint(params.id, updates);
    if (!next) {
      notFound("not found");
    }

    await addAdminLog({
      adminId: user.id,
      action: "update_knowledge_point",
      entityType: "knowledge_point",
      entityId: next.id,
      detail: `${next.subject} ${next.grade} ${next.unit ?? "未分单元"} ${next.title}`
    });

    return { data: next };
  }
});

export const DELETE = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ params: rawParams }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);
    const params = parseParams(rawParams, adminIdParamsSchema);

    const ok = await deleteKnowledgePoint(params.id);
    if (!ok) {
      notFound("not found");
    }

    await addAdminLog({
      adminId: user.id,
      action: "delete_knowledge_point",
      entityType: "knowledge_point",
      entityId: params.id,
      detail: ""
    });

    return { ok: true };
  }
});
