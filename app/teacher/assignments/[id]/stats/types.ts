export type AssignmentStatsRouteParams = {
  id: string;
};

export type AssignmentStatsData = {
  assignment: {
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    createdAt: string;
    submissionType?: "quiz" | "upload" | "essay";
    maxUploads?: number;
    gradingFocus?: string;
  };
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  summary: {
    students: number;
    completed: number;
    pending: number;
    overdue: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
  };
  distribution: AssignmentStatsDistributionItem[];
  questionStats: AssignmentStatsQuestionStat[];
};

export type AssignmentStatsDistributionItem = {
  label: string;
  count: number;
};

export type AssignmentStatsQuestionStat = {
  id: string;
  stem: string;
  correct: number;
  total: number;
  ratio: number;
};
