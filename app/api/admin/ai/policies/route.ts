import { addAdminLog } from "@/lib/admin-log";
import {
  getAiTaskPolicies,
  listAiTaskOptions,
  resetAiTaskPolicy,
  saveAiTaskPolicies,
  saveAiTaskPolicy,
  type AiTaskType
} from "@/lib/ai-task-policies";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { requireRole } from "@/lib/guard";

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

function buildPayload() {
  return {
    tasks: listAiTaskOptions(),
    policies: getAiTaskPolicies()
  };
}

export const GET = withApi(async () => {
  const admin = await requireRole("admin");
  if (!admin) {
    unauthorized();
  }
  return { data: buildPayload() };
});

export const POST = withApi(async (request) => {
  const admin = await requireRole("admin");
  if (!admin) {
    unauthorized();
  }

  const body = await parseJson(request, updateBodySchema);

  if (body.reset) {
    const taskType = asTaskType(body.taskType);
    if (body.taskType && !taskType) {
      badRequest("invalid taskType");
    }
    const resetResult = resetAiTaskPolicy(taskType ?? undefined);
    await addAdminLog({
      adminId: admin.id,
      action: "reset_ai_task_policy",
      entityType: "ai_policy",
      entityId: taskType ?? "all",
      detail: Array.isArray(resetResult) ? "reset all ai task policies" : `reset ${taskType}`
    });
    return { data: buildPayload() };
  }

  if (body.policies?.length) {
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

    saveAiTaskPolicies(validPolicies, admin.id);
    await addAdminLog({
      adminId: admin.id,
      action: "batch_update_ai_task_policy",
      entityType: "ai_policy",
      entityId: "batch",
      detail: validPolicies.map((item) => item.taskType).join(",")
    });
    return { data: buildPayload() };
  }

  const taskType = asTaskType(body.taskType);
  if (!taskType) {
    badRequest("taskType required");
  }

  const next = saveAiTaskPolicy({
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

  return { data: buildPayload() };
});
