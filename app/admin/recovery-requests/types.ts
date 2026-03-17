export type RecoveryRole = "student" | "teacher" | "parent" | "admin" | "school_admin";
export type RecoveryIssueType = "forgot_password" | "forgot_account" | "account_locked";
export type RecoveryStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type RecoveryPriority = "urgent" | "high" | "normal";
export type RecoverySlaState = "healthy" | "at_risk" | "overdue" | "closed";
export type RecoveryFilterStatus = RecoveryStatus | "all";

export type RecoveryItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RecoveryStatus;
  role: RecoveryRole;
  email: string;
  name?: string;
  issueType: RecoveryIssueType;
  note?: string;
  studentEmail?: string;
  schoolName?: string;
  matchedUserId?: string | null;
  matchedUserRole?: string | null;
  handledByAdminId?: string | null;
  handledAt?: string | null;
  adminNote?: string;
  isOverdue: boolean;
  waitingHours: number;
  priority: RecoveryPriority;
  priorityReason: string;
  slaState: RecoverySlaState;
  targetBy: string | null;
  nextActionLabel: string;
  isUnassigned: boolean;
};

export type RecoverySummary = {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  urgent: number;
  highPriority: number;
  unassigned: number;
};

export type RecoveryListResponse = {
  data?: {
    items?: RecoveryItem[];
    summary?: RecoverySummary;
  };
};

export type RecoveryActionResponse = {
  message?: string;
  data?: RecoveryItem;
};
