export type Question = {
  id: string;
  stem: string;
  explanation: string;
  options: string[];
  answer: string;
  subject: string;
  grade: string;
  knowledgePointId: string;
};

export type WrongBookItem = Question & {
  weaknessRank?: number | null;
  lastAttemptAt?: string | null;
  nextReviewAt?: string | null;
  intervalLevel?: number | null;
  intervalLabel?: string | null;
  lastReviewResult?: "correct" | "wrong" | null;
};

export type CorrectionTask = {
  id: string;
  questionId: string;
  status: "pending" | "completed";
  dueDate: string;
  createdAt: string;
  completedAt?: string | null;
  question?: Question | null;
};

export type Summary = {
  pending: number;
  overdue: number;
  dueSoon: number;
  completed: number;
};

export type ReviewQueueQuestion = {
  id: string;
  stem: string;
  options: string[];
  subject: string;
  grade: string;
  knowledgePointId: string;
} | null;

export type ReviewQueueItem = {
  id: string;
  questionId: string;
  intervalLevel: number;
  intervalLabel: string;
  nextReviewAt: string | null;
  lastReviewResult: "correct" | "wrong" | null;
  lastReviewAt: string | null;
  reviewCount: number;
  status: "active" | "completed";
  originType: "practice" | "diagnostic" | "assignment" | "exam" | "wrong_book_review" | null;
  originLabel: string | null;
  originPaperId: string | null;
  originSubmittedAt: string | null;
  question: ReviewQueueQuestion;
};

export type ReviewQueueData = {
  summary: {
    totalActive: number;
    dueToday: number;
    overdue: number;
    upcoming: number;
  };
  today: ReviewQueueItem[];
  upcoming: ReviewQueueItem[];
};

export type CreateCorrectionSkippedItem = {
  questionId: string;
  reason: string;
};

export type WrongBookResponse = {
  data?: WrongBookItem[];
};

export type CorrectionsResponse = {
  data?: CorrectionTask[];
  summary?: Summary | null;
};

export type ReviewQueueResponse = {
  data?: ReviewQueueData | null;
};

export type CreateCorrectionResponse = {
  created?: CorrectionTask[];
  skipped?: CreateCorrectionSkippedItem[];
};

export type CorrectionMutationResponse = {
  data?: CorrectionTask;
};

export type ReviewResultResponse = {
  correct?: boolean;
  nextReviewAt?: string | null;
  review?: {
    intervalLabel?: string | null;
  } | null;
};

export type WrongBookLoadStatus = "loaded" | "partial" | "auth" | "stale" | "error";
