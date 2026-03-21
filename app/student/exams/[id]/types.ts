export type ExamDetail = {
  exam: {
    id: string;
    title: string;
    description?: string;
    publishMode: "teacher_assigned" | "targeted";
    antiCheatLevel: "off" | "basic";
    startAt?: string;
    endAt: string;
    durationMinutes?: number;
    status: "published" | "closed";
  };
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  assignment: {
    status: "pending" | "in_progress" | "submitted";
    startedAt?: string;
    submittedAt?: string;
    autoSavedAt?: string;
    score?: number;
    total?: number;
  };
  questions: Array<{
    id: string;
    stem: string;
    options: string[];
    score: number;
    orderIndex: number;
  }>;
  draftAnswers: Record<string, string>;
  submission: {
    score: number;
    total: number;
    submittedAt: string;
    answers: Record<string, string>;
  } | null;
  reviewPackSummary?: {
    wrongCount: number;
    estimatedMinutes: number;
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
  } | null;
  access: {
    stage: "upcoming" | "open" | "ended" | "closed";
    canEnter: boolean;
    canSubmit: boolean;
    lockReason: string | null;
    serverNow: string;
  };
};

export type ExamQuestion = ExamDetail["questions"][number];
export type ReviewPackSummary = NonNullable<ExamDetail["reviewPackSummary"]>;

export type SubmitResult = {
  score: number;
  total: number;
  submittedAt: string;
  wrongCount: number;
  queuedReviewCount: number;
  details: Array<{
    questionId: string;
    correct: boolean;
    answer: string;
    correctAnswer: string;
    score: number;
  }>;
  reviewPackSummary?: {
    wrongCount: number;
    estimatedMinutes: number;
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
  } | null;
};

export type SubmitResultDetail = SubmitResult["details"][number];

export type ReviewPack = {
  wrongCount: number;
  generatedAt: string;
  summary: {
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
    wrongByDifficulty: Array<{ difficulty: string; count: number }>;
    wrongByType: Array<{ questionType: string; count: number }>;
    estimatedMinutes: number;
  };
  rootCauses: string[];
  actionItems: Array<{
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
  }>;
  sevenDayPlan: Array<{
    day: number;
    title: string;
    focus: string;
    estimatedMinutes: number;
  }>;
  wrongQuestions?: Array<{
    questionId: string;
    stem: string;
    knowledgePointTitle: string;
    yourAnswer: string;
    correctAnswer: string;
  }>;
};

export type LocalDraft = {
  answers: Record<string, string>;
  updatedAt: string;
  clientStartedAt?: string;
};

export type StudentExamStageCopy = {
  title: string;
  description: string;
};

export type StudentExamSubmitTrigger = "manual" | "timeout";
