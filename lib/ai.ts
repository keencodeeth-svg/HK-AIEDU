import { retrieveKnowledgePoints, retrieveSimilarQuestion } from "./rag";
import { getEffectiveAiProviderChain } from "./ai-config";
import { getAiTaskPolicy, recordAiCallLog, type AiTaskType } from "./ai-task-policies";

export type AssistPayload = {
  question: string;
  subject?: string;
  grade?: string;
};

export type AssistResponse = {
  answer: string;
  steps: string[];
  hints: string[];
  sources: string[];
  provider: string;
};

export type QuestionDraft = {
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type KnowledgePointDraft = {
  title: string;
  chapter: string;
};

export type KnowledgeTreeDraft = {
  units: {
    title: string;
    chapters: {
      title: string;
      points: { title: string }[];
    }[];
  }[];
};

export type GenerateQuestionPayload = {
  subject: string;
  grade: string;
  knowledgePointTitle: string;
  chapter?: string;
  difficulty?: "easy" | "medium" | "hard";
  questionType?: string;
};

export type WrongExplanation = {
  analysis: string;
  hints: string[];
};

export type WritingFeedback = {
  scores: {
    structure: number;
    grammar: number;
    vocab: number;
  };
  summary: string;
  strengths: string[];
  improvements: string[];
  corrected?: string;
};

export type LessonOutline = {
  objectives: string[];
  keyPoints: string[];
  slides: { title: string; bullets: string[] }[];
  blackboardSteps: string[];
};

export type WrongReviewScript = {
  agenda: string[];
  script: string[];
  reminders: string[];
};

export type ExplainVariants = {
  text: string;
  visual: string;
  analogy: string;
  provider: string;
};

export type HomeworkReview = {
  score: number;
  summary: string;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  rubric: { item: string; score: number; comment: string }[];
  writing?: {
    scores: { structure: number; grammar: number; vocab: number };
    summary: string;
    strengths: string[];
    improvements: string[];
    corrected?: string;
  };
  provider: string;
};

export type LearningReport = {
  report: string;
  highlights: string[];
  reminders: string[];
};

export type KnowledgePointExtraction = {
  points: string[];
  provider: string;
};

export type QuestionCheck = {
  issues: string[];
  risk: "low" | "medium" | "high";
  suggestedAnswer?: string;
  notes?: string;
};

export type GenerateKnowledgePointsPayload = {
  subject: string;
  grade: string;
  chapter?: string;
  count?: number;
};

export type GenerateKnowledgeTreePayload = {
  subject: string;
  grade: string;
  edition?: string;
  volume?: string;
  unitCount?: number;
  chaptersPerUnit?: number;
  pointsPerChapter?: number;
};

const SYSTEM_PROMPT =
  "你是 K12 辅导老师。请用简洁、清晰、分步骤的方式讲解，避免直接给出复杂推理。";

const GENERATE_PROMPT =
  "你是 K12 出题老师。只输出严格 JSON，不要附加解释或代码块。";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string | any[] };

type LlmProvider =
  | "mock"
  | "custom"
  | "compatible"
  | "zhipu"
  | "deepseek"
  | "kimi"
  | "minimax"
  | "seedance";

type LlmCapability = "chat" | "vision";

export type LlmProbeResult = {
  provider: string;
  ok: boolean;
  latencyMs: number;
  message: string;
};

type LlmResolvedConfig = {
  provider: Exclude<LlmProvider, "mock" | "custom">;
  baseUrl: string;
  apiKey: string;
  model: string;
  chatPath: string;
};

