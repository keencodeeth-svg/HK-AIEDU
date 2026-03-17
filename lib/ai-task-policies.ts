import crypto from "crypto";
import { getEffectiveAiProviderChain, type AiProviderKey } from "./ai-config";
import { isDbEnabled, query } from "./db";
import { reportAiCallFailure } from "./error-tracker";
import { getTraceIdFromContext } from "./request-context";
import { shouldAllowDbBootstrapFromJsonFallback } from "./runtime-guardrails";
import { readJson, writeJson } from "./storage";

export type AiTaskType =
  | "assist"
  | "question_generate"
  | "explanation"
  | "variant_generate"
  | "homework_review"
  | "writing_feedback"
  | "kp_extract"
  | "lesson_outline"
  | "wrong_review_script"
  | "learning_report"
  | "question_check"
  | "knowledge_points_generate"
  | "knowledge_tree_generate"
  | "probe";

type AiTaskPolicyRecord = {
  providerChain?: string[];
  timeoutMs?: number;
  maxRetries?: number;
  budgetLimit?: number;
  minQualityScore?: number;
  updatedAt?: string;
  updatedBy?: string;
};

type AiTaskPolicyStore = Partial<Record<AiTaskType, AiTaskPolicyRecord>>;

type DbAiTaskPolicyRow = {
  task_type: string;
  provider_chain: string[] | null;
  timeout_ms: number | null;
  max_retries: number | null;
  budget_limit: number | null;
  min_quality_score: number | null;
  updated_at: string;
  updated_by: string | null;
};

