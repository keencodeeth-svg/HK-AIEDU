"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ScheduleResponse } from "@/lib/class-schedules";
import {
  getStudentDashboardRequestMessage,
  isMissingStudentDashboardClassError
} from "./dashboard-utils";
import type {
  JoinRequest,
  MotivationPayload,
  PlanItem,
  StudentRadarSnapshot,
  StudentWeakKnowledgePointSnapshot,
  TodayTaskPayload
} from "./types";
import {
  extractStudentDashboardMotivation,
  extractStudentDashboardPlanItems,
  extractStudentDashboardRadarSnapshot
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

type MotivationResponse = MotivationPayload | { data?: MotivationPayload | null };
type JoinRequestsResponse = { data?: JoinRequest[] };
type TodayTasksResponse = { data?: TodayTaskPayload | null };
type ScheduleData = NonNullable<ScheduleResponse["data"]>;
type RadarSummaryResponse = {
  data?: {
    mastery?: {
      weakKnowledgePoints?: StudentWeakKnowledgePointSnapshot[];
    } | null;
  };
};

type StudentDashboardLoadMode = "initial" | "refresh";

type StudentDashboardLoadersOptions = {
  dashboardRequestIdRef: MutableRefObject<number>;
  joinRequestsRequestIdRef: MutableRefObject<number>;
  todayTasksRequestIdRef: MutableRefObject<number>;
  radarRequestIdRef: MutableRefObject<number>;
  scheduleRequestIdRef: MutableRefObject<number>;
  hasDashboardSnapshotRef: MutableRefObject<boolean>;
  clearDashboardState: () => void;
  handleAuthRequired: () => void;
  setPlan: Setter<PlanItem[]>;
  setMotivation: Setter<MotivationPayload | null>;
  setTodayTasks: Setter<TodayTaskPayload | null>;
  setRadarSnapshot: Setter<StudentRadarSnapshot | null>;
  setTodayTaskError: Setter<string | null>;
  setRadarError: Setter<string | null>;
  setSchedule: Setter<ScheduleData | null>;
  setScheduleError: Setter<string | null>;
  setScheduleLoading: Setter<boolean>;
  setScheduleRefreshing: Setter<boolean>;
  setScheduleLastLoadedAt: Setter<string | null>;
  setJoinRequests: Setter<JoinRequest[]>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useStudentDashboardLoaders({
  dashboardRequestIdRef,
  joinRequestsRequestIdRef,
  todayTasksRequestIdRef,
  radarRequestIdRef,
  scheduleRequestIdRef,
  hasDashboardSnapshotRef,
  clearDashboardState,
  handleAuthRequired,
  setPlan,
  setMotivation,
  setTodayTasks,
  setRadarSnapshot,
  setTodayTaskError,
  setRadarError,
  setSchedule,
  setScheduleError,
  setScheduleLoading,
  setScheduleRefreshing,
  setScheduleLastLoadedAt,
  setJoinRequests,
  setLoading,
  setRefreshing,
  setPageError,
  setAuthRequired,
  setLastLoadedAt
}: StudentDashboardLoadersOptions) {
  const loadJoinRequests = useCallback(async () => {
    const requestId = joinRequestsRequestIdRef.current + 1;
    joinRequestsRequestIdRef.current = requestId;

    try {
      const payload = await requestJson<JoinRequestsResponse>("/api/student/join-requests");
      if (joinRequestsRequestIdRef.current !== requestId) {
        return false;
      }
      setJoinRequests(payload.data ?? []);
      return true;
    } catch (nextError) {
      if (joinRequestsRequestIdRef.current !== requestId) {
        return false;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return false;
      }
      setJoinRequests([]);
      return false;
    }
  }, [handleAuthRequired, joinRequestsRequestIdRef, setJoinRequests]);

  const loadTodayTasks = useCallback(async () => {
    const requestId = todayTasksRequestIdRef.current + 1;
    todayTasksRequestIdRef.current = requestId;
    setTodayTaskError(null);

    try {
      const payload = await requestJson<TodayTasksResponse>("/api/student/today-tasks");
      if (todayTasksRequestIdRef.current !== requestId) {
        return false;
      }
      setTodayTasks(payload.data ?? null);
      return true;
    } catch (nextError) {
      if (todayTasksRequestIdRef.current !== requestId) {
        return false;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return false;
      }
      setTodayTaskError(getStudentDashboardRequestMessage(nextError, "加载今日任务失败"));
      return false;
    }
  }, [
    handleAuthRequired,
    setTodayTaskError,
    setTodayTasks,
    todayTasksRequestIdRef
  ]);

  const loadRadarSnapshot = useCallback(async () => {
    const requestId = radarRequestIdRef.current + 1;
    radarRequestIdRef.current = requestId;
    setRadarError(null);

    try {
      const payload = await requestJson<RadarSummaryResponse>("/api/student/radar");
      if (radarRequestIdRef.current !== requestId) {
        return false;
      }
      setRadarSnapshot(extractStudentDashboardRadarSnapshot(payload));
      return true;
    } catch (nextError) {
      if (radarRequestIdRef.current !== requestId) {
        return false;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return false;
      }
      setRadarError(getStudentDashboardRequestMessage(nextError, "加载学习画像摘要失败"));
      return false;
    }
  }, [handleAuthRequired, radarRequestIdRef, setRadarError, setRadarSnapshot]);

  const loadSchedule = useCallback(
    async (mode: StudentDashboardLoadMode = "initial") => {
      const requestId = scheduleRequestIdRef.current + 1;
      scheduleRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setScheduleRefreshing(true);
      } else {
        setScheduleLoading(true);
      }
      setScheduleError(null);

      try {
        const payload = await requestJson<ScheduleResponse>("/api/schedule");
        if (scheduleRequestIdRef.current !== requestId) {
          return false;
        }
        setSchedule(payload.data ?? null);
        setScheduleLastLoadedAt(new Date().toISOString());
        return true;
      } catch (nextError) {
        if (scheduleRequestIdRef.current !== requestId) {
          return false;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return false;
        }
        if (mode === "initial" || isMissingStudentDashboardClassError(nextError)) {
          setSchedule(null);
        }
        setScheduleError(getStudentDashboardRequestMessage(nextError, "加载课程表失败"));
        return false;
      } finally {
        if (scheduleRequestIdRef.current === requestId) {
          setScheduleLoading(false);
          setScheduleRefreshing(false);
        }
      }
    },
    [
      handleAuthRequired,
      scheduleRequestIdRef,
      setSchedule,
      setScheduleError,
      setScheduleLastLoadedAt,
      setScheduleLoading,
      setScheduleRefreshing
    ]
  );

  const loadDashboard = useCallback(
    async (mode: StudentDashboardLoadMode = "initial") => {
      const requestId = dashboardRequestIdRef.current + 1;
      dashboardRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const [planPayload, motivationPayload] = await Promise.all([
          requestJson<PlanResponse>("/api/plan"),
          requestJson<MotivationResponse>("/api/student/motivation"),
          loadJoinRequests(),
          loadTodayTasks(),
          loadRadarSnapshot(),
          loadSchedule(mode === "refresh" ? "refresh" : "initial")
        ]);

        if (dashboardRequestIdRef.current !== requestId) {
          return false;
        }

        setPlan(extractStudentDashboardPlanItems(planPayload));
        setMotivation(extractStudentDashboardMotivation(motivationPayload));
        hasDashboardSnapshotRef.current = true;
        setAuthRequired(false);
        setLastLoadedAt(new Date().toISOString());
        return true;
      } catch (nextError) {
        if (dashboardRequestIdRef.current !== requestId) {
          return false;
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return false;
        }

        if (
          !hasDashboardSnapshotRef.current ||
          isMissingStudentDashboardClassError(nextError)
        ) {
          clearDashboardState();
        }
        setAuthRequired(false);
        setPageError(getStudentDashboardRequestMessage(nextError, "加载学习控制台失败"));
        return false;
      } finally {
        if (dashboardRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      clearDashboardState,
      dashboardRequestIdRef,
      handleAuthRequired,
      hasDashboardSnapshotRef,
      loadJoinRequests,
      loadRadarSnapshot,
      loadSchedule,
      loadTodayTasks,
      setAuthRequired,
      setLastLoadedAt,
      setLoading,
      setMotivation,
      setPageError,
      setPlan,
      setRefreshing
    ]
  );

  return {
    loadJoinRequests,
    loadTodayTasks,
    loadRadarSnapshot,
    loadSchedule,
    loadDashboard
  };
}