const PROVIDER_PREFIX: Record<Exclude<LlmProvider, "mock" | "custom" | "compatible">, string> = {
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

function normalizeProviderChain(values?: string[]) {
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

function getProviderChain() {
  const effective = getEffectiveAiProviderChain();
  const normalized = normalizeProviderChain(effective);
  if (normalized.length) {
    return normalized;
  }
  return ["mock"] as LlmProvider[];
}

export function getPrimaryLlmProvider() {
  return getProviderChain()[0] ?? "mock";
}

export function getCurrentLlmProviderChain() {
  return [...getProviderChain()];
}

function getProviderConfig(provider: Exclude<LlmProvider, "mock" | "custom">, capability: LlmCapability) {
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

  if (!baseUrl || !apiKey || !model) return null;
  return {
    provider,
    baseUrl,
    apiKey,
    model,
    chatPath
  } as LlmResolvedConfig;
}

export function hasConfiguredLlmProvider(capability: LlmCapability = "chat") {
  return getProviderChain().some((provider) => {
    if (provider === "mock") return false;
    if (provider === "custom") {
      return Boolean(firstNonEmpty(process.env.LLM_ENDPOINT));
    }
    return Boolean(getProviderConfig(provider, capability));
  });
}

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

function countMessageChars(messages: ChatMessage[]) {
  return messages.reduce((sum, item) => sum + normalizeMessageContentToText(item.content).length, 0);
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

async function callRoutedLLM(params: {
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

  for (let providerIndex = 0; providerIndex < chain.length; providerIndex += 1) {
    const provider = chain[providerIndex];
    if (provider === "mock") continue;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const startedAt = Date.now();

      if (provider === "custom") {
        const prompt = params.customPrompt ?? buildCustomPrompt(params.messages);
        const result = await runWithTimeout(() => callCustomLLM(prompt), timeoutMs);
        const text = typeof result.value === "string" ? result.value : null;

        try {
          recordAiCallLog({
            taskType,
            provider,
            capability,
            ok: Boolean(text),
            latencyMs: Date.now() - startedAt,
            fallbackCount: providerIndex,
            timeout: result.timeout,
            requestChars,
            responseChars: text?.length ?? 0,
            errorMessage: text ? "" : result.error || "empty response"
          });
        } catch {
          // observability should never block ai business flow
        }

        if (text) {
          return { text, provider } as const;
        }
        if (result.timeout) {
          break;
        }
        continue;
      }

      const config = getProviderConfig(provider, capability);
      if (!config) {
        try {
          recordAiCallLog({
            taskType,
            provider,
            capability,
            ok: false,
            latencyMs: Date.now() - startedAt,
            fallbackCount: providerIndex,
            timeout: false,
            requestChars,
            responseChars: 0,
            errorMessage: "missing credentials or model config"
          });
        } catch {
          // observability should never block ai business flow
        }
        break;
      }

      const result = await runWithTimeout(
        () =>
          callChatCompletions({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model,
            chatPath: config.chatPath,
            messages: params.messages,
            temperature: params.temperature
          }),
        timeoutMs
      );
      const text = typeof result.value === "string" ? result.value : null;

      try {
        recordAiCallLog({
          taskType,
          provider: config.provider,
          capability,
          ok: Boolean(text),
          latencyMs: Date.now() - startedAt,
          fallbackCount: providerIndex,
          timeout: result.timeout,
          requestChars,
          responseChars: text?.length ?? 0,
          errorMessage: text ? "" : result.error || "empty response"
        });
      } catch {
        // observability should never block ai business flow
      }

      if (text) {
        return { text, provider: config.provider } as const;
      }

      if (result.timeout) {
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
  const providers = providerCandidates.length ? providerCandidates : getProviderChain();
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

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function normalizeOption(text: string) {
  return text
    .replace(/^[A-Da-d][\\.、\\)）:：]\\s*/, "")
    .replace(/^选项\\s*[A-Da-d]\\s*[:：]/, "")
    .trim();
}

function normalizeTitle(text: string) {
  return text
    .replace(/^\\d+[\\.、\\)]\\s*/, "")
    .replace(/^第[一二三四五六七八九十]+[单元章节]\\s*/, "")
    .trim();
}

function normalizeDraft(input: any): QuestionDraft | null {
  if (!input || typeof input !== "object") return null;
  const stem = String(input.stem ?? "").trim();
  const explanation = String(input.explanation ?? "").trim();
  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = rawOptions
    .map((item: any) => normalizeOption(String(item)))
    .filter(Boolean);
  if (!stem || !explanation || options.length < 4) return null;

  const uniqueOptions: string[] = [];
  options.forEach((opt: string) => {
    if (!uniqueOptions.includes(opt)) uniqueOptions.push(opt);
  });
  if (uniqueOptions.length < 4) return null;
  const normalizedOptions = uniqueOptions.slice(0, 4);
  let answer = String(input.answer ?? "").trim();
  if (!answer) return null;

  const letterMap = { A: 0, B: 1, C: 2, D: 3 } as const;
  const upper = answer.toUpperCase();
  if (upper in letterMap) {
    const idx = letterMap[upper as keyof typeof letterMap];
    if (normalizedOptions[idx]) {
      answer = normalizedOptions[idx];
    }
  }

  if (!normalizedOptions.includes(answer)) {
    return null;
  }

  return { stem, options: normalizedOptions, answer, explanation };
}

export async function generateQuestionDraft(payload: GenerateQuestionPayload) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `知识点：${payload.knowledgePointTitle}`,
    payload.chapter ? `章节：${payload.chapter}` : "",
    payload.difficulty ? `难度：${payload.difficulty}` : "",
    payload.questionType ? `题型：${payload.questionType}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成 1 道四选一选择题，字段为: stem, options, answer, explanation。\n要求: options 为 4 个简短选项，answer 必须完全等于其中一个选项文本，不要包含 A/B/C/D 前缀。`;
  const llm = await callRoutedLLM({
    taskType: "question_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  return normalizeDraft(parsed);
}

export async function generateWrongExplanation(payload: {
  subject: string;
  grade: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation?: string;
  knowledgePointTitle?: string;
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.knowledgePointTitle ? `知识点：${payload.knowledgePointTitle}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n题目：${payload.question}\n学生答案：${payload.studentAnswer}\n正确答案：${payload.correctAnswer}\n已有解析：${payload.explanation ?? ""}\n请指出学生可能的错误原因，并用简洁语言给出纠正讲解与 2-3 条提示。返回 JSON：{\"analysis\":\"...\",\"hints\":[\"...\",\"...\"]}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "explanation",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;
  const analysis = String((parsed as any).analysis ?? "").trim();
  const hintsRaw = Array.isArray((parsed as any).hints) ? (parsed as any).hints : [];
  const hints = hintsRaw.map((item: any) => String(item).trim()).filter(Boolean);
  if (!analysis) return null;
  return { analysis, hints: hints.slice(0, 3) };
}

export async function generateVariantDrafts(payload: {
  subject: string;
  grade: string;
  knowledgePointTitle: string;
  chapter?: string;
  seedQuestion: string;
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
}) {
  const count = Math.min(Math.max(Number(payload.count) || 2, 1), 4);
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `知识点：${payload.knowledgePointTitle}`,
    payload.chapter ? `章节：${payload.chapter}` : "",
    payload.difficulty ? `难度：${payload.difficulty}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n参考题目：${payload.seedQuestion}\n请生成 ${count} 道同类型变式选择题，返回 JSON：{\"items\":[{\"stem\":\"...\",\"options\":[\"...\"],\"answer\":\"...\",\"explanation\":\"...\"}]}。要求选项为 4 个，答案必须等于某个选项文本，不要附加 A/B/C/D。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "variant_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed) return null;
  const rawItems = Array.isArray((parsed as any).items) ? (parsed as any).items : Array.isArray(parsed) ? parsed : [];
  if (!rawItems.length) return null;

  const drafts: QuestionDraft[] = [];
  rawItems.forEach((item: any) => {
    const draft = normalizeDraft(item);
    if (draft) drafts.push(draft);
  });

  return drafts.length ? drafts.slice(0, count) : null;
}

function buildExplainFallback(payload: {
  stem: string;
  explanation?: string;
  knowledgePointTitle?: string;
}) {
  const base = (payload.explanation ?? "").trim() || `这道题考查${payload.knowledgePointTitle ?? "基础概念"}。`;
  const parts = base
    .split(/[。！？!?.]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const visual = parts.length
    ? `图解思路：\n${parts.map((item, idx) => `${idx + 1}) ${item}`).join("\n")}`
    : `图解思路：先读题找关键信息，再代入公式计算。`;
  const analogy = `生活类比：把题目理解成生活中的“小份量比较”或“分配问题”，${base}`;
  return {
    text: base,
    visual,
    analogy,
    provider: "rule"
  };
}

export async function generateExplainVariants(payload: {
  subject: string;
  grade: string;
  stem: string;
  answer: string;
  explanation?: string;
  knowledgePointTitle?: string;
  citations?: string[];
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.knowledgePointTitle ? `知识点：${payload.knowledgePointTitle}` : "",
    payload.citations?.length
      ? `教材依据：\n${payload.citations
          .slice(0, 4)
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n题目：${payload.stem}\n答案：${payload.answer}\n解析：${payload.explanation ?? ""}\n请给出三种版本讲解：文字版、图解版、生活类比版。输出 JSON：{\"text\":\"...\",\"visual\":\"...\",\"analogy\":\"...\"}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "explanation",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${SYSTEM_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return buildExplainFallback(payload);
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return buildExplainFallback(payload);
  const textExplain = String((parsed as any).text ?? "").trim();
  const visual = String((parsed as any).visual ?? "").trim();
  const analogy = String((parsed as any).analogy ?? "").trim();
  if (!textExplain || !visual || !analogy) return buildExplainFallback(payload);
  return { text: textExplain, visual, analogy, provider: llm.provider };
}

function buildHomeworkFallback(payload: {
  subject: string;
  grade: string;
  focus?: string;
  uploadCount: number;
  submissionType?: "quiz" | "upload" | "essay";
  submissionText?: string | null;
}) {
  const base = payload.focus?.trim() || "作业完成情况与解题思路";
  const isEssay = payload.submissionType === "essay";
  const hasText = Boolean(payload.submissionText?.trim());
  const summaryParts = [];
  if (payload.uploadCount > 0) {
    summaryParts.push(`已收到 ${payload.uploadCount} 份作业材料。`);
  }
  if (hasText) {
    summaryParts.push(isEssay ? "已收到作文文本内容。" : "已收到学生备注。");
  }
  if (!summaryParts.length) {
    summaryParts.push("已收到作业信息。");
  }
  summaryParts.push(`请重点关注：${base}。`);
  const summary = summaryParts.join("");
  const rubric = isEssay
    ? [
        { item: "结构与立意", score: 80, comment: "结构完整，可加强开头点题。" },
        { item: "语言表达", score: 78, comment: "语句通顺，注意用词准确。" },
        { item: "细节与例证", score: 82, comment: "例子较清晰，可补充细节。" },
        { item: "书写规范", score: 85, comment: "书写较清楚，注意标点规范。" }
      ]
    : [
        { item: "解题步骤", score: 80, comment: "步骤基本完整，可再细化关键环节。" },
        { item: "结果准确性", score: 78, comment: "个别题需复核结果。" },
        { item: "书写规范", score: 85, comment: "整体书写清晰。" }
      ];
  return {
    score: 80,
    summary,
    strengths: ["步骤较完整", "书写较清晰"],
    issues: ["个别步骤缺少解释", "部分题目缺少验算"],
    suggestions: ["补充关键步骤说明", "完成后进行自检或验算"],
    rubric,
    writing: isEssay
      ? {
          scores: { structure: 80, grammar: 78, vocab: 79 },
          summary: "表达清晰，建议在结构衔接与词汇丰富度上继续提升。",
          strengths: ["主题明确", "语句通顺"],
          improvements: ["丰富细节描写", "注意段落衔接"],
          corrected: undefined
        }
      : undefined,
    provider: "rule"
  };
}

export async function generateHomeworkReview(payload: {
  subject: string;
  grade: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  focus?: string;
  submissionType?: "quiz" | "upload" | "essay";
  submissionText?: string | null;
  images: Array<{ mimeType: string; base64: string; fileName: string }>;
}) {
  const isEssay = payload.submissionType === "essay";
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `作业标题：${payload.assignmentTitle}`,
    payload.assignmentDescription ? `作业说明：${payload.assignmentDescription}` : "",
    payload.focus ? `批改重点：${payload.focus}` : "",
    payload.submissionText
      ? `${isEssay ? "作文内容" : "学生备注"}：${payload.submissionText}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const essaySchema =
    "{\"score\":80,\"summary\":\"...\",\"strengths\":[\"...\"],\"issues\":[\"...\"],\"suggestions\":[\"...\"],\"rubric\":[{\"item\":\"...\",\"score\":80,\"comment\":\"...\"}],\"writing\":{\"scores\":{\"structure\":80,\"grammar\":78,\"vocab\":75},\"summary\":\"...\",\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"corrected\":\"...\"}}";
  const homeworkSchema =
    "{\"score\":80,\"summary\":\"...\",\"strengths\":[\"...\"],\"issues\":[\"...\"],\"suggestions\":[\"...\"],\"rubric\":[{\"item\":\"...\",\"score\":80,\"comment\":\"...\"}]}";

  const userText = `${context}\n请对作业进行批改，输出 JSON：${isEssay ? essaySchema : homeworkSchema}。不要输出多余文本。`;

  const content: any[] = [{ type: "text", text: userText }];
  payload.images.slice(0, 4).forEach((img) => {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
  });

  const llm = await callRoutedLLM({
    taskType: "homework_review",
    messages: [
      { role: "system", content: "你是老师，擅长批改作业。请给出可执行的点评与评分。" },
      { role: "user", content }
    ],
    temperature: 0.3,
    capability: payload.images.length ? "vision" : "chat",
    customPrompt: userText
  });

  if (!llm?.text) {
    return buildHomeworkFallback({
      subject: payload.subject,
      grade: payload.grade,
      focus: payload.focus,
      uploadCount: payload.images.length,
      submissionType: payload.submissionType,
      submissionText: payload.submissionText
    });
  }

  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") {
    return buildHomeworkFallback({
      subject: payload.subject,
      grade: payload.grade,
      focus: payload.focus,
      uploadCount: payload.images.length,
      submissionType: payload.submissionType,
      submissionText: payload.submissionText
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(Number((parsed as any).score ?? 0))));
  const summary = String((parsed as any).summary ?? "").trim();
  const strengths = Array.isArray((parsed as any).strengths)
    ? (parsed as any).strengths.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const issues = Array.isArray((parsed as any).issues)
    ? (parsed as any).issues.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const suggestions = Array.isArray((parsed as any).suggestions)
    ? (parsed as any).suggestions.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const rubricRaw = Array.isArray((parsed as any).rubric) ? (parsed as any).rubric : [];
  const rubric = rubricRaw
    .map((item: any) => ({
      item: String(item.item ?? "").trim(),
      score: Math.max(0, Math.min(100, Math.round(Number(item.score ?? 0)))),
      comment: String(item.comment ?? "").trim()
    }))
    .filter((item: any) => item.item);

  const writing = (parsed as any).writing ?? null;
  const writingScores = writing?.scores ?? {};
  const writingBlock = writing
    ? {
        scores: {
          structure: Math.max(0, Math.min(100, Math.round(Number(writingScores.structure ?? 0)))),
          grammar: Math.max(0, Math.min(100, Math.round(Number(writingScores.grammar ?? 0)))),
          vocab: Math.max(0, Math.min(100, Math.round(Number(writingScores.vocab ?? 0))))
        },
        summary: String(writing.summary ?? "").trim() || "写作结构清晰，可继续优化用词与细节。",
        strengths: Array.isArray(writing.strengths)
          ? writing.strengths.map((item: any) => String(item).trim()).filter(Boolean).slice(0, 5)
          : [],
        improvements: Array.isArray(writing.improvements)
          ? writing.improvements.map((item: any) => String(item).trim()).filter(Boolean).slice(0, 5)
          : [],
        corrected: String(writing.corrected ?? "").trim() || undefined
      }
    : undefined;

  return {
    score: score || 80,
    summary: summary || "已完成批改。",
    strengths: strengths.slice(0, 5),
    issues: issues.slice(0, 5),
    suggestions: suggestions.slice(0, 5),
    rubric: rubric.slice(0, 5),
    writing: writingBlock,
    provider: llm.provider
  };
}

export async function generateWritingFeedback(payload: {
  subject: string;
  grade: string;
  title?: string;
  content: string;
}) {
  const context = [`学科：${payload.subject}`, `年级：${payload.grade}`, payload.title ? `题目：${payload.title}` : ""]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n写作内容：${payload.content}\n请给出结构、语法、词汇三个维度的评分（0-100），并提供简短总结、优点、改进建议。返回 JSON：{\"scores\":{\"structure\":80,\"grammar\":78,\"vocab\":75},\"summary\":\"...\",\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"corrected\":\"...\"}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "writing_feedback",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;

  const scores = (parsed as any).scores ?? {};
  const normalizeScore = (value: any) => {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  };

  const summary = String((parsed as any).summary ?? "").trim();
  const strengths = Array.isArray((parsed as any).strengths)
    ? (parsed as any).strengths.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const improvements = Array.isArray((parsed as any).improvements)
    ? (parsed as any).improvements.map((item: any) => String(item).trim()).filter(Boolean)
    : [];
  const corrected = String((parsed as any).corrected ?? "").trim();

  return {
    scores: {
      structure: normalizeScore(scores.structure),
      grammar: normalizeScore(scores.grammar),
      vocab: normalizeScore(scores.vocab)
    },
    summary: summary || "已完成基础批改，请参考评分与建议进行修改。",
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    corrected: corrected || undefined
  } as WritingFeedback;
}

export async function extractKnowledgePointCandidates(payload: {
  subject: string;
  grade: string;
  text: string;
  candidates?: string[];
}) {
  const primaryProvider = getProviderChain()[0] ?? "mock";
  const text = payload.text.trim().slice(0, 3000);
  if (!text) {
    return { points: [], provider: "rule" } as KnowledgePointExtraction;
  }

  const candidateText = (payload.candidates ?? []).slice(0, 60).join("、");
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    candidateText ? `可选知识点：${candidateText}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n文本内容：${text}\n请提取最相关的知识点，返回 JSON：{"points":["知识点1","知识点2"]}。只输出 JSON，不要解释。`;

  const llm = await callRoutedLLM({
    taskType: "kp_extract",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) {
    return { points: [], provider: primaryProvider } as KnowledgePointExtraction;
  }

  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") {
    return { points: [], provider: llm.provider } as KnowledgePointExtraction;
  }

  const pointsRaw = Array.isArray((parsed as any).points) ? (parsed as any).points : [];
  const points = Array.from(
    new Set(
      pointsRaw
        .map((item: any) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 10)
    )
  );

  return { points, provider: llm.provider } as KnowledgePointExtraction;
}

export async function generateLessonOutline(payload: {
  subject: string;
  grade: string;
  topic: string;
  knowledgePoints?: string[];
  citations?: string[];
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `主题：${payload.topic}`,
    payload.knowledgePoints?.length ? `知识点：${payload.knowledgePoints.join("、")}` : "",
    payload.citations?.length
      ? `教材依据：\n${payload.citations
          .slice(0, 4)
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成课堂讲稿结构，输出 JSON：{\"objectives\":[\"...\"],\"keyPoints\":[\"...\"],\"slides\":[{\"title\":\"...\",\"bullets\":[\"...\"]}],\"blackboardSteps\":[\"...\"]}。slides 为 PPT 大纲，blackboardSteps 为板书步骤。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "lesson_outline",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;
  const objectives = Array.isArray((parsed as any).objectives) ? (parsed as any).objectives : [];
  const keyPoints = Array.isArray((parsed as any).keyPoints) ? (parsed as any).keyPoints : [];
  const slides = Array.isArray((parsed as any).slides) ? (parsed as any).slides : [];
  const blackboardSteps = Array.isArray((parsed as any).blackboardSteps)
    ? (parsed as any).blackboardSteps
    : [];

  const cleanSlides = slides
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      bullets: Array.isArray(item?.bullets) ? item.bullets.map((b: any) => String(b).trim()).filter(Boolean) : []
    }))
    .filter((item: any) => item.title);

  return {
    objectives: objectives.map((item: any) => String(item).trim()).filter(Boolean),
    keyPoints: keyPoints.map((item: any) => String(item).trim()).filter(Boolean),
    slides: cleanSlides,
    blackboardSteps: blackboardSteps.map((item: any) => String(item).trim()).filter(Boolean)
  } as LessonOutline;
}

export async function generateWrongReviewScript(payload: {
  subject: string;
  grade: string;
  className?: string;
  wrongPoints: string[];
}) {
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.className ? `班级：${payload.className}` : "",
    `重点错因/知识点：${payload.wrongPoints.join("、")}`
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请输出“错题讲评课”脚本，JSON 格式：{\"agenda\":[\"...\"],\"script\":[\"...\"],\"reminders\":[\"...\"]}。script 为讲评课流程话术分段。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "wrong_review_script",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;

  const agenda = Array.isArray((parsed as any).agenda) ? (parsed as any).agenda : [];
  const script = Array.isArray((parsed as any).script) ? (parsed as any).script : [];
  const reminders = Array.isArray((parsed as any).reminders) ? (parsed as any).reminders : [];

  return {
    agenda: agenda.map((item: any) => String(item).trim()).filter(Boolean),
    script: script.map((item: any) => String(item).trim()).filter(Boolean),
    reminders: reminders.map((item: any) => String(item).trim()).filter(Boolean)
  } as WrongReviewScript;
}

export async function generateLearningReport(payload: {
  className?: string;
  summary: string;
  weakPoints: string[];
}) {
  const context = [
    payload.className ? `班级：${payload.className}` : "",
    `摘要：${payload.summary}`,
    payload.weakPoints.length ? `薄弱点：${payload.weakPoints.join("、")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成学情报告，输出 JSON：{\"report\":\"...\",\"highlights\":[\"...\"],\"reminders\":[\"...\"]}。report 为简短段落，reminders 为重点提醒。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "learning_report",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;
  const report = String((parsed as any).report ?? "").trim();
  const highlights = Array.isArray((parsed as any).highlights) ? (parsed as any).highlights : [];
  const reminders = Array.isArray((parsed as any).reminders) ? (parsed as any).reminders : [];

  if (!report) return null;
  return {
    report,
    highlights: highlights.map((item: any) => String(item).trim()).filter(Boolean),
    reminders: reminders.map((item: any) => String(item).trim()).filter(Boolean)
  } as LearningReport;
}

export async function generateQuestionCheck(payload: {
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
  subject?: string;
  grade?: string;
}) {
  const context = [
    payload.subject ? `学科：${payload.subject}` : "",
    payload.grade ? `年级：${payload.grade}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n题目：${payload.stem}\n选项：${payload.options.join(" | ")}\n答案：${payload.answer}\n解析：${payload.explanation ?? ""}\n请检查是否存在题目歧义、答案错误或选项重复。输出 JSON：{\"issues\":[\"...\"],\"risk\":\"low|medium|high\",\"suggestedAnswer\":\"...\",\"notes\":\"...\"}。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "question_check",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed || typeof parsed !== "object") return null;

  const issues = Array.isArray((parsed as any).issues) ? (parsed as any).issues : [];
  const riskRaw = String((parsed as any).risk ?? "low").toLowerCase();
  const risk = ["low", "medium", "high"].includes(riskRaw) ? (riskRaw as "low" | "medium" | "high") : "low";
  const suggestedAnswer = String((parsed as any).suggestedAnswer ?? "").trim();
  const notes = String((parsed as any).notes ?? "").trim();

  return {
    issues: issues.map((item: any) => String(item).trim()).filter(Boolean),
    risk,
    suggestedAnswer: suggestedAnswer || undefined,
    notes: notes || undefined
  } as QuestionCheck;
}

export async function generateKnowledgePointsDraft(payload: GenerateKnowledgePointsPayload) {
  const count = Math.min(Math.max(Number(payload.count) || 5, 1), 10);
  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    payload.chapter ? `章节：${payload.chapter}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `${context}\n请生成 ${count} 个知识点名称，返回 JSON。格式: {\"items\":[{\"title\":\"...\",\"chapter\":\"...\"}]}。\n要求: title 简洁准确，chapter 如果已提供则使用，否则给出合理章节名。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "knowledge_points_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed) return null;

  const rawItems = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
  if (!rawItems.length) return null;

  const seen = new Set<string>();
  const items: KnowledgePointDraft[] = [];

  for (const item of rawItems) {
    const title = normalizeTitle(String(item?.title ?? "")).trim();
    const chapter = String(item?.chapter ?? payload.chapter ?? "未归类").trim();
    if (!title) continue;
    const key = `${title}|${chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, chapter });
    if (items.length >= count) break;
  }

  return items.length ? items : null;
}

export async function generateKnowledgeTreeDraft(payload: GenerateKnowledgeTreePayload) {
  const unitCount = Math.min(Math.max(Number(payload.unitCount) || 6, 1), 12);
  const chaptersPerUnit = Math.min(Math.max(Number(payload.chaptersPerUnit) || 2, 1), 4);
  const pointsPerChapter = Math.min(Math.max(Number(payload.pointsPerChapter) || 4, 2), 8);
  const edition = payload.edition ?? "人教版";
  const volume = payload.volume ?? "上册";

  const context = [
    `学科：${payload.subject}`,
    `年级：${payload.grade}`,
    `教材版本：${edition}`,
    `册次：${volume}`
  ].join("\n");

  const userPrompt = `${context}\n请输出整本书的知识点树，按“单元->章节->知识点”分层，返回 JSON：{\"units\":[{\"title\":\"第一单元\",\"chapters\":[{\"title\":\"...\",\"points\":[{\"title\":\"...\"}]}]}]}。\n单元数量约 ${unitCount} 个，每单元 ${chaptersPerUnit} 章，每章 ${pointsPerChapter} 个知识点。不要输出多余文本。`;
  const llm = await callRoutedLLM({
    taskType: "knowledge_tree_generate",
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${GENERATE_PROMPT}\n${userPrompt}`
  });
  if (!llm?.text) return null;
  const parsed = extractJson(llm.text);
  if (!parsed) return null;

  const rawUnits = Array.isArray(parsed.units) ? parsed.units : Array.isArray(parsed) ? parsed : [];
  if (!rawUnits.length) return null;

  const units: KnowledgeTreeDraft["units"] = [];

  for (const rawUnit of rawUnits) {
    const unitTitle = normalizeTitle(String(rawUnit?.title ?? "")).trim();
    if (!unitTitle) continue;
    const rawChapters = Array.isArray(rawUnit?.chapters) ? rawUnit.chapters : [];
    const chapters: KnowledgeTreeDraft["units"][number]["chapters"] = [];

    for (const rawChapter of rawChapters) {
      const chapterTitle = normalizeTitle(String(rawChapter?.title ?? "")).trim();
      if (!chapterTitle) continue;
      const rawPoints = Array.isArray(rawChapter?.points) ? rawChapter.points : [];
      const points = rawPoints
        .map((point: any) => ({ title: normalizeTitle(String(point?.title ?? "")).trim() }))
        .filter((point: any) => point.title);

      if (!points.length) continue;
      const trimmedPoints = points.slice(0, pointsPerChapter);
      chapters.push({ title: chapterTitle, points: trimmedPoints });
      if (chapters.length >= chaptersPerUnit) break;
    }

    if (!chapters.length) continue;
    units.push({ title: unitTitle, chapters });
    if (units.length >= unitCount) break;
  }

  return units.length ? { units } : null;
}

export async function generateAssistAnswer(payload: AssistPayload): Promise<AssistResponse> {
  const question = payload.question.trim();
  const subject = payload.subject;
  const grade = payload.grade;

  const relatedQuestion = await retrieveSimilarQuestion(question, subject, grade);
  const relatedKps = await retrieveKnowledgePoints(question, subject, grade);

  const contextLines = [];
  if (relatedQuestion) {
    contextLines.push(`参考题目：${relatedQuestion.stem}`);
    contextLines.push(`参考解析：${relatedQuestion.explanation}`);
  }
  if (relatedKps.length) {
    contextLines.push(`相关知识点：${relatedKps.map((kp) => kp.title).join("、")}`);
  }

  const userPrompt = `问题：${question}\n${contextLines.join("\n")}\n请用 3-5 句话讲清楚思路。`;

  const llm = await callRoutedLLM({
    taskType: "assist",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    customPrompt: `${SYSTEM_PROMPT}\n${userPrompt}`
  });
  if (llm?.text) {
    return {
      answer: llm.text,
      steps: ["识别题干关键点", "匹配知识点", "给出清晰步骤"],
      hints: ["先理解题意", "注意单位一致"],
      sources: relatedKps.map((kp) => kp.title),
      provider: llm.provider
    };
  }

  if (relatedQuestion) {
    return {
      answer: relatedQuestion.explanation,
      steps: ["看清题目条件", "列出关键关系", "逐步计算"],
      hints: ["先把题目中的已知量圈出来", "分步检查"],
      sources: [relatedQuestion.knowledgePointId],
      provider: "mock"
    };
  }

  const kpNames = relatedKps.map((kp) => kp.title);
  const fallback = kpNames.length
    ? `这道题可能属于：${kpNames.join("、")}。建议先回顾该知识点，再按步骤解题。`
    : "先找出题目中的数量关系，然后一步步推理。";

  return {
    answer: fallback,
    steps: ["找出已知条件", "确定目标", "逐步推导"],
    hints: ["画图或列式", "检查是否需要通分"],
    sources: kpNames,
    provider: "mock"
  };
}
