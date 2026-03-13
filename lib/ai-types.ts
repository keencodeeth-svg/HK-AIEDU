export type AiQualityMeta = {
  confidenceScore: number;
  riskLevel: "low" | "medium" | "high";
  needsHumanReview: boolean;
  fallbackAction: string;
  reasons: string[];
  minQualityScore?: number;
  policyViolated?: boolean;
};

export type AiLearningMode = "direct" | "study";
export type StudyCoachStage = "diagnose" | "check" | "reveal";

export type AssistAnswerMode = "answer_only" | "step_by_step" | "hints_first";

export type AssistPayload = {
  question: string;
  subject?: string;
  grade?: string;
  memoryContext?: string;
  answerMode?: AssistAnswerMode;
};

export type ImageAssistImage = {
  mimeType: string;
  base64: string;
};

export type ImageAssistPayload = {
  question?: string;
  subject?: string;
  grade?: string;
  answerMode?: AssistAnswerMode;
  images: ImageAssistImage[];
};

export type AssistResponse = {
  answer: string;
  steps: string[];
  hints: string[];
  sources: string[];
  provider: string;
  quality?: AiQualityMeta;
};

export type StudyCoachResponse = {
  learningMode: "study";
  stage: StudyCoachStage;
  stageLabel: string;
  coachReply: string;
  nextPrompt: string;
  knowledgeChecks: string[];
  checkpoints: string[];
  masteryFocus: string;
  studentTurnRequired: boolean;
  answerAvailable: boolean;
  revealAnswerCta: string;
  answer: string;
  steps: string[];
  hints: string[];
  sources: string[];
  provider: string;
  quality?: AiQualityMeta;
  feedback?: string | null;
};

export type ImageAssistResponse = {
  recognizedQuestion?: string;
  answer: string;
  steps: string[];
  hints: string[];
  sources: string[];
  provider: string;
  quality?: AiQualityMeta;
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
  quality?: AiQualityMeta;
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
  quality?: AiQualityMeta;
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
  quality?: AiQualityMeta;
};

export type LearningReport = {
  report: string;
  highlights: string[];
  reminders: string[];
  quality?: AiQualityMeta;
};

export type KnowledgePointExtraction = {
  points: string[];
  provider: string;
  quality?: AiQualityMeta;
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
