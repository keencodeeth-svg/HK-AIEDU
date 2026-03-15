import type { ClassScheduleSession } from "@/lib/class-schedules";
import type { SchoolClassRecord, SchoolUserRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import type { TeacherUnavailableSlot } from "@/lib/teacher-unavailability";

export type ScheduleViewItem = ClassScheduleSession & {
  className: string;
  subject: string;
  grade: string;
  teacherName?: string;
  teacherId: string | null;
};

export type SchoolSchedulesResponse = {
  data?: {
    summary: {
      totalSessions: number;
      activeClasses: number;
      classesWithoutScheduleCount: number;
      averageLessonsPerWeek: number;
    };
    classes: SchoolClassRecord[];
    sessions: ScheduleViewItem[];
  };
};

export type ScheduleMutationResponse = { data?: ClassScheduleSession | null; ok?: boolean };
export type SchoolSchedulesData = NonNullable<SchoolSchedulesResponse["data"]>;
export type AiMode = "fill_missing" | "replace_all";

export type AiImpactedClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacherName?: string;
  teacherId: string | null;
  requestedLessons: number;
  createdLessons: number;
  totalLessonsAfter: number;
  status: "generated" | "skipped" | "unchanged";
  reason?: string;
};

export type AiScheduleResponse = {
  data?: {
    summary: {
      targetClassCount: number;
      teacherBoundClassCount: number;
      replacedClassCount: number;
      createdSessions: number;
      requestedLessons: number;
      unresolvedLessons: number;
      skippedClassCount: number;
      untouchedClassCount: number;
      templateAppliedClassCount?: number;
      lockedPreservedSessionCount?: number;
    };
    warnings: string[];
    createdSessions: ScheduleViewItem[];
    impactedClasses: AiImpactedClass[];
    applied?: boolean;
    previewId?: string;
    operationId?: string;
    rollbackAvailable?: boolean;
    generatedAt?: string;
  };
};

export type AiOperationSummary = {
  id: string;
  createdAt: string;
  appliedAt?: string;
  mode: AiMode;
  targetClassCount: number;
  createdSessions: number;
  unresolvedLessons: number;
  lockedPreservedSessionCount: number;
  rollbackAvailable: boolean;
};

export type ScheduleTemplateResponse = { data?: SchoolScheduleTemplate[] };
export type TeacherRuleListResponse = { data?: TeacherScheduleRule[] };
export type TeacherRuleMutationResponse = { data?: TeacherScheduleRule | null };
export type TeacherUnavailableResponse = { data?: TeacherUnavailableSlot[] };
export type SchoolUsersResponse = { data?: SchoolUserRecord[] };
export type LatestAiOperationResponse = { data?: AiOperationSummary | null };
export type AiRollbackResponse = {
  data?: { operationId: string; restoredClassCount: number; restoredSessionCount: number };
};

export type TemplateFormState = {
  id?: string;
  grade: string;
  subject: string;
  weeklyLessonsPerClass: string;
  lessonDurationMinutes: string;
  periodsPerDay: string;
  dayStartTime: string;
  shortBreakMinutes: string;
  lunchBreakAfterPeriod: string;
  lunchBreakMinutes: string;
  campus: string;
  weekdays: string[];
};

export type TeacherRuleFormState = {
  id?: string;
  teacherId: string;
  weeklyMaxLessons: string;
  maxConsecutiveLessons: string;
  minCampusGapMinutes: string;
};

export type TeacherUnavailableFormState = {
  teacherId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  reason: string;
};

export type ScheduleFormState = {
  classId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  room: string;
  campus: string;
  focusSummary: string;
  note: string;
};

export type AiScheduleFormState = {
  mode: AiMode;
  weeklyLessonsPerClass: string;
  lessonDurationMinutes: string;
  periodsPerDay: string;
  dayStartTime: string;
  shortBreakMinutes: string;
  lunchBreakAfterPeriod: string;
  lunchBreakMinutes: string;
  campus: string;
  weekdays: string[];
};
