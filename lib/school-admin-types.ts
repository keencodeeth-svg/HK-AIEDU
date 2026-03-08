export type SchoolUserRole = "teacher" | "student" | "parent" | "school_admin";
export type SchoolActionTone = "critical" | "warning" | "info" | "success";

export type SchoolActionItem = {
  id: string;
  tone: SchoolActionTone;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  count?: number;
};

export type SchoolAttentionClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacherId: string | null;
  teacherName?: string;
  studentCount: number;
  assignmentCount: number;
  issueTags: string[];
};

export type SchoolOverview = {
  schoolId: string;
  teacherCount: number;
  studentCount: number;
  parentCount: number;
  classCount: number;
  assignmentCount: number;
  classesWithoutTeacherCount: number;
  classesWithoutStudentsCount: number;
  classesWithoutAssignmentsCount: number;
  overloadedClassCount: number;
  averageStudentsPerClass: number;
  averageAssignmentsPerClass: number;
  teacherCoverageRate: number;
  assignmentCoverageRate: number;
  actionItems: SchoolActionItem[];
  attentionClasses: SchoolAttentionClass[];
};

export type SchoolUserRecord = {
  id: string;
  name: string;
  email: string;
  role: SchoolUserRole;
  grade?: string;
  createdAt?: string;
};

export type SchoolClassRecord = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacherId: string | null;
  teacherName?: string;
  studentCount: number;
  assignmentCount: number;
  createdAt: string;
};