type DbAiCallLogRow = {
  id: string;
  task_type: string;
  provider: string;
  latency_ms: number | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  trace_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type AiTaskPolicy = {
  taskType: AiTaskType;
  label: string;
  description: string;
  providerChain: AiProviderKey[];
  timeoutMs: number;
  maxRetries: number;
  budgetLimit: number;
  minQualityScore: number;
  source: "default" | "runtime";
  updatedAt?: string;
  updatedBy?: string;
};

export type AiCallLog = {
  id: string;
  taskType: AiTaskType;
  provider: string;
  capability: "chat" | "vision";
  ok: boolean;
  latencyMs: number;
  fallbackCount: number;
  timeout: boolean;
  requestChars: number;
  responseChars: number;
  qualityScore?: number;
  policyHit?: "budget_limit" | "quality_threshold";
  policyDetail?: string;
  errorMessage?: string;
  traceId?: string;
  createdAt: string;
};

const AI_TASK_POLICIES_FILE = "ai-task-policies.json";
const AI_CALL_LOGS_FILE = "ai-call-logs.json";
const MAX_CALL_LOGS = 20000;
const POLICY_STORE_CACHE_TTL_MS = 8000;

const TASK_OPTIONS: Array<{
  taskType: AiTaskType;
  label: string;
  description: string;
}> = [
  { taskType: "assist", label: "AI辅导", description: "学生问答与学习陪练。" },
  { taskType: "question_generate", label: "出题生成", description: "生成单题草稿。" },
  { taskType: "explanation", label: "讲解生成", description: "解析、讲解、类比说明。" },
  { taskType: "variant_generate", label: "变式训练", description: "错题变式与同类题生成。" },
  { taskType: "homework_review", label: "作业批改", description: "作业/图像批改与评语。" },
  { taskType: "writing_feedback", label: "作文批改", description: "写作结构语法词汇反馈。" },
  { taskType: "kp_extract", label: "知识点提取", description: "从教材或文本抽取知识点。" },
  { taskType: "lesson_outline", label: "教案课件", description: "课堂提纲、讲稿、课件结构。" },
  { taskType: "wrong_review_script", label: "错题讲评", description: "班级错题讲评脚本生成。" },
  { taskType: "learning_report", label: "学情报告", description: "学习报告与亮点提醒。" },
  { taskType: "question_check", label: "题目质检", description: "题目歧义、风险与建议检查。" },
  { taskType: "knowledge_points_generate", label: "知识点生成", description: "章节知识点草稿生成。" },
  { taskType: "knowledge_tree_generate", label: "知识树生成", description: "单元-章节-知识点树生成。" },
  { taskType: "probe", label: "模型探测", description: "模型链连通性探测。" }
];

const TASK_TYPE_SET = new Set<AiTaskType>(TASK_OPTIONS.map((item) => item.taskType));

const TASK_DEFAULTS: Record<
  AiTaskType,
  {
    timeoutMs: number;
    maxRetries: number;
    budgetLimit: number;
    minQualityScore: number;
  }
> = {
  assist: { timeoutMs: 8000, maxRetries: 1, budgetLimit: 1800, minQualityScore: 65 },
  question_generate: { timeoutMs: 9000, maxRetries: 1, budgetLimit: 2200, minQualityScore: 70 },
  explanation: { timeoutMs: 9000, maxRetries: 1, budgetLimit: 2200, minQualityScore: 70 },
  variant_generate: { timeoutMs: 10000, maxRetries: 1, budgetLimit: 2600, minQualityScore: 70 },
  homework_review: { timeoutMs: 12000, maxRetries: 1, budgetLimit: 3200, minQualityScore: 70 },
  writing_feedback: { timeoutMs: 10000, maxRetries: 1, budgetLimit: 2600, minQualityScore: 70 },
  kp_extract: { timeoutMs: 7000, maxRetries: 1, budgetLimit: 1400, minQualityScore: 65 },
  lesson_outline: { timeoutMs: 12000, maxRetries: 1, budgetLimit: 3200, minQualityScore: 70 },
  wrong_review_script: { timeoutMs: 10000, maxRetries: 1, budgetLimit: 2600, minQualityScore: 70 },
  learning_report: { timeoutMs: 10000, maxRetries: 1, budgetLimit: 2600, minQualityScore: 70 },
  question_check: { timeoutMs: 8000, maxRetries: 1, budgetLimit: 1800, minQualityScore: 70 },
  knowledge_points_generate: { timeoutMs: 9000, maxRetries: 1, budgetLimit: 2200, minQualityScore: 70 },
  knowledge_tree_generate: { timeoutMs: 12000, maxRetries: 1, budgetLimit: 3200, minQualityScore: 70 },
  probe: { timeoutMs: 6000, maxRetries: 0, budgetLimit: 600, minQualityScore: 0 }
};

const PROVIDER_ALIASES: Record<string, AiProviderKey> = {
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

let policyStoreCache: AiTaskPolicyStore =
  isDbEnabled() && !shouldAllowDbBootstrapFromJsonFallback() ? ({} as AiTaskPolicyStore) : readPolicyStoreFromFile();
let policyStoreCacheSyncedAt = 0;
let policyStoreSyncing: Promise<void> | null = null;

function clampInt(value: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(n)));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function computeP95(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return round(sorted[index] ?? 0);
}

function normalizeProviderChain(values?: string[]) {
  if (!Array.isArray(values)) return [] as AiProviderKey[];
  const unique = new Set<AiProviderKey>();
  values.forEach((item) => {
    const token = String(item ?? "")
      .trim()
      .toLowerCase();
    if (!token) return;
    const provider = PROVIDER_ALIASES[token];
    if (provider) {
      unique.add(provider);
    }
  });
  return Array.from(unique);
}

function findTaskOption(taskType: AiTaskType) {
  return TASK_OPTIONS.find((item) => item.taskType === taskType) ?? TASK_OPTIONS[0];
}

function normalizeTaskTypeToken(value: string | null | undefined): AiTaskType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!TASK_TYPE_SET.has(normalized as AiTaskType)) {
    return null;
  }
  return normalized as AiTaskType;
}

