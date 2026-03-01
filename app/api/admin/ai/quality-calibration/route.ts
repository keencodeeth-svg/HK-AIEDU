import { createAdminRoute } from "@/lib/api/domains";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import {
  getAiQualityCalibration,
  listAiQualityCalibrationSnapshots,
  rollbackAiQualityCalibration,
  upsertAiQualityCalibration,
  type AiQualityCalibrationPatch
} from "@/lib/ai-quality-calibration";
import { v } from "@/lib/api/validation";

const querySchema = v.object<{ historyLimit?: number }>(
  {
    historyLimit: v.optional(v.number({ integer: true, min: 1, max: 100, coerce: true }))
  },
  { allowUnknown: true }
);

function toNumberMap(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const next: Record<string, number> = {};
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = value;
    }
  });
  return next;
}

function buildPayload(historyLimit = 20) {
  return {
    ...getAiQualityCalibration(),
    snapshots: listAiQualityCalibrationSnapshots(historyLimit)
  };
}

export const GET = createAdminRoute({
  role: "admin",
  query: querySchema,
  cache: "private-realtime",
  handler: async ({ user, query }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }

    return { data: buildPayload(query.historyLimit ?? 20) };
  }
});

export const POST = createAdminRoute({
  role: "admin",
  cache: "private-realtime",
  handler: async ({ user, request }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      badRequest("invalid json body");
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      badRequest("body must be an object");
    }

    const input = payload as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action.trim().toLowerCase() : "";
    const reason = typeof input.reason === "string" ? input.reason.trim() : undefined;

    if (action === "rollback") {
      const snapshotId = typeof input.snapshotId === "string" ? input.snapshotId.trim() : "";
      if (!snapshotId) {
        badRequest("snapshotId required");
      }
      const next = rollbackAiQualityCalibration(snapshotId, {
        updatedBy: user.id,
        reason: reason || `rollback:${snapshotId}`
      });
      if (!next) {
        notFound("snapshot not found");
      }

      await addAdminLog({
        adminId: user.id,
        action: "rollback_ai_quality_calibration",
        entityType: "ai_quality_calibration",
        entityId: snapshotId,
        detail: reason ?? null
      });
      return { data: buildPayload(20) };
    }

    const patch: AiQualityCalibrationPatch = {};
    if (typeof input.globalBias === "number" && Number.isFinite(input.globalBias)) {
      patch.globalBias = input.globalBias;
    }
    const providerAdjustments = toNumberMap(input.providerAdjustments);
    if (providerAdjustments) {
      patch.providerAdjustments = providerAdjustments;
    }
    const kindAdjustments = toNumberMap(input.kindAdjustments);
    if (kindAdjustments) {
      patch.kindAdjustments = kindAdjustments as AiQualityCalibrationPatch["kindAdjustments"];
    }
    if (typeof input.enabled === "boolean") {
      patch.enabled = input.enabled;
    }
    if (typeof input.rolloutPercent === "number" && Number.isFinite(input.rolloutPercent)) {
      patch.rolloutPercent = input.rolloutPercent;
    }
    if (typeof input.rolloutSalt === "string" && input.rolloutSalt.trim()) {
      patch.rolloutSalt = input.rolloutSalt.trim();
    }

    if (!Object.keys(patch).length) {
      badRequest("empty calibration patch");
    }

    const next = upsertAiQualityCalibration(patch, {
      updatedBy: user.id,
      reason: reason || "manual_update"
    });

    await addAdminLog({
      adminId: user.id,
      action: "update_ai_quality_calibration",
      entityType: "ai_quality_calibration",
      entityId: "runtime",
      detail: JSON.stringify({
        globalBias: next.globalBias,
        enabled: next.enabled,
        rolloutPercent: next.rolloutPercent
      })
    });

    return { data: buildPayload(20) };
  }
});
