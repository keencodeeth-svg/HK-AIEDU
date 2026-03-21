export type LoginRole = "student" | "teacher" | "parent" | "admin" | "school_admin";

export type LoginErrorPayload = {
  error?: string;
  details?: {
    remainingAttempts?: number;
    failedCount?: number;
    maxFailedAttempts?: number;
    lockUntil?: string | null;
  };
  role?: LoginRole;
};

export type LoginSuccessPayload = {
  role?: LoginRole;
  name?: string;
  message?: string;
};
