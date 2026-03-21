export type RecoveryRole = "student" | "teacher" | "parent" | "admin" | "school_admin";

export type RecoveryIssueType = "forgot_password" | "forgot_account" | "account_locked";

export type RecoveryResponse = {
  message?: string;
  data?: {
    ticketId?: string;
    submittedAt?: string;
    duplicate?: boolean;
    serviceLevel?: string;
    nextSteps?: string[];
  };
};
