import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { buildAdminAuditDetail, diffAuditFields } from "@/lib/admin-audit";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { getExperimentFlag, listExperimentFlags, upsertExperimentFlag } from "@/lib/experiments";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const updateFlagBodySchema = v.object<{
  key?: string;
  enabled?: boolean;
  rollout?: number;
}>(
  {
    key: v.optional(v.string({ allowEmpty: true, trim: false })),
    enabled: v.optional(v.boolean()),
    rollout: v.optional(v.number({ integer: true, min: 0, max: 100, coerce: true }))
  },
  { allowUnknown: false }
);

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async () => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    const data = await listExperimentFlags();
    return { data };
  }
});

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

    const body = await parseJson(request, updateFlagBodySchema);
    const key = body.key?.trim().toLowerCase();
    if (!key) {
      badRequest("missing key");
    }
    if (body.enabled === undefined && body.rollout === undefined) {
      badRequest("missing update fields");
    }

    const current = await getExperimentFlag(key);
    const next = await upsertExperimentFlag({
      key,
      enabled: body.enabled,
      rollout: body.rollout
    });

    const beforeSnapshot = {
      enabled: current?.enabled ?? null,
      rollout: current?.rollout ?? null
    };
    const afterSnapshot = {
      enabled: next.enabled,
      rollout: next.rollout
    };

    await addAdminLog({
      adminId: user.id,
      action: "update_experiment_flag",
      entityType: "experiment_flag",
      entityId: key,
      detail: buildAdminAuditDetail({
        summary: "更新实验灰度开关",
        changedFields: diffAuditFields(beforeSnapshot, afterSnapshot),
        before: beforeSnapshot,
        after: afterSnapshot,
        meta: {
          key,
          name: next.name
        }
      })
    });

    const all = await listExperimentFlags();
    return { data: next, flags: all };
  }
});
