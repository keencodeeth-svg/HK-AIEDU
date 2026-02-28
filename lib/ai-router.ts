import { getAiTaskPolicy, recordAiCallLog, type AiTaskType } from "./ai-task-policies";
import { assessAiQuality } from "./ai-quality-control";
import {
  getProviderConfig,
  normalizeProviderChain,
  type LlmCapability,
  type LlmProvider
} from "./ai-provider";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | any[] };

export type LlmProbeResult = {
  provider: string;
  ok: boolean;
  latencyMs: number;
  message: string;
};

function normalizeMessageContentToText(content: string | any[]) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        if (item.type === "text") return String(item.text ?? "");
        if (item.type === "image_url") return "[image]";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildCustomPrompt(messages: ChatMessage[]) {
  return messages
    .map((item) => `${item.role.toUpperCase()}: ${normalizeMessageContentToText(item.content)}`)
    .join("\n")
    .trim();
}

function countMessageChars(messages: ChatMessage[]) {
  return messages.reduce((sum, item) => sum + normalizeMessageContentToText(item.content).length, 0);
}

type AiQualityKind = Parameters<typeof assessAiQuality>[0]["kind"];

function resolveQualityKindByTask(taskType: AiTaskType): AiQualityKind {
  if (taskType === "explanation") return "explanation";
  if (taskType === "writing_feedback") return "writing";
  if (taskType === "homework_review") return "assignment_review";
  return "assist";
}

function evaluateTaskOutputQuality(params: {
  taskType: AiTaskType;
  provider: string;
  text: string;
}) {
  return assessAiQuality({
    kind: resolveQualityKindByTask(params.taskType),
    taskType: params.taskType,
    provider: params.provider,
    textBlocks: [params.text],
    listCountHint: 1
  });
}

async function runWithTimeout<T>(runner: () => Promise<T>, timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    try {
      return { value: await runner(), timeout: false, error: "" };
    } catch (error) {
      return {
        value: null as T | null,
        timeout: false,
        error: error instanceof Error ? error.message : "runner error"
      };
    }
  }

  const wrapped = runner()
    .then((value) => ({ value, timeout: false, error: "" }))
    .catch((error) => ({
      value: null as T | null,
      timeout: false,
      error: error instanceof Error ? error.message : "runner error"
    }));
  const timeout = new Promise<{ value: T | null; timeout: true; error: string }>((resolve) => {
    setTimeout(() => resolve({ value: null, timeout: true, error: "timeout" }), timeoutMs);
  });
  return Promise.race([wrapped, timeout]);
}

async function callCustomLLM(prompt: string) {
  const endpoint = process.env.LLM_ENDPOINT;
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: process.env.LLM_API_KEY ?? "" },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.text ?? null;
  } catch {
    return null;
  }
}

async function callChatCompletions(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  chatPath?: string;
  messages: ChatMessage[];
  temperature?: number;
}) {
  const { baseUrl, apiKey, model, chatPath, messages, temperature } = params;
  const path = chatPath ?? process.env.LLM_CHAT_PATH ?? "/chat/completions";
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.4,
        stream: false
      })
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

type RoutedLlmResult = {
  text: string;
  provider: string;
  qualityScore?: number;
  policyHit: boolean;
  quality?: ReturnType<typeof assessAiQuality>;
};

function recordAiCallLogSafe(input: Parameters<typeof recordAiCallLog>[0]) {
  try {
    recordAiCallLog(input);
  } catch {
    // observability should never block ai business flow
  }
}

type ProviderAttemptResult = {
  result: RoutedLlmResult | null;
  stopProvider: boolean;
};

async function runCustomProviderAttempt(params: {
  provider: "custom";
  taskType: AiTaskType;
  capability: LlmCapability;
  customPrompt?: string;
  messages: ChatMessage[];
  timeoutMs: number;
  providerIndex: number;
  requestChars: number;
  minQualityScore: number;
}) {
  const startedAt = Date.now();
  const prompt = params.customPrompt ?? buildCustomPrompt(params.messages);
  const timed = await runWithTimeout(() => callCustomLLM(prompt), params.timeoutMs);
  const text = typeof timed.value === "string" ? timed.value : null;
  const quality = text ? evaluateTaskOutputQuality({ taskType: params.taskType, provider: params.provider, text }) : null;
  const qualityRejected = Boolean(quality?.policyViolated);

  recordAiCallLogSafe({
    taskType: params.taskType,
    provider: params.provider,
    capability: params.capability,
    ok: Boolean(text) && !qualityRejected,
    latencyMs: Date.now() - startedAt,
    fallbackCount: params.providerIndex,
    timeout: timed.timeout,
    requestChars: params.requestChars,
    responseChars: text?.length ?? 0,
    qualityScore: quality?.confidenceScore,
    policyHit: qualityRejected ? "quality_threshold" : undefined,
    policyDetail: qualityRejected
      ? `${quality?.confidenceScore ?? 0} < ${quality?.minQualityScore ?? params.minQualityScore}`
      : undefined,
    errorMessage: qualityRejected ? "quality below minQualityScore" : text ? "" : timed.error || "empty response"
  });

  if (text && !qualityRejected) {
    return {
      result: {
        text,
        provider: params.provider,
        qualityScore: quality?.confidenceScore,
        policyHit: false,
        quality
      },
      stopProvider: false
    } as ProviderAttemptResult;
  }

  return {
    result: null,
    stopProvider: Boolean(qualityRejected || timed.timeout)
  } as ProviderAttemptResult;
}

