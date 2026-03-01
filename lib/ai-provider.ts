export type LlmProvider =
  | "mock"
  | "custom"
  | "compatible"
  | "zhipu"
  | "deepseek"
  | "kimi"
  | "minimax"
  | "seedance";

export type LlmCapability = "chat" | "vision";

export type LlmResolvedConfig = {
  provider: Exclude<LlmProvider, "mock" | "custom">;
  baseUrl: string;
  apiKey: string;
  model: string;
  chatPath: string;
};

export type LlmProviderCapabilityHealth = {
  configured: boolean;
  missingEnv: string[];
  model?: string;
  baseUrl?: string;
  chatPath?: string;
};

export type LlmProviderHealth = {
  provider: string;
  chat: LlmProviderCapabilityHealth;
  vision: LlmProviderCapabilityHealth;
};

const PROVIDER_PREFIX: Record<Exclude<LlmProvider, "mock" | "custom" | "compatible">, string> = {
  // Unified env namespace per provider, e.g. DEEPSEEK_API_KEY / KIMI_MODEL.
  zhipu: "ZHIPU",
  deepseek: "DEEPSEEK",
  kimi: "KIMI",
  minimax: "MINIMAX",
  seedance: "SEEDANCE"
};

const PROVIDER_ALIASES: Record<string, LlmProvider> = {
  mock: "mock",
  custom: "custom",
  compatible: "compatible",
  openai_compatible: "compatible",
  zhipu: "zhipu",
  glm: "zhipu",
  bigmodel: "zhipu",
  deepseek: "deepseek",
  kimi: "kimi",
  moonshot: "kimi",
  minimax: "minimax",
  seedance: "seedance",
  seed: "seedance"
};

const PROVIDER_DEFAULTS: Record<
  Exclude<LlmProvider, "mock" | "custom" | "compatible">,
  { baseUrl: string; model: string; visionModel: string; chatPath: string }
> = {
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7",
    visionModel: "glm-4v-plus",
    chatPath: "/chat/completions"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    visionModel: "deepseek-chat",
    chatPath: "/chat/completions"
  },
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    visionModel: "moonshot-v1-8k",
    chatPath: "/chat/completions"
  },
  minimax: {
    baseUrl: "https://api.minimax.chat/v1",
    model: "MiniMax-Text-01",
    visionModel: "MiniMax-Text-01",
    chatPath: "/chat/completions"
  },
  seedance: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "seedance-1.0",
    visionModel: "seedance-1.0",
    chatPath: "/chat/completions"
  }
};

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeProviderToken(value: string): LlmProvider | null {
  const token = value.trim().toLowerCase();
  if (!token) return null;
  return PROVIDER_ALIASES[token] ?? null;
}

