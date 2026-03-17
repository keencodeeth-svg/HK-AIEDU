import type { AiQualityMeta } from "@/lib/ai-types";

export type TeacherAssignmentReviewRouteParams = {
  id: string;
  studentId: string;
};

export type TeacherAssignmentSubmissionType = "quiz" | "upload" | "essay";

export type TeacherAssignmentReviewAssignment = {
  id: string;
  title: string;
  dueDate: string;
  submissionType?: TeacherAssignmentSubmissionType;
};

export type TeacherAssignmentReviewClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type TeacherAssignmentReviewStudent = {
  id: string;
  name: string;
  email: string;
};

export type TeacherAssignmentReviewSubmission = {
  answers: Record<string, string>;
  score: number;
  total: number;
  submissionText?: string;
};

export type TeacherAssignmentUpload = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  contentBase64: string;
  createdAt: string;
};

export type TeacherAssignmentReviewQuestion = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
  correctAnswer: string;
  explanation: string;
  correct: boolean;
};

export type TeacherAssignmentReviewItem = {
  questionId: string;
  wrongTag?: string;
  comment?: string;
};

export type TeacherAssignmentRubricLevel = {
  label: string;
  score: number;
  description: string;
};

export type TeacherAssignmentRubric = {
  id: string;
  title: string;
  description?: string;
  levels?: TeacherAssignmentRubricLevel[];
  maxScore: number;
  weight: number;
};

export type TeacherAssignmentReviewRubric = {
  rubricId: string;
  score: number;
  comment?: string;
};

export type TeacherAssignmentAiReviewRubricItem = {
  item: string;
  score: number;
  comment: string;
};

export type TeacherAssignmentAiReviewWriting = {
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

export type TeacherAssignmentAiReviewResult = {
  score?: number;
  summary?: string;
  strengths?: string[];
  issues?: string[];
  suggestions?: string[];
  rubric?: TeacherAssignmentAiReviewRubricItem[];
  writing?: TeacherAssignmentAiReviewWriting;
  provider?: string;
  quality?: AiQualityMeta;
  manualReviewRule?: string;
};

export type TeacherAssignmentStoredAiReview = {
  result?: TeacherAssignmentAiReviewResult | null;
  provider?: string;
};

export type TeacherAssignmentReviewSummary = {
  overallComment?: string;
};

export type TeacherAssignmentReviewData = {
  assignment: TeacherAssignmentReviewAssignment;
  class: TeacherAssignmentReviewClass;
  student: TeacherAssignmentReviewStudent;
  submission?: TeacherAssignmentReviewSubmission | null;
  uploads?: TeacherAssignmentUpload[];
  aiReview?: TeacherAssignmentStoredAiReview | null;
  questions: TeacherAssignmentReviewQuestion[];
  review: TeacherAssignmentReviewSummary | null;
  reviewItems: TeacherAssignmentReviewItem[];
  rubrics: TeacherAssignmentRubric[];
  reviewRubrics: TeacherAssignmentReviewRubric[];
};

export type TeacherAssignmentReviewItemState = Record<
  string,
  {
    wrongTag: string;
    comment: string;
  }
>;

export type TeacherAssignmentReviewRubricState = Record<
  string,
  {
    score: number;
    comment: string;
  }
>;