async function runConfiguredProviderAttempt(params: {
  provider: Exclude<LlmProvider, "mock" | "custom">;
  taskType: AiTaskType;
  capability: LlmCapability;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs: number;
  providerIndex: number;
  requestChars: number;
  minQualityScore: number;
}) {
  const startedAt = Date.now();
  const config = getProviderConfig(params.provider, params.capability);
  if (!config) {
    recordAiCallLogSafe({
      taskType: params.taskType,
      provider: params.provider,
      capability: params.capability,
      ok: false,
      latencyMs: Date.now() - startedAt,
      fallbackCount: params.providerIndex,
      timeout: false,
      requestChars: params.requestChars,
      responseChars: 0,
      errorMessage: "missing credentials or model config"
    });
    return {
      result: null,
      stopProvider: true
    } as ProviderAttemptResult;
  }

  const timed = await runWithTimeout(
    () =>
      callChatCompletions({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        chatPath: config.chatPath,
        messages: params.messages,
        temperature: params.temperature
      }),
    params.timeoutMs
  );
  const text = typeof timed.value === "string" ? timed.value : null;
  const quality = text ? evaluateTaskOutputQuality({ taskType: params.taskType, provider: config.provider, text }) : null;
  const qualityRejected = Boolean(quality?.policyViolated);

  recordAiCallLogSafe({
    taskType: params.taskType,
    provider: config.provider,
    capability: params.capability,
    ok: Boolean(text) && !qualityRejected,
    latencyMs: Date.now() - startedAt,
    fallbackCount: params.providerIndex,
    timeout: timed.timeout,
    requestChars: params.requestChars,
    responseChars: text?.length ?? 0,
    qualityScore: quality?.confidenceScore,
    policyHit: qualityRejected ? "quality_threshold" : undefined,
    policyDetail: qualityRejected
      ? `${quality?.confidenceScore ?? 0} < ${quality?.minQualityScore ?? params.minQualityScore}`
      : undefined,
    errorMessage: qualityRejected ? "quality below minQualityScore" : text ? "" : timed.error || "empty response"
  });

  if (text && !qualityRejected) {
    return {
      result: {
        text,
        provider: config.provider,
        qualityScore: quality?.confidenceScore,
        policyHit: false,
        quality
      },
      stopProvider: false
    } as ProviderAttemptResult;
  }

  return {
    result: null,
    stopProvider: Boolean(qualityRejected || timed.timeout)
  } as ProviderAttemptResult;
}

export async function callRoutedLLM(params: {
  messages: ChatMessage[];
  temperature?: number;
  capability?: LlmCapability;
  customPrompt?: string;
  chain?: LlmProvider[];
  taskType?: AiTaskType;
}) {
  const taskType = params.taskType ?? "assist";
  const policy = getAiTaskPolicy(taskType);
  const chain = params.chain?.length ? params.chain : normalizeProviderChain(policy.providerChain);
  const capability = params.capability ?? "chat";
  const requestChars = countMessageChars(params.messages);
  const retries = Math.max(0, policy.maxRetries);
  const timeoutMs = policy.timeoutMs;

  if (requestChars > policy.budgetLimit) {
    recordAiCallLogSafe({
      taskType,
      provider: "policy",
      capability,
      ok: false,
      latencyMs: 0,
      fallbackCount: 0,
      timeout: false,
      requestChars,
      responseChars: 0,
      policyHit: "budget_limit",
      policyDetail: `${requestChars}/${policy.budgetLimit}`,
      errorMessage: `budget limit exceeded: ${requestChars} > ${policy.budgetLimit}`
    });
    return null;
  }

  for (let providerIndex = 0; providerIndex < chain.length; providerIndex += 1) {
    const provider = chain[providerIndex];
    if (provider === "mock") continue;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const outcome =
        provider === "custom"
          ? await runCustomProviderAttempt({
              provider,
              taskType,
              capability,
              customPrompt: params.customPrompt,
              messages: params.messages,
              timeoutMs,
              providerIndex,
              requestChars,
              minQualityScore: policy.minQualityScore
            })
          : await runConfiguredProviderAttempt({
              provider,
              taskType,
              capability,
              messages: params.messages,
              temperature: params.temperature,
              timeoutMs,
              providerIndex,
              requestChars,
              minQualityScore: policy.minQualityScore
            });

      if (outcome.result) {
        return outcome.result;
      }

      if (outcome.stopProvider) {
        break;
      }
    }
  }

  return null;
}

export async function probeLlmProviders(input: {
  providers?: string[];
  capability?: LlmCapability;
} = {}) {
  const capability = input.capability ?? "chat";
  const providerCandidates = normalizeProviderChain(input.providers);
  const providers: LlmProvider[] = providerCandidates.length ? providerCandidates : ["mock"];
  const results: LlmProbeResult[] = [];

  for (const provider of providers) {
    if (provider === "mock") {
      results.push({
        provider,
        ok: true,
        latencyMs: 0,
        message: "mock provider ready"
      });
      continue;
    }

    const startedAt = Date.now();
    const response = await callRoutedLLM({
      chain: [provider],
      taskType: "probe",
      capability,
      temperature: 0,
      messages: [
        { role: "system", content: "You are a health-check assistant." },
        { role: "user", content: "Reply with one short sentence: pong." }
      ],
      customPrompt: "Reply with one short sentence: pong."
    });
    const latencyMs = Date.now() - startedAt;

    if (response?.text) {
      results.push({
        provider,
        ok: true,
        latencyMs,
        message: "connection ok"
      });
    } else {
      results.push({
        provider,
        ok: false,
        latencyMs,
        message: "connection failed or missing credentials"
      });
    }
  }

  return results;
}