function isKnownTaskType(value: string): value is AiTaskType {
  return normalizeTaskTypeToken(value) !== null;
}

function normalizePolicyRecord(taskType: AiTaskType, record?: AiTaskPolicyRecord | null): AiTaskPolicyRecord {
  return {
    providerChain: record?.providerChain === undefined ? undefined : normalizeProviderChain(record.providerChain),
    timeoutMs: record?.timeoutMs === undefined ? undefined : clampInt(record.timeoutMs, 500, 30000),
    maxRetries: record?.maxRetries === undefined ? undefined : clampInt(record.maxRetries, 0, 5),
    budgetLimit: record?.budgetLimit === undefined ? undefined : clampInt(record.budgetLimit, 100, 100000),
    minQualityScore: record?.minQualityScore === undefined ? undefined : clampInt(record.minQualityScore, 0, 100),
    updatedAt: typeof record?.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : undefined,
    updatedBy: typeof record?.updatedBy === "string" && record.updatedBy.trim() ? record.updatedBy.trim() : undefined
  };
}

function readPolicyStoreFromFile() {
  const saved = readJson<AiTaskPolicyStore | null>(AI_TASK_POLICIES_FILE, null);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return {} as AiTaskPolicyStore;
  }

  const normalizedStore: AiTaskPolicyStore = {};
  Object.entries(saved).forEach(([taskTypeToken, record]) => {
    const taskType = normalizeTaskTypeToken(taskTypeToken);
    if (!taskType || !record || typeof record !== "object" || Array.isArray(record)) {
      return;
    }
    normalizedStore[taskType] = normalizePolicyRecord(taskType, record as AiTaskPolicyRecord);
  });
  return normalizedStore;
}

function persistPolicyStoreToFile(store: AiTaskPolicyStore) {
  writeJson(AI_TASK_POLICIES_FILE, store);
}

function toPolicy(taskType: AiTaskType, record?: AiTaskPolicyRecord): AiTaskPolicy {
  const defaults = TASK_DEFAULTS[taskType];
  const option = findTaskOption(taskType);
  const runtimeChain = normalizeProviderChain(record?.providerChain);
  const providerChain = runtimeChain.length ? runtimeChain : getEffectiveAiProviderChain();
  return {
    taskType,
    label: option.label,
    description: option.description,
    providerChain,
    timeoutMs: clampInt(record?.timeoutMs ?? defaults.timeoutMs, 500, 30000),
    maxRetries: clampInt(record?.maxRetries ?? defaults.maxRetries, 0, 5),
    budgetLimit: clampInt(record?.budgetLimit ?? defaults.budgetLimit, 100, 100000),
    minQualityScore: clampInt(record?.minQualityScore ?? defaults.minQualityScore, 0, 100),
    source: record ? "runtime" : "default",
    updatedAt: record?.updatedAt,
    updatedBy: record?.updatedBy
  };
}

