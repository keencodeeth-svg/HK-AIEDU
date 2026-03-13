import type { AiHistoryMeta, AiHistoryOrigin } from "@/lib/ai-history";
import type { AiLearningMode, AiQualityMeta, AssistAnswerMode, StudyCoachStage } from "@/lib/ai-types";

export type TutorHistoryOrigin = AiHistoryOrigin;
export type TutorHistoryOriginFilter = TutorHistoryOrigin | "all";

export type TutorHistoryMeta = AiHistoryMeta;

export type TutorHistoryItem = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
  favorite: boolean;
  tags: string[];
  meta?: TutorHistoryMeta;
};

export type TutorHistoryCreatePayload = {
  question: string;
  answer: string;
  meta?: TutorHistoryMeta;
};

export type TutorAnswer = {
  learningMode?: AiLearningMode;
  stage?: StudyCoachStage;
  stageLabel?: string;
  coachReply?: string;
  nextPrompt?: string;
  knowledgeChecks?: string[];
  checkpoints?: string[];
  masteryFocus?: string;
  studentTurnRequired?: boolean;
  answerAvailable?: boolean;
  revealAnswerCta?: string;
  feedback?: string | null;
  memory?: {
    recentSessionCount: number;
    recentQuestions: string[];
    patternHint: string;
  };
  recognizedQuestion?: string;
  answer: string;
  steps?: string[];
  hints?: string[];
  source?: string[];
  provider?: string;
  quality?: AiQualityMeta;
};

export type TutorAskResponse = TutorAnswer & {
  error?: string;
  message?: string;
  data?: TutorAnswer;
};

export type TutorHistoryListResponse = {
  data?: TutorHistoryItem[];
};

export type TutorHistoryItemResponse = {
  data?: TutorHistoryItem;
};

export type TutorShareTarget = {
  id: string;
  name: string;
  role: "teacher" | "parent";
  kind: "teacher" | "parent";
  description: string;
  contextLabels: string[];
};

export type TutorShareTargetsResponse = {
  data?: TutorShareTarget[];
  error?: string;
  message?: string;
};

export type TutorShareResultResponse = {
  data?: {
    threadId: string;
    reused: boolean;
    target: TutorShareTarget;
  };
  error?: string;
  message?: string;
};

export type TutorAnswerMode = AssistAnswerMode;

export type TutorVariant = {
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type TutorVariantPack = {
  transferGoal: string;
  knowledgePointId?: string;
  knowledgePointTitle?: string;
  sourceMode?: "ai" | "pool" | "fallback";
  variants: TutorVariant[];
};

export type TutorVariantPackResponse = {
  data?: TutorVariantPack;
  error?: string;
  message?: string;
};

export type TutorVariantReflection = {
  masteryLevel: "secure" | "developing" | "review";
  masteryLabel: string;
  correctCount: number;
  total: number;
  answeredCount: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  detailSource: "ai" | "fallback";
  detail: {
    title: string;
    analysis: string;
    hints: string[];
    variantStem?: string;
  };
};

export type TutorVariantReflectionResponse = {
  data?: TutorVariantReflection;
  error?: string;
  message?: string;
};

export type TutorVariantProgress = {
  persisted: boolean;
  message: string;
  syncedAttemptCount: number;
  knowledgePointId?: string;
  knowledgePointTitle?: string;
  mastery?: {
    knowledgePointId: string;
    subject: string;
    masteryScore: number;
    masteryDelta: number;
    weaknessRank: number | null;
    masteryLevel: "weak" | "developing" | "strong";
    confidenceScore: number;
    recencyWeight: number;
    masteryTrend7d: number;
    correct: number;
    total: number;
    lastAttemptAt: string | null;
  } | null;
  plan?: {
    subject: string;
    knowledgePointId: string;
    targetCount: number;
    dueDate: string;
    masteryScore: number;
    masteryLevel: "weak" | "developing" | "strong";
    confidenceScore: number;
    weaknessRank: number | null;
    recommendedReason: string;
  } | null;
};

export type TutorVariantProgressResponse = {
  data?: TutorVariantProgress;
  error?: string;
  message?: string;
};
