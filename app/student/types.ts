export type PlanItem = {
  knowledgePointId: string;
  targetCount: number;
  dueDate: string;
  subject?: string;
  masteryScore?: number;
  masteryLevel?: "weak" | "developing" | "strong";
  weaknessRank?: number | null;
  recommendedReason?: string;
};

export type TodayTaskStatus = "overdue" | "due_today" | "in_progress" | "pending" | "upcoming" | "optional";

export type TodayTask = {
  id: string;
  source: "assignment" | "exam" | "wrong_review" | "plan" | "challenge" | "lesson";
  sourceId: string;
  title: string;
  description: string;
  href: string;
  status: TodayTaskStatus;
  priority: number;
  impactScore: number;
  urgencyScore: number;
  effortMinutes: number;
  expectedGain: number;
  recommendedReason: string;
  dueAt: string | null;
  group: "must_do" | "continue_learning" | "growth";
  tags: string[];
};

export type TodayTaskPayload = {
  generatedAt: string;
  recentStudyVariantActivity?: {
    recentAttemptCount: number;
    recentCorrectCount: number;
    latestAttemptAt: string;
    latestKnowledgePointId: string;
    latestKnowledgePointTitle: string;
    latestSubject: string;
    latestCorrect: boolean;
  } | null;
  summary: {
    total: number;
    mustDo: number;
    continueLearning: number;
    growth: number;
    overdue: number;
    dueToday: number;
    inProgress: number;
    top3EstimatedMinutes: number;
    bySource: {
      assignment: number;
      exam: number;
      wrongReview: number;
      plan: number;
      challenge: number;
      lesson: number;
    };
  };
  groups: {
    mustDo: TodayTask[];
    continueLearning: TodayTask[];
    growth: TodayTask[];
  };
  topTasks: TodayTask[];
  tasks: TodayTask[];
};

export type StudentWeakKnowledgePointSnapshot = {
  knowledgePointId: string;
  title: string;
  subject: string;
  masteryScore: number;
  weaknessRank: number | null;
};

export type StudentRadarSnapshot = {
  weakKnowledgePoint: StudentWeakKnowledgePointSnapshot | null;
};

export type MotivationBadge = {
  id: string;
  title: string;
  description: string;
};

export type MotivationPayload = {
  streak: number;
  badges: MotivationBadge[];
  weekly?: {
    accuracy?: number;
  };
};

export type JoinRequest = {
  status?: string;
};

export type JoinMessage = {
  text: string;
  tone: "success" | "error";
};

export type EntryCategory = "priority" | "practice" | "growth";
export type EntryViewMode = "compact" | "detailed";
export type IconName = "book" | "pencil" | "rocket" | "chart" | "brain" | "trophy" | "board" | "puzzle";

export type EntryItem = {
  id: string;
  title: string;
  tag: string;
  description: string;
  href?: string;
  cta: string;
  icon: IconName;
  category: EntryCategory;
  order: number;
  kind?: "default" | "join";
};

export type EntryCategoryMeta = {
  label: string;
  description: string;
  defaultCount: number;
};

export type TodayTaskEventName = "task_started" | "task_completed" | "task_skipped";
