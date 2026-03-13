export type TeacherExamItem = {
  id: string;
  title: string;
  description?: string;
  publishMode: "teacher_assigned" | "targeted";
  antiCheatLevel: "off" | "basic";
  status: "published" | "closed";
  startAt?: string;
  endAt: string;
  durationMinutes?: number;
  className: string;
  classSubject: string;
  classGrade: string;
  assignedCount: number;
  submittedCount: number;
  avgScore: number;
  createdAt: string;
};

export type TeacherExamStatusFilter = "all" | "published" | "closed";
