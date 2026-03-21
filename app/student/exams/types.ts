import type { TodayTask, TodayTaskPayload } from "../types";

export type StudentExamItem = {
  id: string;
  title: string;
  description?: string;
  publishMode: "teacher_assigned" | "targeted";
  antiCheatLevel: "off" | "basic";
  examStatus: "published" | "closed";
  startAt?: string;
  endAt: string;
  durationMinutes?: number;
  className: string;
  classSubject: string;
  classGrade: string;
  status: "pending" | "in_progress" | "submitted";
  score: number | null;
  total: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  availabilityStage: "upcoming" | "open" | "ended" | "closed";
  canEnter: boolean;
  canSubmit: boolean;
  lockReason: string | null;
  startsInMs: number;
  endsInMs: number;
  serverNow: string;
};

export type StudentExamGroupedItems = {
  ongoing: StudentExamItem[];
  upcoming: StudentExamItem[];
  finished: StudentExamItem[];
  locked: StudentExamItem[];
};

export type StudentExamModuleTab = "teacher_exam" | "self_assessment";

export type StudentSelfAssessmentTask = TodayTask;

export type StudentSelfAssessmentSummary = {
  total: number;
  mustDo: number;
  highPriority: number;
};

export type StudentExamListResponse = {
  data?: StudentExamItem[];
};

export type TodayTasksResponse = {
  data?: TodayTaskPayload;
};
