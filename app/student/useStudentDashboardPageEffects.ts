import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics-client";
import type { EntryCategory } from "./types";
import type { StudentDashboardTaskExposureProps } from "./utils";
import { STUDENT_DASHBOARD_GUIDE_KEY } from "./utils";

type StudentDashboardPageEffectsOptions = {
  activeCategory: EntryCategory;
  taskExposureProps: StudentDashboardTaskExposureProps[];
  trackedTaskExposureRef: { current: string | null };
  loadDashboard: () => Promise<boolean>;
  setShowDashboardGuide: (value: boolean) => void;
  setShowAllEntries: (value: boolean) => void;
};

export function useStudentDashboardPageEffects({
  activeCategory,
  taskExposureProps,
  trackedTaskExposureRef,
  loadDashboard,
  setShowDashboardGuide,
  setShowAllEntries
}: StudentDashboardPageEffectsOptions) {
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    try {
      const hidden = window.localStorage.getItem(STUDENT_DASHBOARD_GUIDE_KEY) === "hidden";
      setShowDashboardGuide(!hidden);
    } catch {
      setShowDashboardGuide(true);
    }
  }, [setShowDashboardGuide]);

  useEffect(() => {
    setShowAllEntries(false);
  }, [activeCategory, setShowAllEntries]);

  useEffect(() => {
    if (taskExposureProps.length === 0) {
      return;
    }
    const generatedAt = taskExposureProps[0]?.generatedAt;
    if (!generatedAt || trackedTaskExposureRef.current === generatedAt) {
      return;
    }
    trackedTaskExposureRef.current = generatedAt;
    taskExposureProps.forEach((task) => {
      trackEvent({
        eventName: "task_exposed",
        page: "/student",
        props: {
          taskId: task.taskId,
          source: task.source,
          rank: task.rank,
          priority: task.priority,
          impactScore: task.impactScore,
          urgencyScore: task.urgencyScore,
          effortMinutes: task.effortMinutes
        }
      });
    });
  }, [taskExposureProps, trackedTaskExposureRef]);
}
