import { useCallback, useMemo } from "react";
import { useStudentDashboardActions } from "./useStudentDashboardActions";
import { useStudentDashboardPageEffects } from "./useStudentDashboardPageEffects";
import { useStudentDashboardLoaders } from "./useStudentDashboardLoaders";
import { useStudentDashboardPageState } from "./useStudentDashboardPageState";
import { getStudentDashboardDerivedState } from "./utils";

export function useStudentDashboardPage() {
  const pageState = useStudentDashboardPageState();

  const {
    loadJoinRequests,
    loadTodayTasks,
    loadRadarSnapshot,
    loadSchedule,
    loadDashboard
  } = useStudentDashboardLoaders({
    dashboardRequestIdRef: pageState.dashboardRequestIdRef,
    joinRequestsRequestIdRef: pageState.joinRequestsRequestIdRef,
    todayTasksRequestIdRef: pageState.todayTasksRequestIdRef,
    radarRequestIdRef: pageState.radarRequestIdRef,
    scheduleRequestIdRef: pageState.scheduleRequestIdRef,
    hasDashboardSnapshotRef: pageState.hasDashboardSnapshotRef,
    clearDashboardState: pageState.clearDashboardState,
    handleAuthRequired: pageState.handleAuthRequired,
    setPlan: pageState.setPlan,
    setMotivation: pageState.setMotivation,
    setTodayTasks: pageState.setTodayTasks,
    setRadarSnapshot: pageState.setRadarSnapshot,
    setTodayTaskError: pageState.setTodayTaskError,
    setRadarError: pageState.setRadarError,
    setSchedule: pageState.setSchedule,
    setScheduleError: pageState.setScheduleError,
    setScheduleLoading: pageState.setScheduleLoading,
    setScheduleRefreshing: pageState.setScheduleRefreshing,
    setScheduleLastLoadedAt: pageState.setScheduleLastLoadedAt,
    setJoinRequests: pageState.setJoinRequests,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setPageError: pageState.setPageError,
    setAuthRequired: pageState.setAuthRequired,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  const refreshSchedule = useCallback(async () => {
    await loadSchedule("refresh");
  }, [loadSchedule]);

  const derivedState = useMemo(
    () =>
      getStudentDashboardDerivedState({
        plan: pageState.plan,
        motivation: pageState.motivation,
        todayTasks: pageState.todayTasks,
        schedule: pageState.schedule,
        joinRequests: pageState.joinRequests,
        activeCategory: pageState.activeCategory,
        showAllEntries: pageState.showAllEntries
      }),
    [
      pageState.activeCategory,
      pageState.joinRequests,
      pageState.motivation,
      pageState.plan,
      pageState.schedule,
      pageState.showAllEntries,
      pageState.todayTasks
    ]
  );

  const actions = useStudentDashboardActions({
    joinClassRequestIdRef: pageState.joinClassRequestIdRef,
    refreshPlanRequestIdRef: pageState.refreshPlanRequestIdRef,
    joinCode: pageState.joinCode,
    loadJoinRequests,
    loadTodayTasks,
    loadRadarSnapshot,
    handleAuthRequired: pageState.handleAuthRequired,
    setPlan: pageState.setPlan,
    setJoinCode: pageState.setJoinCode,
    setJoinMessage: pageState.setJoinMessage,
    setRefreshing: pageState.setRefreshing,
    setAuthRequired: pageState.setAuthRequired,
    setPageError: pageState.setPageError,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useStudentDashboardPageEffects({
    activeCategory: pageState.activeCategory,
    taskExposureProps: derivedState.taskExposureProps,
    trackedTaskExposureRef: pageState.trackedTaskExposureRef,
    loadDashboard,
    setShowDashboardGuide: pageState.setShowDashboardGuide,
    setShowAllEntries: pageState.setShowAllEntries
  });

  return {
    plan: pageState.plan,
    motivation: pageState.motivation,
    todayTasks: pageState.todayTasks,
    radarSnapshot: pageState.radarSnapshot,
    todayTaskError: pageState.todayTaskError,
    radarError: pageState.radarError,
    schedule: pageState.schedule,
    scheduleError: pageState.scheduleError,
    scheduleLoading: pageState.scheduleLoading,
    scheduleRefreshing: pageState.scheduleRefreshing,
    scheduleLastLoadedAt: pageState.scheduleLastLoadedAt,
    joinCode: pageState.joinCode,
    setJoinCode: pageState.setJoinCode,
    joinMessage: pageState.joinMessage,
    joinRequests: pageState.joinRequests,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    pageError: pageState.pageError,
    authRequired: pageState.authRequired,
    lastLoadedAt: pageState.lastLoadedAt,
    activeCategory: pageState.activeCategory,
    setActiveCategory: pageState.setActiveCategory,
    showAllEntries: pageState.showAllEntries,
    setShowAllEntries: pageState.setShowAllEntries,
    entryViewMode: pageState.entryViewMode,
    setEntryViewMode: pageState.setEntryViewMode,
    showDashboardGuide: pageState.showDashboardGuide,
    pendingJoinCount: derivedState.pendingJoinCount,
    totalPlanCount: derivedState.totalPlanCount,
    weakPlanCount: derivedState.weakPlanCount,
    visiblePriorityTasks: derivedState.visiblePriorityTasks,
    hiddenTodayTaskCount: derivedState.hiddenTodayTaskCount,
    categoryCounts: derivedState.categoryCounts,
    entriesByCategory: derivedState.entriesByCategory,
    visibleEntries: derivedState.visibleEntries,
    recommendedTask: derivedState.recommendedTask,
    hasDashboardData: derivedState.hasDashboardData,
    loadDashboard,
    refreshSchedule,
    handleTaskEvent: actions.handleTaskEvent,
    handleJoinClass: actions.handleJoinClass,
    refreshPlan: actions.refreshPlan,
    hideDashboardGuide: pageState.hideDashboardGuide,
    showDashboardGuideAgain: pageState.showDashboardGuideAgain
  };
}
