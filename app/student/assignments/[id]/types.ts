export type AssignmentDetail = {
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
  module?: { id: string; title: string } | null;
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  lessonLink?: {
    taskKind: "prestudy";
    lessonDate: string;
    note?: string;
    scheduleSessionId: string;
    slotLabel?: string;
    startTime?: string;
    endTime?: string;
    room?: string;
    focusSummary?: string;
  } | null;
  questions: Array<{
    id: string;
    stem: string;
    options: string[];
  }>;
  progress?: {
    status: string;
    score?: number;
    total?: number;
  } | null;
};

export type AssignmentQuestion = AssignmentDetail["questions"][number];

export type SubmitResult = {
  score: number;
  total: number;
  details: Array<{
    questionId: string;
    correct: boolean;
    answer: string;
    correctAnswer: string;
    explanation: string;
  }>;
};

export type SubmitResultDetail = SubmitResult["details"][number];

export type UploadItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  contentBase64?: string;
};

export type AssignmentReviewSubmission = {
  submissionText?: string;
};

export type AssignmentReviewQuestion = {
  id: string;
  stem: string;
  correct: boolean;
  answer?: string;
  correctAnswer: string;
  explanation: string;
};

export type AssignmentReviewItem = {
  questionId: string;
  wrongTag?: string;
  comment?: string;
};

export type AssignmentReviewSummary = {
  overallComment?: string;
};

export type AssignmentRubricLevel = {
  label: string;
  score: number;
};

export type AssignmentRubric = {
  id: string;
  title: string;
  description?: string;
  maxScore: number;
  levels?: AssignmentRubricLevel[];
};

export type AssignmentReviewRubric = {
  rubricId: string;
  score?: number;
  comment?: string;
};

export type AssignmentAiWriting = {
  scores?: {
    structure?: number;
    grammar?: number;
    vocab?: number;
  };
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  corrected?: string;
};

export type AssignmentAiReview = {
  result?: {
    score?: number;
    summary?: string;
    strengths?: string[];
    issues?: string[];
    suggestions?: string[];
    writing?: AssignmentAiWriting;
  };
};

export type AssignmentReviewPayload = {
  submission?: AssignmentReviewSubmission;
  review?: AssignmentReviewSummary;
  reviewItems?: AssignmentReviewItem[];
  questions?: AssignmentReviewQuestion[];
  rubrics?: AssignmentRubric[];
  reviewRubrics?: AssignmentReviewRubric[];
  aiReview?: AssignmentAiReview;
};

export type AssignmentLessonLink = NonNullable<AssignmentDetail["lessonLink"]>;

export type AssignmentStageCopy = {
  title: string;
  description: string;
};

export type AssignmentRefreshStatus = "ok" | "failed" | "auth" | "missing" | "stale";
