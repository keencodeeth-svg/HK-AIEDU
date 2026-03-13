export type TeacherAssignmentSubmissionType = "quiz" | "upload" | "essay";

export type TeacherAssignmentLessonLink = {
  taskKind: "prestudy";
  lessonDate: string;
  note?: string;
  scheduleSessionId: string;
  slotLabel?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  focusSummary?: string;
};

export type TeacherAssignmentStudent = {
  id: string;
  name: string;
  email: string;
  grade?: string;
  status: string;
  score: number | null;
  total: number | null;
  completedAt: string | null;
};

export type TeacherAssignmentDetailData = {
  assignment: {
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    createdAt: string;
    submissionType?: TeacherAssignmentSubmissionType;
    gradingFocus?: string;
    moduleId?: string;
  };
  module?: { id: string; title: string } | null;
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  lessonLink?: TeacherAssignmentLessonLink | null;
  students: TeacherAssignmentStudent[];
};

export type RubricLevel = {
  label: string;
  score: number;
  description: string;
};

export type RubricItem = {
  title: string;
  description?: string;
  maxScore: number;
  weight: number;
  levels: RubricLevel[];
};

export type RubricPayloadLevel = {
  label?: string;
  score?: number;
  description?: string;
};

export type RubricPayloadItem = {
  title?: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  levels?: RubricPayloadLevel[] | null;
};

export type AssignmentNotifyTarget = "missing" | "low_score" | "all";

export type AssignmentStudentFilter = "all" | "pending" | "review" | "low_score" | "completed";
