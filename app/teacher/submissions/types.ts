export type SubmissionRow = {
  assignmentId: string;
  assignmentTitle: string;
  submissionType: string;
  dueDate: string;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  score: number | null;
  total: number | null;
  completedAt: string | null;
  submittedAt?: string | null;
  uploadCount: number;
};

export type SubmissionClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

export type SubmissionStatusFilter = "all" | "completed" | "pending" | "overdue";
