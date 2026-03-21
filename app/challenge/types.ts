export type ChallengeTask = {
  id: string;
  title: string;
  description: string;
  goal: number;
  points: number;
  type: "count" | "streak" | "accuracy" | "mastery";
  progress: number;
  completed: boolean;
  claimed: boolean;
  linkedKnowledgePoints: Array<{
    id: string;
    title: string;
    subject: string;
    grade: string;
  }>;
  unlockRule: string;
  learningProof?: {
    windowDays: number;
    linkedAttempts: number;
    linkedCorrect: number;
    linkedAccuracy: number;
    linkedReviewCorrect: number;
    masteryAverage: number;
    missingActions: string[];
  };
};

export type ChallengeExperiment = {
  key: string;
  variant: "control" | "treatment";
  enabled: boolean;
  rollout: number;
};

export type ChallengesPayload = {
  data?: {
    tasks?: ChallengeTask[];
    points?: number;
    experiment?: ChallengeExperiment | null;
    result?: {
      ok?: boolean;
      message?: string;
    };
  };
};
