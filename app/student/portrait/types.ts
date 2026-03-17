export type AbilityStat = {
  id: string;
  label: string;
  correct: number;
  total: number;
  score: number;
};

export type WeakKnowledgePoint = {
  knowledgePointId: string;
  title: string;
  subject: string;
  masteryScore: number;
  masteryLevel: "weak" | "developing" | "strong";
  confidenceScore: number;
  recencyWeight: number;
  masteryTrend7d: number;
  weaknessRank: number | null;
  correct: number;
  total: number;
  lastAttemptAt: string | null;
};

export type SubjectMastery = {
  subject: string;
  averageMasteryScore: number;
  averageConfidenceScore: number;
  averageTrend7d: number;
  trackedKnowledgePoints: number;
};

export type RecentStudyVariantActivity = {
  recentAttemptCount: number;
  recentCorrectCount: number;
  latestAttemptAt: string;
  latestKnowledgePointId: string;
  latestKnowledgePointTitle: string;
  latestSubject: string;
  latestCorrect: boolean;
  masteryScore: number;
  masteryLevel: "weak" | "developing" | "strong";
  weaknessRank: number | null;
};

export type MasterySummary = {
  averageMasteryScore: number;
  averageConfidenceScore: number;
  averageTrend7d: number;
  trackedKnowledgePoints: number;
  weakKnowledgePoints: WeakKnowledgePoint[];
  subjects: SubjectMastery[];
  recentStudyVariantActivity?: RecentStudyVariantActivity | null;
};

export type RadarResponse = {
  data?: {
    abilities?: AbilityStat[];
    mastery?: MasterySummary | null;
  };
};

export type PortraitStageCopy = {
  title: string;
  description: string;
};

export type PortraitActionPlan = {
  kicker: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  meta: string;
};
