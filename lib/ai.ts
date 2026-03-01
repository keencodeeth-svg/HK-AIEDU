import { getEffectiveAiProviderChain } from "./ai-config";
import {
  getLlmProviderHealth as getLlmProviderHealthSnapshot,
  getProviderConfig,
  normalizeProviderChain,
  type LlmCapability,
  type LlmProvider
} from "./ai-provider";
import { probeLlmProviders as probeRoutedLlmProviders } from "./ai-router";

export type { LlmProbeResult } from "./ai-router";
export type { LlmProviderCapabilityHealth, LlmProviderHealth } from "./ai-provider";
export {
  generateKnowledgePointsDraft,
  generateKnowledgeTreeDraft,
  generateQuestionCheck,
  generateQuestionDraft,
  generateVariantDrafts,
  generateWrongExplanation
} from "./ai-generation-handlers";
export {
  extractKnowledgePointCandidates,
  generateAssistAnswer,
  generateExplainVariants,
  generateHomeworkReview,
  generateLearningReport,
  generateLessonOutline,
  generateWritingFeedback,
  generateWrongReviewScript
} from "./ai-learning-handlers";
export type {
  AssistPayload,
  AssistResponse,
  ExplainVariants,
  GenerateKnowledgePointsPayload,
  GenerateKnowledgeTreePayload,
  GenerateQuestionPayload,
  HomeworkReview,
  KnowledgePointDraft,
  KnowledgePointExtraction,
  KnowledgeTreeDraft,
  LearningReport,
  LessonOutline,
  QuestionCheck,
  QuestionDraft,
  WritingFeedback,
  WrongExplanation,
  WrongReviewScript
} from "./ai-types";

export function getLlmProviderHealth(input: { providers?: string[] } = {}) {
  return getLlmProviderHealthSnapshot(input);
}

function getProviderChain() {
  const effective = getEffectiveAiProviderChain();
  const normalized = normalizeProviderChain(effective);
  if (normalized.length) {
    return normalized;
  }
  // Keep runtime alive even when config is empty: caller still gets deterministic fallback.
  return ["mock"] as LlmProvider[];
}

export function getPrimaryLlmProvider() {
  return getProviderChain()[0] ?? "mock";
}

export function getCurrentLlmProviderChain() {
  return [...getProviderChain()];
}

export function hasConfiguredLlmProvider(capability: LlmCapability = "chat") {
  // "mock" does not count as configured provider for business features requiring real generation.
  return getProviderChain().some((provider) => {
    if (provider === "mock") return false;
    if (provider === "custom") {
      return Boolean(process.env.LLM_ENDPOINT?.trim());
    }
    return Boolean(getProviderConfig(provider, capability));
  });
}
export async function probeLlmProviders(input: {
  providers?: string[];
  capability?: LlmCapability;
} = {}) {
  return probeRoutedLlmProviders(input);
}
