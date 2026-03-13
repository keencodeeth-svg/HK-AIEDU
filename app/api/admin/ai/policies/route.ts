import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import {
  getAiTaskPolicies,
  listAiTaskOptions,
  refreshAiTaskPolicies,
  resetAiTaskPolicy,
  saveAiTaskPolicies,
  saveAiTaskPolicy,
  type AiTaskType
} from "@/lib/ai-task-policies";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { requireRole } from "@/lib/guard";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const TASK_TYPES = new Set(listAiTaskOptions().map((item) => item.taskType));

function asTaskType(value: string | undefined): AiTaskType | null {
  if (!value) return null;
  const token = value.trim();
  if (!token || !TASK_TYPES.has(token as AiTaskType)) {
    return null;
  }
  return token as AiTaskType;
}

const itemSchema = v.object<{
  taskType?: string;
  providerChain?: string[];
  timeoutMs?: number;
  maxRetries?: number;
  budgetLimit?: number;
  minQualityScore?: number;
}>(
  {
    taskType: v.optional(v.string({ minLength: 1 })),
    providerChain: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    timeoutMs: v.optional(v.number({ coerce: true, integer: true, min: 500, max: 30000 })),
    maxRetries: v.optional(v.number({ coerce: true, integer: true, min: 0, max: 5 })),
    budgetLimit: v.optional(v.number({ coerce: true, integer: true, min: 100, max: 100000 })),
    minQualityScore: v.optional(v.number({ coerce: true, integer: true, min: 0, max: 100 }))
  },
  { allowUnknown: false }
);

const updateBodySchema = v.object<{
  taskType?: string;
  providerChain?: string[];
  timeoutMs?: number;
  maxRetries?: number;
  budgetLimit?: number;
  minQualityScore?: number;
  policies?: Array<{
    taskType?: string;
    providerChain?: string[];
    timeoutMs?: number;
    maxRetries?: number;
    budgetLimit?: number;
    minQualityScore?: number;
  }>;
  reset?: boolean;
}>(
  {
    taskType: v.optional(v.string({ minLength: 1 })),
    providerChain: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    timeoutMs: v.optional(v.number({ coerce: true, integer: true, min: 500, max: 30000 })),
    maxRetries: v.optional(v.number({ coerce: true, integer: true, min: 0, max: 5 })),
    budgetLimit: v.optional(v.number({ coerce: true, integer: true, min: 100, max: 100000 })),
    minQualityScore: v.optional(v.number({ coerce: true, integer: true, min: 0, max: 100 })),
    policies: v.optional(v.array(itemSchema, { minLength: 1, maxLength: 50 })),
    reset: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

async function buildPayload() {
  // Force refresh so admin panel always reads latest policy (DB/file) snapshot.
  await refreshAiTaskPolicies();
  return {
    tasks: listAiTaskOptions(),
    policies: getAiTaskPolicies()
  };
}

export const GET = createAdminRoute({
  cache: "private-realtime",
  handler: async () => {
    const admin = await requireRole("admin");
    if (!admin) {
      unauthorized();
    }
    return { data: await buildPayload() };
  }
});

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const admin = await requireRole("admin");
    if (!admin) {
      unauthorized();
    }
    assertAdminStepUp(admin);

    const body = await parseJson(request, updateBodySchema);

    if (body.reset) {
      // Reset supports per-task or full reset depending on taskType presence.
      const taskType = asTaskType(body.taskType);
      if (body.taskType && !taskType) {
        badRequest("invalid taskType");
      }
      const resetResult = await resetAiTaskPolicy(taskType ?? undefined);
      await addAdminLog({
        adminId: admin.id,
        action: "reset_ai_task_policy",
        entityType: "ai_policy",
        entityId: taskType ?? "all",
        detail: Array.isArray(resetResult) ? "reset all ai task policies" : `reset ${taskType}`
      });
      return { data: await buildPayload() };
    }

    if (body.policies?.length) {
      // Batch update reduces panel round-trips and keeps policy changes atomic at UI level.
      const validPolicies = body.policies.map((item, index) => {
        const taskType = asTaskType(item.taskType);
        if (!taskType) {
          badRequest(`policies[${index}].taskType invalid`);
        }
        return {
          taskType,
          providerChain: item.providerChain,
          timeoutMs: item.timeoutMs,
          maxRetries: item.maxRetries,
          budgetLimit: item.budgetLimit,
          minQualityScore: item.minQualityScore
        };
      });

      await saveAiTaskPolicies(validPolicies, admin.id);
      await addAdminLog({
        adminId: admin.id,
        action: "batch_update_ai_task_policy",
        entityType: "ai_policy",
        entityId: "batch",
        detail: validPolicies.map((item) => item.taskType).join(",")
      });
      return { data: await buildPayload() };
    }

    const taskType = asTaskType(body.taskType);
    if (!taskType) {
      badRequest("taskType required");
    }

    const next = await saveAiTaskPolicy({
      taskType,
      providerChain: body.providerChain,
      timeoutMs: body.timeoutMs,
      maxRetries: body.maxRetries,
      budgetLimit: body.budgetLimit,
      minQualityScore: body.minQualityScore,
      updatedBy: admin.id
    });

    await addAdminLog({
      adminId: admin.id,
      action: "update_ai_task_policy",
      entityType: "ai_policy",
      entityId: taskType,
      detail: `${taskType}:${next.providerChain.join("->")}`
    });

    return { data: await buildPayload() };
  }
});
