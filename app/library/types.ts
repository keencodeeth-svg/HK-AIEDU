import type { KnowledgePoint } from "@/lib/types";

export type LibraryItem = {
  id: string;
  title: string;
  description?: string;
  contentType: "textbook" | "courseware" | "lesson_plan";
  subject: string;
  grade: string;
  accessScope: "global" | "class";
  sourceType: "file" | "link" | "text";
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
  classId?: string;
  generatedByAi: boolean;
  createdAt: string;
  extractedKnowledgePoints: string[];
};

export type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type BatchImportSummary = {
  textbooksTotal: number;
  textbooksImported: number;
  textbooksFailed: number;
  questionsTotal: number;
  questionsImported: number;
  questionsFailed: number;
  knowledgePointsCreated: number;
};

export type LibraryMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type LibraryFacets = {
  subjects: Array<{ value: string; count: number }>;
  grades: Array<{ value: string; count: number }>;
  contentTypes: Array<{ value: string; count: number }>;
};

export type LibrarySummary = {
  textbookCount: number;
  coursewareCount: number;
  lessonPlanCount: number;
};

export type LibraryUser = {
  role?: string;
} | null;

export type LibraryImportFormState = {
  title: string;
  description: string;
  subject: string;
  grade: string;
  contentType: LibraryItem["contentType"];
  sourceType: LibraryItem["sourceType"];
  textContent: string;
  linkUrl: string;
};

export type LibraryBatchPreview = {
  textbooks: number;
  questions: number;
};

export type LibraryAiFormState = {
  classId: string;
  topic: string;
  contentType: "courseware" | "lesson_plan";
};

export type LibraryContentFilter = "all" | LibraryItem["contentType"];

export type LibraryViewMode = "compact" | "detailed";

export type LibraryContentGroup = {
  contentType: LibraryItem["contentType"];
  label: string;
  list: LibraryItem[];
};

export type LibrarySubjectGroup = {
  subject: string;
  label: string;
  list: LibraryItem[];
  contentGroups: LibraryContentGroup[];
};


export type LibraryDetailItem = LibraryItem & {
  knowledgePointIds: string[];
  accessScope: "global" | "class";
  shareToken?: string;
};

export type LibraryAnnotation = {
  id: string;
  userId: string;
  quote: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
  note?: string;
  createdAt: string;
};

export type LibraryKnowledgePoint = KnowledgePoint;

export type LibraryDetailAuthUser = {
  role?: string;
} | null;

export type LibraryDetailResponse = {
  data?: LibraryDetailItem;
  error?: string;
};

export type LibraryAnnotationListResponse = {
  data?: LibraryAnnotation[];
  error?: string;
};

export type LibraryKnowledgePointListResponse = {
  data?: LibraryKnowledgePoint[];
};

export type LibraryAuthResponse = {
  data?: LibraryDetailAuthUser;
  user?: LibraryDetailAuthUser;
};

export type LibraryShareResponse = {
  data?: {
    shareToken?: string;
    shareUrl?: string;
  };
  error?: string;
};


export type LibraryBatchImportFailedItem = {
  index: number;
  reason: string;
};

export type LibraryBatchImportResponse = {
  data?: {
    summary?: BatchImportSummary;
    textbooks?: {
      failed?: LibraryBatchImportFailedItem[];
    };
    questions?: {
      failed?: LibraryBatchImportFailedItem[];
    };
  };
  error?: string;
};

export type LibraryAiGenerateGovernance = {
  needsManualReview?: boolean;
  manualReviewReason?: string;
};

export type LibraryAiGenerateResponse = {
  data?: {
    citations?: unknown[];
    citationGovernance?: LibraryAiGenerateGovernance;
  };
  error?: string;
};

export type LibraryDeleteResponse = {
  error?: string;
};

export type LibraryListResponse = {
  data?: LibraryItem[];
  meta?: Partial<LibraryMeta>;
  facets?: Partial<LibraryFacets>;
  summary?: Partial<LibrarySummary>;
};

export type TeacherClassesResponse = {
  data?: ClassItem[];
};
