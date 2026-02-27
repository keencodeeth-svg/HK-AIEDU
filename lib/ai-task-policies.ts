import crypto from "crypto";
import { getEffectiveAiProviderChain, type AiProviderKey } from "./ai-config";
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
  errorMessage?: string;
  createdAt: string;
};

const AI_TASK_POLICIES_FILE = "ai-task-policies.json";
const AI_CALL_LOGS_FILE = "ai-call-logs.json";
const MAX_CALL_LOGS = 20000;

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

function readPolicyStore() {
  const saved = readJson<AiTaskPolicyStore | null>(AI_TASK_POLICIES_FILE, null);
  if (!saved || typeof saved !== "object") {
    return {} as AiTaskPolicyStore;
  }
  return saved;
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

export function listAiTaskOptions() {
  return TASK_OPTIONS.map((item) => ({ ...item }));
}

export function getAiTaskPolicy(taskType: AiTaskType) {
  const store = readPolicyStore();
  return toPolicy(taskType, store[taskType]);
}

export function getAiTaskPolicies() {
  const store = readPolicyStore();
  return TASK_OPTIONS.map((item) => toPolicy(item.taskType, store[item.taskType]));
}

export function saveAiTaskPolicy(input: {
  taskType: AiTaskType;
  providerChain?: string[];
  timeoutMs?: number;
  maxRetries?: number;
  budgetLimit?: number;
  minQualityScore?: number;
  updatedBy?: string;
}) {
  const store = readPolicyStore();
  const previous = store[input.taskType] ?? {};
  const defaults = TASK_DEFAULTS[input.taskType];
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
  store[input.taskType] = next;
  writeJson(AI_TASK_POLICIES_FILE, store);
  return toPolicy(input.taskType, next);
}

export function saveAiTaskPolicies(
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
  const store = readPolicyStore();
  const now = new Date().toISOString();

  items.forEach((item) => {
    const previous = store[item.taskType] ?? {};
    const defaults = TASK_DEFAULTS[item.taskType];
    store[item.taskType] = {
      providerChain: item.providerChain !== undefined ? normalizeProviderChain(item.providerChain) : previous.providerChain,
      timeoutMs: clampInt(item.timeoutMs ?? previous.timeoutMs ?? defaults.timeoutMs, 500, 30000),
      maxRetries: clampInt(item.maxRetries ?? previous.maxRetries ?? defaults.maxRetries, 0, 5),
      budgetLimit: clampInt(item.budgetLimit ?? previous.budgetLimit ?? defaults.budgetLimit, 100, 100000),
      minQualityScore: clampInt(item.minQualityScore ?? previous.minQualityScore ?? defaults.minQualityScore, 0, 100),
      updatedAt: now,
      updatedBy: updatedBy?.trim() || undefined
    };
  });

  writeJson(AI_TASK_POLICIES_FILE, store);
  return TASK_OPTIONS.map((option) => toPolicy(option.taskType, store[option.taskType]));
}

export function resetAiTaskPolicy(taskType?: AiTaskType) {
  if (!taskType) {
    writeJson(AI_TASK_POLICIES_FILE, {});
    return getAiTaskPolicies();
  }
  const store = readPolicyStore();
  delete store[taskType];
  writeJson(AI_TASK_POLICIES_FILE, store);
  return toPolicy(taskType, undefined);
}

export function recordAiCallLog(input: Omit<AiCallLog, "id" | "createdAt">) {
  const list = readJson<AiCallLog[]>(AI_CALL_LOGS_FILE, []);
  const item: AiCallLog = {
    id: `ai-call-log-${crypto.randomBytes(8).toString("hex")}`,
    taskType: input.taskType,
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
    errorMessage: input.errorMessage?.slice(0, 280),
    createdAt: new Date().toISOString()
  };
  list.push(item);
  const next = list.length > MAX_CALL_LOGS ? list.slice(list.length - MAX_CALL_LOGS) : list;
  writeJson(AI_CALL_LOGS_FILE, next);
}

function getRecentAiCallLogs(limit = 8000) {
  const safeLimit = Math.max(100, Math.min(MAX_CALL_LOGS, Math.floor(limit)));
  const list = readJson<AiCallLog[]>(AI_CALL_LOGS_FILE, []);
  return list.slice(-safeLimit).reverse();
}

export function getAiCallMetricsSummary(limit = 20) {
  const logs = getRecentAiCallLogs(8000);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const latencies = logs.map((item) => item.latencyMs);
  const successCalls = logs.filter((item) => item.ok).length;
  const fallbackCalls = logs.filter((item) => item.fallbackCount > 0).length;
  const timeoutCalls = logs.filter((item) => item.timeout).length;

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
        errorMessage: item.errorMessage ?? "",
        createdAt: item.createdAt
      }))
  };
}