export function normalizeProviderChain(values?: string[]) {
  if (!Array.isArray(values)) return [] as LlmProvider[];
  const unique = new Set<LlmProvider>();
  values.forEach((item) => {
    const normalized = normalizeProviderToken(item);
    if (normalized) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
}

function getProviderCapabilityHealth(
  provider: LlmProvider,
  capability: LlmCapability
): LlmProviderCapabilityHealth {
  if (provider === "mock") {
    return {
      configured: true,
      missingEnv: [],
      model: "mock",
      baseUrl: "",
      chatPath: ""
    };
  }

  if (provider === "custom") {
    const endpoint = firstNonEmpty(process.env.LLM_ENDPOINT);
    const configured = Boolean(endpoint);
    return {
      configured,
      missingEnv: configured ? [] : ["LLM_ENDPOINT"],
      model: "custom",
      baseUrl: endpoint,
      chatPath: ""
    };
  }

  if (provider === "compatible") {
    const baseUrl = firstNonEmpty(process.env.LLM_BASE_URL);
    const apiKey = firstNonEmpty(process.env.LLM_API_KEY);
    const model = firstNonEmpty(
      capability === "vision" ? process.env.LLM_VISION_MODEL : "",
      process.env.LLM_MODEL
    );
    const chatPath = firstNonEmpty(process.env.LLM_CHAT_PATH, "/chat/completions");
    const missingEnv: string[] = [];
    if (!baseUrl) missingEnv.push("LLM_BASE_URL");
    if (!apiKey) missingEnv.push("LLM_API_KEY");
    if (!model) {
      missingEnv.push(capability === "vision" ? "LLM_VISION_MODEL/LLM_MODEL" : "LLM_MODEL");
    }
    return {
      configured: missingEnv.length === 0,
      missingEnv,
      model,
      baseUrl,
      chatPath
    };
  }

  const prefix = PROVIDER_PREFIX[provider];
  const defaults = PROVIDER_DEFAULTS[provider];
  const baseUrl = firstNonEmpty(
    process.env[`${prefix}_BASE_URL`],
    provider === "zhipu" ? process.env.LLM_BASE_URL : "",
    defaults.baseUrl
  );
  const apiKey = firstNonEmpty(
    process.env[`${prefix}_API_KEY`],
    provider === "zhipu" ? process.env.LLM_API_KEY : ""
  );
  const model = firstNonEmpty(
    capability === "vision" ? process.env[`${prefix}_VISION_MODEL`] : "",
    process.env[`${prefix}_MODEL`],
    provider === "zhipu"
      ? capability === "vision"
        ? process.env.LLM_VISION_MODEL
        : process.env.LLM_MODEL
      : "",
    capability === "vision" ? defaults.visionModel : defaults.model
  );
  const chatPath = firstNonEmpty(
    process.env[`${prefix}_CHAT_PATH`],
    provider === "zhipu" ? process.env.LLM_CHAT_PATH : "",
    defaults.chatPath
  );
  const missingEnv: string[] = [];
  if (!apiKey) {
    missingEnv.push(provider === "zhipu" ? "ZHIPU_API_KEY/LLM_API_KEY" : `${prefix}_API_KEY`);
  }
  if (!baseUrl) {
    missingEnv.push(provider === "zhipu" ? "ZHIPU_BASE_URL/LLM_BASE_URL" : `${prefix}_BASE_URL`);
  }
  if (!model) {
    if (provider === "zhipu") {
      missingEnv.push(capability === "vision" ? "ZHIPU_VISION_MODEL/LLM_VISION_MODEL" : "ZHIPU_MODEL/LLM_MODEL");
    } else {
      missingEnv.push(capability === "vision" ? `${prefix}_VISION_MODEL/${prefix}_MODEL` : `${prefix}_MODEL`);
    }
  }
  return {
    configured: missingEnv.length === 0,
    missingEnv,
    model,
    baseUrl,
    chatPath
  };
}

export function getLlmProviderHealth(input: { providers?: string[] } = {}) {
  const normalized = normalizeProviderChain(input.providers);
  const providers = normalized.length
    // Health endpoint checks all known providers when no explicit chain is passed in.
    ? normalized
    : (["zhipu", "deepseek", "kimi", "minimax", "seedance", "compatible", "custom", "mock"] as LlmProvider[]);

  return providers.map((provider) => ({
    provider,
    chat: getProviderCapabilityHealth(provider, "chat"),
    vision: getProviderCapabilityHealth(provider, "vision")
  })) as LlmProviderHealth[];
}

export function getProviderConfig(
  provider: Exclude<LlmProvider, "mock" | "custom">,
  capability: LlmCapability
) {
  if (provider === "compatible") {
    const baseUrl = firstNonEmpty(process.env.LLM_BASE_URL);
    const apiKey = firstNonEmpty(process.env.LLM_API_KEY);
    const model = firstNonEmpty(
      capability === "vision" ? process.env.LLM_VISION_MODEL : "",
      process.env.LLM_MODEL
    );
    const chatPath = firstNonEmpty(process.env.LLM_CHAT_PATH, "/chat/completions");
    if (!baseUrl || !apiKey || !model) return null;
    return {
      provider,
      baseUrl,
      apiKey,
      model,
      chatPath
    } as LlmResolvedConfig;
  }

  const prefix = PROVIDER_PREFIX[provider];
  const defaults = PROVIDER_DEFAULTS[provider];
  const baseUrl = firstNonEmpty(
    process.env[`${prefix}_BASE_URL`],
    // Keep legacy zhipu deployments working via generic LLM_* fallback.
    provider === "zhipu" ? process.env.LLM_BASE_URL : "",
    defaults.baseUrl
  );
  const apiKey = firstNonEmpty(
    process.env[`${prefix}_API_KEY`],
    // Keep legacy zhipu deployments working via generic LLM_* fallback.
    provider === "zhipu" ? process.env.LLM_API_KEY : ""
  );
  const model = firstNonEmpty(
    capability === "vision" ? process.env[`${prefix}_VISION_MODEL`] : "",
    process.env[`${prefix}_MODEL`],
    provider === "zhipu"
      ? capability === "vision"
        ? process.env.LLM_VISION_MODEL
        : process.env.LLM_MODEL
      : "",
    capability === "vision" ? defaults.visionModel : defaults.model
  );
  const chatPath = firstNonEmpty(
    process.env[`${prefix}_CHAT_PATH`],
    provider === "zhipu" ? process.env.LLM_CHAT_PATH : "",
    defaults.chatPath
  );

  if (!baseUrl || !apiKey || !model) return null;
  return {
    provider,
    baseUrl,
    apiKey,
    model,
    chatPath
  } as LlmResolvedConfig;
}
