export type ExperimentFlag = {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: number;
  updatedAt: string;
};

export type ABVariantReport = {
  variant: "control" | "treatment";
  users: number;
  retainedUsers: number;
  retentionRate: number;
  attempts: number;
  accuracy: number;
  wrongAttemptUsers: number;
  reviewCompletedUsers: number;
  reviewCompletionRate: number;
};

export type ABReport = {
  experiment: {
    key: string;
    name: string;
    enabled: boolean;
    rollout: number;
  };
  window: {
    days: number;
    from: string;
    to: string;
  };
  variants: ABVariantReport[];
  delta: {
    retentionRate: number;
    accuracy: number;
    reviewCompletionRate: number;
  };
  recommendation: {
    action: "increase" | "decrease" | "keep";
    suggestedRollout: number;
    reason: string;
  };
};

export type ExperimentFlagsResponse = {
  data?: ExperimentFlag[];
};

export type ExperimentABReportResponse = {
  data?: ABReport | null;
};
