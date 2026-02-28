import { createAdminRoute } from "@/lib/api/domains";
import { badRequest, unauthorized } from "@/lib/api/http";
import {
  getAiQualityCalibration,
  upsertAiQualityCalibration,
  type AiQualityCalibrationPatch
} from "@/lib/ai-quality-calibration";

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

export const GET = createAdminRoute({
  role: "admin",
  cache: "private-realtime",
  handler: async ({ user }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }

    return { data: getAiQualityCalibration() };
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

    if (!Object.keys(patch).length) {
      badRequest("empty calibration patch");
    }

    return { data: upsertAiQualityCalibration(patch) };
  }
});

