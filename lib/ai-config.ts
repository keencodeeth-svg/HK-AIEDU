import { isDbEnabled, query, queryOne } from "./db";
import { shouldAllowDbBootstrapFromJsonFallback } from "./runtime-guardrails";
import { readJson, writeJson } from "./storage";

export type AiProviderKey =
  | "mock"
  | "custom"
  | "compatible"
  | "zhipu"
  | "deepseek"
  | "kimi"
  | "minimax"
  | "seedance";

type AiProviderConfigRecord = {
  providerChain?: string[];
  updatedAt?: string;
  updatedBy?: string;
};

type DbProviderRuntimeConfigRow = {
  id: string;
  provider_chain: string[];
  updated_at: string;
  updated_by: string | null;
};

export type AiProviderRuntimeConfig = {
  providerChain: AiProviderKey[];
  updatedAt?: string;
  updatedBy?: string;
};

export type AiProviderOption = {
  key: AiProviderKey;
  label: string;
  description: string;
};

const AI_PROVIDER_CONFIG_FILE = "ai-provider-config.json";
const AI_PROVIDER_RUNTIME_CONFIG_ROW_ID = "runtime";
const AI_PROVIDER_RUNTIME_CACHE_TTL_MS = 8000;

const PROVIDER_ALIAS: Record<string, AiProviderKey> = {
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

const PROVIDER_OPTIONS: AiProviderOption[] = [
  {
    key: "zhipu",
    label: "智谱",
    description: "GLM 系列模型，支持中文教育场景。"
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    description: "通用推理与代码能力较强。"
  },
  {
    key: "kimi",
    label: "Kimi",
    description: "Moonshot 模型，长文本能力较好。"
  },
  {
    key: "minimax",
    label: "MiniMax",
    description: "通用对话模型，可作为备份链路。"
  },
  {
    key: "seedance",
    label: "Seedance",
    description: "火山方舟链路，可用于多模型备援。"
  },
  {
    key: "compatible",
    label: "兼容接口",
    description: "OpenAI 协议兼容服务。"
  },
  {
    key: "custom",
    label: "自定义接口",
    description: "你的内部 Prompt 接口。"
  },
  {
    key: "mock",
    label: "Mock",
    description: "本地回退，不调用外部模型。"
  }
];

let runtimeConfigCache: AiProviderRuntimeConfig =
  isDbEnabled() && !shouldAllowDbBootstrapFromJsonFallback() ? { providerChain: [] } : readRuntimeConfigFromFile();
let runtimeConfigCacheSyncedAt = 0;
let runtimeConfigSyncing: Promise<void> | null = null;

function normalizeProviderToken(value: string) {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return PROVIDER_ALIAS[key] ?? null;
}

function normalizeProviderChain(values: string[] | undefined) {
  if (!Array.isArray(values)) return [] as AiProviderKey[];
  const deduped = new Set<AiProviderKey>();
  values.forEach((value) => {
    const normalized = normalizeProviderToken(String(value));
    if (normalized) {
      deduped.add(normalized);
    }
  });
  return Array.from(deduped);
}

function parseProviderChain(raw: string | undefined) {
  if (!raw?.trim()) return [] as AiProviderKey[];
  return normalizeProviderChain(raw.split(/[\s,，|]+/).filter(Boolean));
}

function readRuntimeConfigFromFile(): AiProviderRuntimeConfig {
  const saved = readJson<AiProviderConfigRecord | null>(AI_PROVIDER_CONFIG_FILE, null);
  if (!saved || typeof saved !== "object") {
    return { providerChain: [] };
  }
  return {
    providerChain: normalizeProviderChain(saved.providerChain),
    updatedAt: typeof saved.updatedAt === "string" ? saved.updatedAt : undefined,
    updatedBy: typeof saved.updatedBy === "string" ? saved.updatedBy : undefined
  };
}

function mapDbRuntimeConfigRow(row: DbProviderRuntimeConfigRow | null): AiProviderRuntimeConfig {
  if (!row) {
    return { providerChain: [] };
  }
  return {
    providerChain: normalizeProviderChain(row.provider_chain ?? []),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined
  };
}

async function syncRuntimeConfigFromDb(force = false) {
  if (!isDbEnabled()) return;

  const now = Date.now();
  if (!force && runtimeConfigCacheSyncedAt && now - runtimeConfigCacheSyncedAt < AI_PROVIDER_RUNTIME_CACHE_TTL_MS) {
    return;
  }
  if (runtimeConfigSyncing) {
    return runtimeConfigSyncing;
  }

  runtimeConfigSyncing = (async () => {
    try {
      const row = await queryOne<DbProviderRuntimeConfigRow>(
        "SELECT id, provider_chain, updated_at, updated_by FROM ai_provider_runtime_config WHERE id = $1",
        [AI_PROVIDER_RUNTIME_CONFIG_ROW_ID]
      );
      if (!row) {
        const fallback = shouldAllowDbBootstrapFromJsonFallback()
          ? readRuntimeConfigFromFile()
          : { providerChain: [] as AiProviderKey[] };
        if (fallback.providerChain.length) {
          const updatedAt = fallback.updatedAt ?? new Date().toISOString();
          await query(
            `INSERT INTO ai_provider_runtime_config (id, provider_chain, updated_at, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO NOTHING`,
            [AI_PROVIDER_RUNTIME_CONFIG_ROW_ID, fallback.providerChain, updatedAt, fallback.updatedBy ?? null]
          );
          runtimeConfigCache = {
            providerChain: fallback.providerChain,
            updatedAt,
            updatedBy: fallback.updatedBy
          };
        } else {
          runtimeConfigCache = { providerChain: [] };
        }
      } else {
        runtimeConfigCache = mapDbRuntimeConfigRow(row);
      }
      runtimeConfigCacheSyncedAt = Date.now();
    } catch {
      // ignore db read failures; runtime cache keeps last available snapshot
    } finally {
      runtimeConfigSyncing = null;
    }
  })();

  return runtimeConfigSyncing;
}

export async function refreshRuntimeAiProviderConfig() {
  await syncRuntimeConfigFromDb(true);
  return getRuntimeAiProviderConfig();
}

export function listAiProviderOptions() {
  return PROVIDER_OPTIONS;
}

export function getRuntimeAiProviderConfig(): AiProviderRuntimeConfig {
  if (isDbEnabled()) {
    void syncRuntimeConfigFromDb();
  }
  return runtimeConfigCache;
}

export function getEnvAiProviderChain() {
  const fromChain = parseProviderChain(process.env.LLM_PROVIDER_CHAIN);
  if (fromChain.length) return fromChain;
  const fromProvider = parseProviderChain(process.env.LLM_PROVIDER);
  if (fromProvider.length) return fromProvider;
  return ["mock"] as AiProviderKey[];
}

export function getEffectiveAiProviderChain() {
  const runtime = getRuntimeAiProviderConfig();
  if (runtime.providerChain.length) {
    return runtime.providerChain;
  }
  return getEnvAiProviderChain();
}

export async function saveRuntimeAiProviderConfig(input: {
  providerChain?: string[];
  updatedBy?: string;
}) {
  const providerChain = normalizeProviderChain(input.providerChain);
  const next: AiProviderRuntimeConfig = {
    providerChain,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy?.trim() || undefined
  };

  runtimeConfigCache = next;
  runtimeConfigCacheSyncedAt = Date.now();

  if (!isDbEnabled()) {
    writeJson(AI_PROVIDER_CONFIG_FILE, {
      providerChain: next.providerChain,
      updatedAt: next.updatedAt,
      updatedBy: next.updatedBy
    } satisfies AiProviderConfigRecord);
    return next;
  }

  await query(
    `INSERT INTO ai_provider_runtime_config (id, provider_chain, updated_at, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET provider_chain = EXCLUDED.provider_chain,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
    [
      AI_PROVIDER_RUNTIME_CONFIG_ROW_ID,
      next.providerChain,
      next.updatedAt ?? new Date().toISOString(),
      next.updatedBy ?? null
    ]
  );

  return next;
}
