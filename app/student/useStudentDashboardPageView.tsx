"use client";

import type { ComponentProps } from "react";
import WorkspacePage, { buildStaleDataNotice } from "@/components/WorkspacePage";
import StudentDashboardGuideCard from "./_components/StudentDashboardGuideCard";
import StudentEntryCollection from "./_components/StudentEntryCollection";
import StudentExecutionSummaryCard from "./_components/StudentExecutionSummaryCard";
import StudentLearningLoopCard from "./_components/StudentLearningLoopCard";
import StudentMotivationCard from "./_components/StudentMotivationCard";
import StudentNextActionCard from "./_components/StudentNextActionCard";
import StudentPriorityTasksCard from "./_components/StudentPriorityTasksCard";
import StudentQuickTutorCard from "./_components/StudentQuickTutorCard";
import StudentScheduleCard from "./_components/StudentScheduleCard";
import StudentTaskOverviewCard from "./_components/StudentTaskOverviewCard";
import StudentUnifiedTaskQueueCard from "./_components/StudentUnifiedTaskQueueCard";
import { useStudentDashboardPage } from "./useStudentDashboardPage";

export function useStudentDashboardPageView() {
  const page = useStudentDashboardPage();

  const workspacePageProps: Omit<ComponentProps<typeof WorkspacePage>, "children"> = {
    className: "grid dashboard-stack",
    title: "学习控制台",
    subtitle: "先做什么、卡住怎么办、做完看哪里，都在这里直接推进。",
    lastLoadedAt: page.lastLoadedAt,
    chips: [
      <span key="student-term" className="chip">
        学期进行中
      </span>,
      page.todayTasks?.recentStudyVariantActivity ? (
        <span key="student-momentum" className="chip">
          Tutor 动量已同步
        </span>
      ) : null,
      page.radarSnapshot?.weakKnowledgePoint ? (
        <span key="student-portrait" className="chip">
          画像已给出薄弱点
        </span>
      ) : null
    ].filter(Boolean),
    actions: (
      <>
        <a className="button primary" href="#student-action-center">
          去第一项任务
        </a>
        <a className="button ghost" href="#student-task-queue">
          完整队列
        </a>
        <button
          className="button secondary"
          type="button"
          onClick={() => void page.loadDashboard("refresh")}
          disabled={page.loading || page.refreshing}
        >
          {page.refreshing ? "刷新中..." : "刷新"}
        </button>
      </>
    ),
    notices: page.pageError
      ? [
          buildStaleDataNotice(
            page.pageError,
            <button
              className="button secondary"
              type="button"
              onClick={() => void page.loadDashboard("refresh")}
              disabled={page.loading || page.refreshing}
            >
              再试一次
            </button>
          )
        ]
      : undefined
  };

  const nextActionCardProps: ComponentProps<typeof StudentNextActionCard> = {
    schedule: page.schedule,
    todayTasks: page.todayTasks,
    recommendedTask: page.recommendedTask,
    mustDoCount: page.todayTasks?.summary?.mustDo ?? page.visiblePriorityTasks.length,
    totalTaskCount: page.todayTasks?.summary?.total ?? page.visiblePriorityTasks.length,
    weakPlanCount: page.weakPlanCount,
    onTaskEvent: page.handleTaskEvent
  };

  const quickTutorCardProps: ComponentProps<typeof StudentQuickTutorCard> = {
    schedule: page.schedule,
    mustDoCount: page.todayTasks?.summary?.mustDo ?? page.visiblePriorityTasks.length,
    weakPlanCount: page.weakPlanCount
  };

  const priorityTasksCardProps: ComponentProps<typeof StudentPriorityTasksCard> = {
    schedule: page.schedule,
    todayTaskError: page.todayTaskError,
    visiblePriorityTasks: page.visiblePriorityTasks,
    hiddenTodayTaskCount: page.hiddenTodayTaskCount,
    onTaskEvent: page.handleTaskEvent
  };

  const taskOverviewCardProps: ComponentProps<typeof StudentTaskOverviewCard> = {
    todayTasks: page.todayTasks,
    totalPlanCount: page.totalPlanCount,
    weakPlanCount: page.weakPlanCount,
    refreshing: page.refreshing,
    onRefreshPlan: page.refreshPlan
  };

  const executionSummaryCardProps: ComponentProps<typeof StudentExecutionSummaryCard> = {
    schedule: page.schedule,
    todayTasks: page.todayTasks,
    recommendedTask: page.recommendedTask,
    weakPlanCount: page.weakPlanCount,
    onTaskEvent: page.handleTaskEvent
  };

  const scheduleCardProps: ComponentProps<typeof StudentScheduleCard> = {
    schedule: page.schedule,
    loading: page.scheduleLoading,
    refreshing: page.scheduleRefreshing,
    authRequired: page.authRequired,
    error: page.scheduleError,
    lastLoadedAt: page.scheduleLastLoadedAt,
    onRefresh: () => {
      void page.refreshSchedule();
    }
  };

  const unifiedTaskQueueCardProps: ComponentProps<typeof StudentUnifiedTaskQueueCard> = {
    schedule: page.schedule,
    todayTasks: page.todayTasks,
    todayTaskError: page.todayTaskError,
    onTaskEvent: page.handleTaskEvent
  };

  const learningLoopCardProps: ComponentProps<typeof StudentLearningLoopCard> = {
    recommendedTask: page.recommendedTask,
    todayTasks: page.todayTasks,
    radarSnapshot: page.radarSnapshot,
    onTaskEvent: page.handleTaskEvent
  };

  const motivationCardProps: ComponentProps<typeof StudentMotivationCard> = {
    motivation: page.motivation
  };

  const dashboardGuideCardProps: ComponentProps<typeof StudentDashboardGuideCard> = {
    showDashboardGuide: page.showDashboardGuide,
    onHide: page.hideDashboardGuide,
    onShow: page.showDashboardGuideAgain
  };

  const entryCollectionProps: ComponentProps<typeof StudentEntryCollection> = {
    activeCategory: page.activeCategory,
    categoryCounts: page.categoryCounts,
    showAllEntries: page.showAllEntries,
    entryViewMode: page.entryViewMode,
    entriesByCategoryCount: page.entriesByCategory.length,
    visibleEntries: page.visibleEntries,
    joinCode: page.joinCode,
    joinMessage: page.joinMessage,
    pendingJoinCount: page.pendingJoinCount,
    onCategoryChange: page.setActiveCategory,
    onToggleShowAllEntries: () => {
      page.setShowAllEntries((prev) => !prev);
    },
    onEntryViewModeChange: page.setEntryViewMode,
    onJoinClass: page.handleJoinClass,
    onJoinCodeChange: page.setJoinCode
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasDashboardData: page.hasDashboardData,
    pageError: page.pageError,
    radarError: page.radarError,
    retryDashboard: () => {
      void page.loadDashboard("refresh");
    },
    workspacePageProps,
    nextActionCardProps,
    quickTutorCardProps,
    priorityTasksCardProps,
    taskOverviewCardProps,
    executionSummaryCardProps,
    scheduleCardProps,
    unifiedTaskQueueCardProps,
    learningLoopCardProps,
    motivationCardProps,
    dashboardGuideCardProps,
    entryCollectionProps
  };
}
