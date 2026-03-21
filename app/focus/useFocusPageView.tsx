"use client";

import { useMemo } from "react";
import type { FocusMode } from "./types";
import { useFocusPage } from "./useFocusPage";

export function useFocusPageView() {
  const page = useFocusPage();

  const presets = useMemo(
    () => (page.mode === "focus" ? [15, 25, 40] : [5, 10, 15]),
    [page.mode]
  );

  const remainingTimeLabel = useMemo(() => {
    if (!page.secondsLeft) {
      return "--:--";
    }
    return `${Math.floor(page.secondsLeft / 60)}:${String(page.secondsLeft % 60).padStart(2, "0")}`;
  }, [page.secondsLeft]);

  return {
    mode: page.mode,
    duration: page.duration,
    running: page.running,
    saving: page.saving,
    authRequired: page.authRequired,
    pageError: page.pageError,
    presets,
    remainingTimeLabel,
    recentItems: page.summary?.recent ?? [],
    hasRecentItems: (page.summary?.recent?.length ?? 0) > 0,
    summaryStats: {
      todayMinutes: page.summary?.summary.todayMinutes ?? 0,
      weekMinutes: page.summary?.summary.weekMinutes ?? 0,
      streakDays: page.summary?.summary.streakDays ?? 0
    },
    suggestion: page.summary?.suggestion ?? "保持节奏，坚持专注。",
    onModeChange: (nextMode: FocusMode) => {
      page.updateMode(nextMode);
    },
    onDurationChange: (nextDuration: number) => {
      page.updateDuration(nextDuration);
    },
    onStartTimer: page.startTimer,
    onStopTimer: page.stopTimer,
    onCompleteSession: () => {
      void page.completeSession();
    },
    onReloadSummary: () => {
      void page.loadSummary();
    }
  };
}
