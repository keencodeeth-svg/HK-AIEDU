"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import CalendarNextLessonCard from "./_components/CalendarNextLessonCard";
import CalendarTimelineCard from "./_components/CalendarTimelineCard";
import CalendarTodayOverviewCard from "./_components/CalendarTodayOverviewCard";
import CalendarWeeklyScheduleCard from "./_components/CalendarWeeklyScheduleCard";
import { useCalendarPage } from "./useCalendarPage";

export function useCalendarPageView() {
  const page = useCalendarPage();

  const nextLessonCardProps: ComponentProps<typeof CalendarNextLessonCard> = {
    nextLesson: page.schedule?.nextLesson ?? null,
    isTeacher: page.isTeacher,
    activeComposerKey: page.activeComposerKey,
    emptyStateAction: page.emptyStateAction,
    supplementalAction: page.supplementalAction,
    onOpenComposer: page.setActiveComposerKey,
    onCloseComposer: () => page.setActiveComposerKey(null),
    onCreated: () => {
      void page.loadPage("refresh");
    }
  };

  const todayOverviewCardProps: ComponentProps<typeof CalendarTodayOverviewCard> = {
    summary: page.schedule?.summary ?? null,
    todayLessons: page.schedule?.todayLessons ?? [],
    isTeacher: page.isTeacher
  };

  const weeklyScheduleCardProps: ComponentProps<typeof CalendarWeeklyScheduleCard> = {
    weekly: page.schedule?.weekly ?? [],
    isTeacher: page.isTeacher,
    activeComposerKey: page.activeComposerKey,
    onOpenComposer: page.setActiveComposerKey,
    onCloseComposer: () => page.setActiveComposerKey(null),
    onCreated: () => {
      void page.loadPage("refresh");
    }
  };

  const timelineCardProps: ComponentProps<typeof CalendarTimelineCard> = {
    items: page.items
  };

  return {
    schedule: page.schedule,
    items: page.items,
    loading: page.loading,
    refreshing: page.refreshing,
    authRequired: page.authRequired,
    pageError: page.pageError,
    hasSchedule: Boolean(page.schedule),
    hasTimelineItems: page.items.length > 0,
    isTeacher: page.isTeacher,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    headerDescription: page.isTeacher
      ? "先看下一节课，再直接从课表布置预习任务，学生首页会自动联动。"
      : "把固定课程、今日节次和学习任务放到同一视图里，减少来回切页找信息。",
    nextLessonCardProps,
    todayOverviewCardProps,
    weeklyScheduleCardProps,
    timelineCardProps,
    reload: () => {
      void page.loadPage("refresh");
    },
    loadInitial: () => {
      void page.loadPage("initial");
    }
  };
}
