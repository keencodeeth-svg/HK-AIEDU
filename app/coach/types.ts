export type CoachResponse = {
  learningMode?: "study";
  stage?: "diagnose" | "check" | "reveal";
  stageLabel?: string;
  coachReply?: string;
  nextPrompt?: string;
  knowledgeChecks?: string[];
  answer: string;
  steps: string[];
  hints: string[];
  checkpoints: string[];
  answerAvailable?: boolean;
  revealAnswerCta?: string;
  masteryFocus?: string;
  feedback?: string | null;
  memory?: {
    recentSessionCount: number;
    recentQuestions: string[];
    patternHint: string;
  };
  provider?: string;
};
