import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
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

export const dynamic = "force-dynamic";

const updateBodySchema = v.object<{
  providerChain?: string[];
  reset?: boolean;
}>(
  {
    providerChain: v.optional(v.array(v.string({ allowEmpty: true, trim: false }))),
    reset: v.optional(v.boolean())
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

export const GET = withApi(async () => {
  const user = await requireRole("admin");
  if (!user) {
    unauthorized();
  }
  return { data: await buildPayload() };
});

export const POST = withApi(async (request) => {
  const user = await requireRole("admin");
  if (!user) {
    unauthorized();
  }

  const body = await parseJson(request, updateBodySchema);
  if (!body.reset && body.providerChain === undefined) {
    badRequest("missing providerChain");
  }

  const next = await saveRuntimeAiProviderConfig({
    providerChain: body.reset ? [] : body.providerChain ?? [],
    updatedBy: user.id
  });

  await addAdminLog({
    adminId: user.id,
    action: "update_ai_provider_chain",
    entityType: "ai_config",
    entityId: "provider_chain",
    detail: next.providerChain.join(",") || "env_fallback"
  });

  return { data: await buildPayload() };
});