async function syncPolicyStoreFromDb(force = false) {
  if (!isDbEnabled()) return;

  const now = Date.now();
  if (!force && policyStoreCacheSyncedAt && now - policyStoreCacheSyncedAt < POLICY_STORE_CACHE_TTL_MS) {
    // Short TTL avoids per-request DB hits while keeping policy edits near-real-time.
    return;
  }
  if (policyStoreSyncing) {
    return policyStoreSyncing;
  }

  policyStoreSyncing = (async () => {
    try {
      const rows = await query<DbAiTaskPolicyRow>(
        `SELECT task_type, provider_chain, timeout_ms, max_retries, budget_limit, min_quality_score, updated_at, updated_by
         FROM ai_task_policies`
      );
      const nextStore: AiTaskPolicyStore = {};
      if (!rows.length) {
        // First DB boot can migrate file-based policy history, unless guarded runtime explicitly disables fallback.
        const fileStore = shouldAllowDbBootstrapFromJsonFallback()
          ? readPolicyStoreFromFile()
          : ({} as AiTaskPolicyStore);
        const entries = Object.entries(fileStore) as Array<[AiTaskType, AiTaskPolicyRecord]>;
        await Promise.all(
          entries.map(async ([taskTypeToken, record]) => {
            const taskType = normalizeTaskTypeToken(taskTypeToken);
            if (!taskType) return;
            const normalized: AiTaskPolicyRecord = {
              ...normalizePolicyRecord(taskType, record),
              updatedAt: record.updatedAt ?? new Date().toISOString()
            };
            nextStore[taskType] = normalized;
            await query(
              `INSERT INTO ai_task_policies
                (task_type, provider_chain, timeout_ms, max_retries, budget_limit, min_quality_score, updated_at, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (task_type) DO NOTHING`,
              [
                taskType,
                normalized.providerChain ?? [],
                normalized.timeoutMs ?? TASK_DEFAULTS[taskType].timeoutMs,
                normalized.maxRetries ?? TASK_DEFAULTS[taskType].maxRetries,
                normalized.budgetLimit ?? TASK_DEFAULTS[taskType].budgetLimit,
                normalized.minQualityScore ?? TASK_DEFAULTS[taskType].minQualityScore,
                normalized.updatedAt ?? new Date().toISOString(),
                normalized.updatedBy ?? null
              ]
            );
          })
        );
      } else {
        rows.forEach((row) => {
          const taskType = normalizeTaskTypeToken(row.task_type);
          if (!taskType) {
            return;
          }
          nextStore[taskType] = {
            ...normalizePolicyRecord(taskType, {
              providerChain: row.provider_chain ?? undefined,
              timeoutMs: row.timeout_ms ?? undefined,
              maxRetries: row.max_retries ?? undefined,
              budgetLimit: row.budget_limit ?? undefined,
              minQualityScore: row.min_quality_score ?? undefined,
              updatedBy: row.updated_by ?? undefined
            }),
            updatedAt: row.updated_at,
          };
        });
      }
      policyStoreCache = nextStore;
      policyStoreCacheSyncedAt = Date.now();
    } catch {
      // ignore db read failures; keep in-memory cache
    } finally {
      policyStoreSyncing = null;
    }
  })();

  return policyStoreSyncing;
}

function getCachedPolicyStore() {
  if (isDbEnabled()) {
    void syncPolicyStoreFromDb();
  }
  return policyStoreCache;
}

export async function refreshAiTaskPolicies() {
  await syncPolicyStoreFromDb(true);
  return getAiTaskPolicies();
}

export function listAiTaskOptions() {
  return TASK_OPTIONS.map((item) => ({ ...item }));
}

export function getAiTaskPolicy(taskType: AiTaskType) {
  const store = getCachedPolicyStore();
  return toPolicy(taskType, store[taskType]);
}

export function getAiTaskPolicies() {
  const store = getCachedPolicyStore();
  return TASK_OPTIONS.map((item) => toPolicy(item.taskType, store[item.taskType]));
}

