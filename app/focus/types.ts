export type FocusMode = "focus" | "break";

export type FocusSummaryStats = {
  todayMinutes: number;
  weekMinutes: number;
  focusCount: number;
  breakCount: number;
  streakDays: number;
};

export type FocusSummaryItem = {
  id: string;
  mode: FocusMode;
  durationMinutes: number;
  createdAt: string;
};

export type FocusSummary = {
  summary: FocusSummaryStats;
  recent: FocusSummaryItem[];
  suggestion: string;
};

export type FocusSummaryResponse = {
  data?: FocusSummary | null;
};
