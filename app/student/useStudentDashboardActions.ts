"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { trackEvent } from "@/lib/analytics-client";
import { isAuthError, requestJson } from "@/lib/client-request";
import { getStudentDashboardJoinRequestMessage, getStudentDashboardRequestMessage } from "./dashboard-utils";
import type {
  JoinMessage,
  PlanItem,
  TodayTask,
  TodayTaskEventName
} from "./types";
import {
  extractStudentDashboardPlanItems,
  getStudentDashboardJoinSuccessMessage
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type PlanResponse = {
  data?: {
    items?: PlanItem[];
    plan?: {
      items?: PlanItem[];
    };
  } | null;
  items?: PlanItem[];
};

type JoinClassResponse = {
  message?: string;
  data?: {
    message?: string;
  };
};

type StudentDashboardActionsOptions = {
  joinClassRequestIdRef: MutableRefObject<number>;
  refreshPlanRequestIdRef: MutableRefObject<number>;
  joinCode: string;
  loadJoinRequests: () => Promise<boolean>;
  loadTodayTasks: () => Promise<boolean>;
  loadRadarSnapshot: () => Promise<boolean>;
  handleAuthRequired: () => void;
  setPlan: Setter<PlanItem[]>;
  setJoinCode: Setter<string>;
  setJoinMessage: Setter<JoinMessage | null>;
  setRefreshing: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
};

export function useStudentDashboardActions({
  joinClassRequestIdRef,
  refreshPlanRequestIdRef,
  joinCode,
  loadJoinRequests,
  loadTodayTasks,
  loadRadarSnapshot,
  handleAuthRequired,
  setPlan,
  setJoinCode,
  setJoinMessage,
  setRefreshing,
  setAuthRequired,
  setPageError,
  setLastLoadedAt
}: StudentDashboardActionsOptions) {
  const handleTaskEvent = useCallback((task: TodayTask, eventName: TodayTaskEventName) => {
    trackEvent({
      eventName,
      page: "/student",
      props: {
        taskId: task.id,
        source: task.source,
        status: task.status,
        priority: task.priority,
        impactScore: task.impactScore,
        urgencyScore: task.urgencyScore,
        effortMinutes: task.effortMinutes
      }
    });
  }, []);

  const handleJoinClass = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setJoinMessage(null);

      if (!joinCode.trim()) {
        setJoinMessage({ text: "请输入邀请码后再提交。", tone: "error" });
        return;
      }

      const requestId = joinClassRequestIdRef.current + 1;
      joinClassRequestIdRef.current = requestId;

      try {
        const payload = await requestJson<JoinClassResponse>("/api/student/join-class", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: joinCode.trim() })
        });

        if (joinClassRequestIdRef.current !== requestId) {
          return;
        }

        setJoinMessage({
          text: getStudentDashboardJoinSuccessMessage(
            payload.message,
            payload.data?.message
          ),
          tone: "success"
        });
        setJoinCode("");
        await loadJoinRequests();

        if (joinClassRequestIdRef.current !== requestId) {
          return;
        }

        setAuthRequired(false);
        setPageError(null);
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (joinClassRequestIdRef.current !== requestId) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        setJoinMessage({
          text: getStudentDashboardJoinRequestMessage(nextError, "加入失败"),
          tone: "error"
        });
      }
    },
    [
      handleAuthRequired,
      joinClassRequestIdRef,
      joinCode,
      loadJoinRequests,
      setAuthRequired,
      setJoinCode,
      setJoinMessage,
      setLastLoadedAt,
      setPageError
    ]
  );

  const refreshPlan = useCallback(async () => {
    const requestId = refreshPlanRequestIdRef.current + 1;
    refreshPlanRequestIdRef.current = requestId;
    setRefreshing(true);
    setPageError(null);

    try {
      const payload = await requestJson<PlanResponse>("/api/plan/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "all" })
      });

      if (refreshPlanRequestIdRef.current !== requestId) {
        return;
      }

      setPlan(extractStudentDashboardPlanItems(payload));
      await Promise.all([loadTodayTasks(), loadRadarSnapshot()]);

      if (refreshPlanRequestIdRef.current !== requestId) {
        return;
      }

      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (refreshPlanRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      setPageError(getStudentDashboardRequestMessage(nextError, "刷新学习计划失败"));
    } finally {
      if (refreshPlanRequestIdRef.current === requestId) {
        setRefreshing(false);
      }
    }
  }, [
    handleAuthRequired,
    loadRadarSnapshot,
    loadTodayTasks,
    refreshPlanRequestIdRef,
    setAuthRequired,
    setLastLoadedAt,
    setPageError,
    setPlan,
    setRefreshing
  ]);

  return {
    handleTaskEvent,
    handleJoinClass,
    refreshPlan
  };
}
