import { useCallback, useRef, useState } from "react";
import type { ScheduleResponse } from "@/lib/class-schedules";
import type {
  EntryCategory,
  EntryViewMode,
  JoinMessage,
  JoinRequest,
  MotivationPayload,
  PlanItem,
  StudentRadarSnapshot,
  TodayTaskPayload
} from "./types";
import { STUDENT_DASHBOARD_GUIDE_KEY } from "./utils";

type ScheduleData = NonNullable<ScheduleResponse["data"]>;

export function useStudentDashboardPageState() {
  const trackedTaskExposureRef = useRef<string | null>(null);
  const hasDashboardSnapshotRef = useRef(false);
  const dashboardRequestIdRef = useRef(0);
  const joinRequestsRequestIdRef = useRef(0);
  const todayTasksRequestIdRef = useRef(0);
  const radarRequestIdRef = useRef(0);
  const scheduleRequestIdRef = useRef(0);
  const joinClassRequestIdRef = useRef(0);
  const refreshPlanRequestIdRef = useRef(0);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [motivation, setMotivation] = useState<MotivationPayload | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTaskPayload | null>(null);
  const [radarSnapshot, setRadarSnapshot] = useState<StudentRadarSnapshot | null>(null);
  const [todayTaskError, setTodayTaskError] = useState<string | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const [scheduleLastLoadedAt, setScheduleLastLoadedAt] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState<JoinMessage | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<EntryCategory>("priority");
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [entryViewMode, setEntryViewMode] = useState<EntryViewMode>("compact");
  const [showDashboardGuide, setShowDashboardGuide] = useState(true);

  const clearDashboardState = useCallback(() => {
    hasDashboardSnapshotRef.current = false;
    trackedTaskExposureRef.current = null;
    setPlan([]);
    setMotivation(null);
    setTodayTasks(null);
    setRadarSnapshot(null);
    setTodayTaskError(null);
    setRadarError(null);
    setSchedule(null);
    setScheduleError(null);
    setScheduleLastLoadedAt(null);
    setJoinMessage(null);
    setJoinRequests([]);
    setPageError(null);
    setLastLoadedAt(null);
  }, []);

  const invalidateStudentDashboardRequests = useCallback(() => {
    dashboardRequestIdRef.current += 1;
    joinRequestsRequestIdRef.current += 1;
    todayTasksRequestIdRef.current += 1;
    radarRequestIdRef.current += 1;
    scheduleRequestIdRef.current += 1;
    joinClassRequestIdRef.current += 1;
    refreshPlanRequestIdRef.current += 1;
  }, []);

  const handleAuthRequired = useCallback(() => {
    invalidateStudentDashboardRequests();
    clearDashboardState();
    setLoading(false);
    setRefreshing(false);
    setScheduleLoading(false);
    setScheduleRefreshing(false);
    setAuthRequired(true);
  }, [clearDashboardState, invalidateStudentDashboardRequests]);

  const hideDashboardGuide = useCallback(() => {
    setShowDashboardGuide(false);
    try {
      window.localStorage.setItem(STUDENT_DASHBOARD_GUIDE_KEY, "hidden");
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const showDashboardGuideAgain = useCallback(() => {
    setShowDashboardGuide(true);
    try {
      window.localStorage.removeItem(STUDENT_DASHBOARD_GUIDE_KEY);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  return {
    trackedTaskExposureRef,
    hasDashboardSnapshotRef,
    dashboardRequestIdRef,
    joinRequestsRequestIdRef,
    todayTasksRequestIdRef,
    radarRequestIdRef,
    scheduleRequestIdRef,
    joinClassRequestIdRef,
    refreshPlanRequestIdRef,
    plan,
    motivation,
    todayTasks,
    radarSnapshot,
    todayTaskError,
    radarError,
    schedule,
    scheduleError,
    scheduleLoading,
    scheduleRefreshing,
    scheduleLastLoadedAt,
    joinCode,
    joinMessage,
    joinRequests,
    loading,
    refreshing,
    pageError,
    authRequired,
    lastLoadedAt,
    activeCategory,
    showAllEntries,
    entryViewMode,
    showDashboardGuide,
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
    setJoinCode,
    setJoinMessage,
    setJoinRequests,
    setLoading,
    setRefreshing,
    setPageError,
    setAuthRequired,
    setLastLoadedAt,
    setActiveCategory,
    setShowAllEntries,
    setEntryViewMode,
    setShowDashboardGuide,
    clearDashboardState,
    invalidateStudentDashboardRequests,
    handleAuthRequired,
    hideDashboardGuide,
    showDashboardGuideAgain
  };
}