export async function saveAiTaskPolicy(input: {
  taskType: AiTaskType;
  providerChain?: string[];
  timeoutMs?: number;
  maxRetries?: number;
  budgetLimit?: number;
  minQualityScore?: number;
  updatedBy?: string;
}) {
  const taskType = normalizeTaskTypeToken(input.taskType) ?? "assist";
  const previous = policyStoreCache[taskType] ?? {};
  const defaults = TASK_DEFAULTS[taskType];
  const next: AiTaskPolicyRecord = {
    providerChain:
      input.providerChain !== undefined ? normalizeProviderChain(input.providerChain) : previous.providerChain,
    timeoutMs: clampInt(input.timeoutMs ?? previous.timeoutMs ?? defaults.timeoutMs, 500, 30000),
    maxRetries: clampInt(input.maxRetries ?? previous.maxRetries ?? defaults.maxRetries, 0, 5),
    budgetLimit: clampInt(input.budgetLimit ?? previous.budgetLimit ?? defaults.budgetLimit, 100, 100000),
    minQualityScore: clampInt(
      input.minQualityScore ?? previous.minQualityScore ?? defaults.minQualityScore,
      0,
      100
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy?.trim() || undefined
  };

  policyStoreCache[taskType] = next;
  policyStoreCacheSyncedAt = Date.now();

  if (!isDbEnabled()) {
    persistPolicyStoreToFile(policyStoreCache);
    return toPolicy(taskType, next);
  }

  await query(
    `INSERT INTO ai_task_policies
      (task_type, provider_chain, timeout_ms, max_retries, budget_limit, min_quality_score, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (task_type) DO UPDATE
     SET provider_chain = EXCLUDED.provider_chain,
         timeout_ms = EXCLUDED.timeout_ms,
         max_retries = EXCLUDED.max_retries,
         budget_limit = EXCLUDED.budget_limit,
         min_quality_score = EXCLUDED.min_quality_score,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
    [
      taskType,
      next.providerChain ?? [],
      next.timeoutMs ?? TASK_DEFAULTS[taskType].timeoutMs,
      next.maxRetries ?? TASK_DEFAULTS[taskType].maxRetries,
      next.budgetLimit ?? TASK_DEFAULTS[taskType].budgetLimit,
      next.minQualityScore ?? TASK_DEFAULTS[taskType].minQualityScore,
      next.updatedAt ?? new Date().toISOString(),
      next.updatedBy ?? null
    ]
  );

  return toPolicy(taskType, next);
}

export async function saveAiTaskPolicies(
  items: Array<{
    taskType: AiTaskType;
    providerChain?: string[];
    timeoutMs?: number;
    maxRetries?: number;
    budgetLimit?: number;
    minQualityScore?: number;
  }>,
  updatedBy?: string
) {
  const now = new Date().toISOString();

  const normalizedItems = items.map((item) => ({
    ...item,
    taskType: normalizeTaskTypeToken(item.taskType) ?? "assist"
  }));

  normalizedItems.forEach((item) => {
    const previous = policyStoreCache[item.taskType] ?? {};
    const defaults = TASK_DEFAULTS[item.taskType];
    policyStoreCache[item.taskType] = {
      providerChain: item.providerChain !== undefined ? normalizeProviderChain(item.providerChain) : previous.providerChain,
      timeoutMs: clampInt(item.timeoutMs ?? previous.timeoutMs ?? defaults.timeoutMs, 500, 30000),
      maxRetries: clampInt(item.maxRetries ?? previous.maxRetries ?? defaults.maxRetries, 0, 5),
      budgetLimit: clampInt(item.budgetLimit ?? previous.budgetLimit ?? defaults.budgetLimit, 100, 100000),
      minQualityScore: clampInt(item.minQualityScore ?? previous.minQualityScore ?? defaults.minQualityScore, 0, 100),
      updatedAt: now,
      updatedBy: updatedBy?.trim() || undefined
    };
  });

  policyStoreCacheSyncedAt = Date.now();

  if (!isDbEnabled()) {
    persistPolicyStoreToFile(policyStoreCache);
    return getAiTaskPolicies();
  }

  await Promise.all(
    normalizedItems.map(async (item) => {
      const record = policyStoreCache[item.taskType] ?? {};
      await query(
        `INSERT INTO ai_task_policies
          (task_type, provider_chain, timeout_ms, max_retries, budget_limit, min_quality_score, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (task_type) DO UPDATE
         SET provider_chain = EXCLUDED.provider_chain,
             timeout_ms = EXCLUDED.timeout_ms,
             max_retries = EXCLUDED.max_retries,
             budget_limit = EXCLUDED.budget_limit,
             min_quality_score = EXCLUDED.min_quality_score,
             updated_at = EXCLUDED.updated_at,
             updated_by = EXCLUDED.updated_by`,
        [
          item.taskType,
          record.providerChain ?? [],
          record.timeoutMs ?? TASK_DEFAULTS[item.taskType].timeoutMs,
          record.maxRetries ?? TASK_DEFAULTS[item.taskType].maxRetries,
          record.budgetLimit ?? TASK_DEFAULTS[item.taskType].budgetLimit,
          record.minQualityScore ?? TASK_DEFAULTS[item.taskType].minQualityScore,
          record.updatedAt ?? now,
          record.updatedBy ?? null
        ]
      );
    })
  );

  return getAiTaskPolicies();
}

export async function resetAiTaskPolicy(taskType?: AiTaskType) {
  if (!taskType) {
    policyStoreCache = {};
    policyStoreCacheSyncedAt = Date.now();
    if (!isDbEnabled()) {
      persistPolicyStoreToFile(policyStoreCache);
      return getAiTaskPolicies();
    }
    await query("DELETE FROM ai_task_policies");
    return getAiTaskPolicies();
  }

  const normalizedTaskType = normalizeTaskTypeToken(taskType) ?? "assist";

  delete policyStoreCache[normalizedTaskType];
  policyStoreCacheSyncedAt = Date.now();

  if (!isDbEnabled()) {
    persistPolicyStoreToFile(policyStoreCache);
    return toPolicy(normalizedTaskType, undefined);
  }

  await query("DELETE FROM ai_task_policies WHERE task_type = $1", [normalizedTaskType]);
  return toPolicy(normalizedTaskType, undefined);
}

export function recordAiCallLog(input: Omit<AiCallLog, "id" | "createdAt">) {
  const taskType = normalizeTaskTypeToken(input.taskType) ?? "assist";
  const item: AiCallLog = {
    id: `ai-call-log-${crypto.randomBytes(8).toString("hex")}`,
    taskType,
    provider: input.provider,
    capability: input.capability,
    ok: Boolean(input.ok),
    latencyMs: Math.max(0, Math.round(Number(input.latencyMs ?? 0))),
    fallbackCount: Math.max(0, Math.round(Number(input.fallbackCount ?? 0))),
    timeout: Boolean(input.timeout),
    requestChars: Math.max(0, Math.round(Number(input.requestChars ?? 0))),
    responseChars: Math.max(0, Math.round(Number(input.responseChars ?? 0))),
    qualityScore:
      typeof input.qualityScore === "number" && Number.isFinite(input.qualityScore)
        ? clampInt(input.qualityScore, 0, 100)
        : undefined,
    policyHit:
      input.policyHit === "budget_limit" || input.policyHit === "quality_threshold"
        ? input.policyHit
        : undefined,
    policyDetail: input.policyDetail?.slice(0, 160),
    errorMessage: input.errorMessage?.slice(0, 280),
    traceId: input.traceId?.trim() || getTraceIdFromContext(),
    createdAt: new Date().toISOString()
  };

  if (!item.ok && !item.policyHit) {
    void reportAiCallFailure({
      taskType: item.taskType,
      provider: item.provider,
      capability: item.capability,
      timeout: item.timeout,
      fallbackCount: item.fallbackCount,
      latencyMs: item.latencyMs,
      requestChars: item.requestChars,
      responseChars: item.responseChars,
      errorMessage: item.errorMessage,
      traceId: item.traceId
    });
  }

  if (!isDbEnabled()) {
    const list = readJson<AiCallLog[]>(AI_CALL_LOGS_FILE, []);
    list.push(item);
    // Keep bounded local logs to avoid unbounded json growth in file-mode deployments.
    const next = list.length > MAX_CALL_LOGS ? list.slice(list.length - MAX_CALL_LOGS) : list;
    writeJson(AI_CALL_LOGS_FILE, next);
    return;
  }

  const meta = {
    capability: item.capability,
    ok: item.ok,
    fallbackCount: item.fallbackCount,
    timeout: item.timeout,
    requestChars: item.requestChars,
    responseChars: item.responseChars,
    qualityScore: item.qualityScore ?? null,
    policyHit: item.policyHit ?? null,
    policyDetail: item.policyDetail ?? "",
    traceId: item.traceId ?? null
  };

  void query(
    `INSERT INTO ai_call_logs
      (id, task_type, provider, latency_ms, status, error_code, error_message, trace_id, meta, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      item.id,
      item.taskType,
      item.provider,
      item.latencyMs,
      item.ok ? "success" : "failed",
      item.timeout ? "timeout" : item.policyHit ?? null,
      item.errorMessage ?? null,
      item.traceId ?? null,
      meta,
      item.createdAt
    ]
  ).catch(() => {
    // observability should never block ai business flow
  });
}

function numberFrom(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function mapDbCallLogRow(row: DbAiCallLogRow): AiCallLog {
  const taskType = normalizeTaskTypeToken(row.task_type) ?? "assist";
  const meta = row.meta ?? {};
  const capability = meta.capability === "vision" ? "vision" : "chat";
  const policyHitRaw = meta.policyHit;
  const policyHit =
    policyHitRaw === "budget_limit" || policyHitRaw === "quality_threshold" ? policyHitRaw : undefined;
  const qualityScoreValue = numberFrom(meta.qualityScore, NaN);

  return {
    id: row.id,
    taskType,
    provider: row.provider,
    capability,
    ok: row.status === "success",
    latencyMs: Math.max(0, Math.round(numberFrom(row.latency_ms, 0))),
    fallbackCount: Math.max(0, Math.round(numberFrom(meta.fallbackCount, 0))),
    timeout: Boolean(meta.timeout) || row.error_code === "timeout",
    requestChars: Math.max(0, Math.round(numberFrom(meta.requestChars, 0))),
    responseChars: Math.max(0, Math.round(numberFrom(meta.responseChars, 0))),
    qualityScore: Number.isFinite(qualityScoreValue) ? clampInt(qualityScoreValue, 0, 100) : undefined,
    policyHit,
    policyDetail: typeof meta.policyDetail === "string" ? meta.policyDetail : undefined,
    errorMessage: row.error_message ?? undefined,
    traceId: row.trace_id ?? (typeof meta.traceId === "string" ? meta.traceId : undefined),
    createdAt: row.created_at
  };
}

async function getRecentAiCallLogs(limit = 8000) {
  const safeLimit = Math.max(100, Math.min(MAX_CALL_LOGS, Math.floor(limit)));

  if (!isDbEnabled()) {
    const list = readJson<AiCallLog[]>(AI_CALL_LOGS_FILE, []);
    return list.slice(-safeLimit).reverse();
  }

  const rows = await query<DbAiCallLogRow>(
    `SELECT id, task_type, provider, latency_ms, status, error_code, error_message, trace_id, meta, created_at
     FROM ai_call_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  return rows.map(mapDbCallLogRow);
}

export async function getAiCallMetricsSummary(limit = 20) {
  const logs = await getRecentAiCallLogs(8000);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const latencies = logs.map((item) => item.latencyMs);
  const successCalls = logs.filter((item) => item.ok).length;
  const fallbackCalls = logs.filter((item) => item.fallbackCount > 0).length;
  const timeoutCalls = logs.filter((item) => item.timeout).length;
  const qualityRejectedCalls = logs.filter((item) => item.policyHit === "quality_threshold").length;
  const budgetRejectedCalls = logs.filter((item) => item.policyHit === "budget_limit").length;

  const rowMap = new Map<
    string,
    {
      key: string;
      taskType: AiTaskType;
      provider: string;
      calls: number;
      success: number;
      timeouts: number;
      fallbackSum: number;
      qualityRejected: number;
      budgetRejected: number;
      latencies: number[];
      requestChars: number;
      responseChars: number;
      lastSeenAt: string;
    }
  >();

  logs.forEach((item) => {
    const key = `${item.taskType}:${item.provider}`;
    const current =
      rowMap.get(key) ??
      ({
        key,
        taskType: item.taskType,
        provider: item.provider,
        calls: 0,
        success: 0,
        timeouts: 0,
        fallbackSum: 0,
        qualityRejected: 0,
        budgetRejected: 0,
        latencies: [],
        requestChars: 0,
        responseChars: 0,
        lastSeenAt: item.createdAt
      } as const);

    const next = {
      ...current,
      calls: current.calls + 1,
      success: current.success + (item.ok ? 1 : 0),
      timeouts: current.timeouts + (item.timeout ? 1 : 0),
      fallbackSum: current.fallbackSum + item.fallbackCount,
      qualityRejected: current.qualityRejected + (item.policyHit === "quality_threshold" ? 1 : 0),
      budgetRejected: current.budgetRejected + (item.policyHit === "budget_limit" ? 1 : 0),
      latencies: [...current.latencies, item.latencyMs].slice(-400),
      requestChars: current.requestChars + item.requestChars,
      responseChars: current.responseChars + item.responseChars,
      lastSeenAt:
        new Date(item.createdAt).getTime() >= new Date(current.lastSeenAt).getTime()
          ? item.createdAt
          : current.lastSeenAt
    };
    rowMap.set(key, next);
  });

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    if (b.calls !== a.calls) return b.calls - a.calls;
    return a.key.localeCompare(b.key);
  });

  return {
    generatedAt: new Date().toISOString(),
    totalCalls: logs.length,
    successCalls,
    successRate: logs.length ? round((successCalls / logs.length) * 100) : 0,
    fallbackRate: logs.length ? round((fallbackCalls / logs.length) * 100) : 0,
    timeoutRate: logs.length ? round((timeoutCalls / logs.length) * 100) : 0,
    qualityRejectRate: logs.length ? round((qualityRejectedCalls / logs.length) * 100) : 0,
    budgetRejectRate: logs.length ? round((budgetRejectedCalls / logs.length) * 100) : 0,
    avgLatencyMs: logs.length ? round(latencies.reduce((sum, value) => sum + value, 0) / logs.length) : 0,
    p95LatencyMs: computeP95(latencies),
    rows: rows.slice(0, safeLimit).map((item) => ({
      key: item.key,
      taskType: item.taskType,
      provider: item.provider,
      calls: item.calls,
      successRate: item.calls ? round((item.success / item.calls) * 100) : 0,
      timeoutRate: item.calls ? round((item.timeouts / item.calls) * 100) : 0,
      avgFallback: item.calls ? round(item.fallbackSum / item.calls) : 0,
      qualityRejectRate: item.calls ? round((item.qualityRejected / item.calls) * 100) : 0,
      budgetRejectRate: item.calls ? round((item.budgetRejected / item.calls) * 100) : 0,
      avgLatencyMs: item.calls ? round(item.latencies.reduce((sum, value) => sum + value, 0) / item.calls) : 0,
      p95LatencyMs: computeP95(item.latencies),
      avgRequestChars: item.calls ? round(item.requestChars / item.calls) : 0,
      avgResponseChars: item.calls ? round(item.responseChars / item.calls) : 0,
      lastSeenAt: item.lastSeenAt
    })),
    recentFailures: logs
      .filter((item) => !item.ok)
      .slice(0, 15)
      .map((item) => ({
        taskType: item.taskType,
        provider: item.provider,
        capability: item.capability,
        latencyMs: item.latencyMs,
        timeout: item.timeout,
        fallbackCount: item.fallbackCount,
        policyHit: item.policyHit,
        policyDetail: item.policyDetail ?? "",
        errorMessage: item.errorMessage ?? "",
        createdAt: item.createdAt
      }))
  };
}
