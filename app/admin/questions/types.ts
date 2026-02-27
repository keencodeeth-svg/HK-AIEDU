export type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
};

export type Question = {
  id: string;
  subject: string;
  grade: string;
  knowledgePointId: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty?: string;
  questionType?: string;
  tags?: string[];
  abilities?: string[];
  qualityScore?: number | null;
  duplicateRisk?: "low" | "medium" | "high" | null;
  ambiguityRisk?: "low" | "medium" | "high" | null;
  answerConsistency?: number | null;
  duplicateClusterId?: string | null;
  answerConflict?: boolean;
  riskLevel?: "low" | "medium" | "high" | null;
  isolated?: boolean;
  isolationReason?: string[];
  qualityIssues?: string[];
  qualityCheckedAt?: string | null;
};

export type FacetItem = { value: string; count: number };

export type QuestionTreeNode = {
  subject: string;
  count: number;
  grades: Array<{
    grade: string;
    count: number;
    chapters: Array<{ chapter: string; count: number }>;
  }>;
};

export type QuestionListPayload = {
  data?: Question[];
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  facets?: {
    subjects?: FacetItem[];
    grades?: FacetItem[];
    chapters?: FacetItem[];
    difficulties?: FacetItem[];
    questionTypes?: FacetItem[];
  };
  tree?: QuestionTreeNode[];
};

export type QuestionQuery = {
  subject: string;
  grade: string;
  chapter: string;
  difficulty: string;
  questionType: string;
  search: string;
  pool: "all" | "isolated" | "active";
  riskLevel: "all" | "low" | "medium" | "high";
  answerConflict: "all" | "yes" | "no";
  duplicateClusterId: string;
};

export type QuestionForm = {
  subject: string;
  grade: string;
  knowledgePointId: string;
  stem: string;
  options: string;
  answer: string;
  explanation: string;
  difficulty: string;
  questionType: string;
  tags: string;
  abilities: string;
};

export type AiQuestionForm = {
  subject: string;
  grade: string;
  knowledgePointId: string;
  count: number;
  difficulty: string;
  mode: string;
  chapter: string;
};

export type QuestionFacets = {
  subjects: FacetItem[];
  grades: FacetItem[];
  chapters: FacetItem[];
  difficulties: FacetItem[];
  questionTypes: FacetItem[];
};

export const difficultyLabel: Record<string, string> = {
  easy: "简单",
  medium: "适中",
  hard: "困难"
};

export const questionTypeLabel: Record<string, string> = {
  choice: "选择题",
  fill: "填空题",
  short: "简答题"
};

export const riskLabel: Record<"low" | "medium" | "high", string> = {
  low: "低",
  medium: "中",
  high: "高"
};
