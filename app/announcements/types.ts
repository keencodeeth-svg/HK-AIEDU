export type AppUserRole = "student" | "teacher" | "parent" | "admin" | "school_admin" | null;

export type AnnouncementItem = {
  id: string;
  classId: string;
  className?: string;
  classSubject?: string;
  classGrade?: string;
  title: string;
  content: string;
  createdAt: string;
};

export type AnnouncementClassOption = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  studentCount?: number;
  assignmentCount?: number;
};

export type AnnouncementListResponse = {
  data?: AnnouncementItem[];
  error?: string;
};

export type AnnouncementClassListResponse = {
  data?: AnnouncementClassOption[];
};

export type AnnouncementSubmitResponse = {
  data?: AnnouncementItem;
  error?: string;
};

export type AuthMeResponse = {
  user?: {
    role?: AppUserRole;
  } | null;
};

export type AnnouncementLoadStatus = "loaded" | "auth" | "error" | "stale";
