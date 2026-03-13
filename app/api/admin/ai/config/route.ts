import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { buildAdminAuditDetail, diffAuditFields } from "@/lib/admin-audit";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { getLlmProviderHealth } from "@/lib/ai";
import {
  getEffectiveAiProviderChain,
  getEnvAiProviderChain,
  getRuntimeAiProviderConfig,
  listAiProviderOptions,
  refreshRuntimeAiProviderConfig,
  saveRuntimeAiProviderConfig
} from "@/lib/ai-config";
import { createAdminRoute } from "@/lib/api/domains";

export const dynamic = "force-dynamic";

const updateBodySchema = v.object<{
  providerChain?: string[];
  reset?: boolean;
  confirmAction?: boolean;
}>(
  {
    providerChain: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    reset: v.optional(v.boolean()),
    confirmAction: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

async function buildPayload() {
  await refreshRuntimeAiProviderConfig();
  const runtime = getRuntimeAiProviderConfig();
  const availableProviders = listAiProviderOptions();
  return {
    availableProviders,
    runtimeProviderChain: runtime.providerChain,
    envProviderChain: getEnvAiProviderChain(),
    effectiveProviderChain: getEffectiveAiProviderChain(),
    providerHealth: getLlmProviderHealth({
      providers: availableProviders.map((item) => item.key)
    }),
    updatedAt: runtime.updatedAt,
    updatedBy: runtime.updatedBy
  };
}

export const GET = createAdminRoute({
  cache: "private-realtime",
  handler: async () => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    return { data: await buildPayload() };
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

    const body = await parseJson(request, updateBodySchema);
    if (!body.reset && body.providerChain === undefined) {
      badRequest("missing providerChain");
    }
    if (body.reset && !body.confirmAction) {
      badRequest("confirmAction required");
    }

    await refreshRuntimeAiProviderConfig();
    const previousRuntime = getRuntimeAiProviderConfig();

    const next = await saveRuntimeAiProviderConfig({
      providerChain: body.reset ? [] : body.providerChain ?? [],
      updatedBy: user.id
    });

    const beforeSnapshot = {
      runtimeProviderChain: previousRuntime.providerChain
    };
    const afterSnapshot = {
      runtimeProviderChain: next.providerChain
    };

    await addAdminLog({
      adminId: user.id,
      action: "update_ai_provider_chain",
      entityType: "ai_config",
      entityId: "provider_chain",
      detail: buildAdminAuditDetail({
        summary: body.reset ? "切回环境变量 AI 模型链配置" : "更新 AI 模型链配置",
        changedFields: diffAuditFields(beforeSnapshot, afterSnapshot),
        before: beforeSnapshot,
        after: afterSnapshot,
        meta: {
          mode: body.reset ? "reset_to_env" : "runtime_override",
          effectiveProviderChain: body.reset ? getEnvAiProviderChain() : next.providerChain,
          confirmAction: body.reset ? true : undefined
        }
      })
    });

    return { data: await buildPayload() };
  }
});
