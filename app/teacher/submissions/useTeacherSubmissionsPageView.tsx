"use client";

import type { ComponentProps } from "react";
import SubmissionExecutionLoopCard from "./_components/SubmissionExecutionLoopCard";
import TeacherSubmissionsFiltersCard from "./_components/TeacherSubmissionsFiltersCard";
import TeacherSubmissionsInboxCard from "./_components/TeacherSubmissionsInboxCard";
import TeacherSubmissionsOverviewCard from "./_components/TeacherSubmissionsOverviewCard";
import { formatLoadedTime } from "./utils";
import { useTeacherSubmissionsPage } from "./useTeacherSubmissionsPage";

export function useTeacherSubmissionsPageView() {
  const page = useTeacherSubmissionsPage();

  const executionLoopCardProps: ComponentProps<typeof SubmissionExecutionLoopCard> = {
    selectedClass: page.selectedClass,
    rows: page.rows,
    now: page.now
  };

  const filtersCardProps: ComponentProps<typeof TeacherSubmissionsFiltersCard> = {
    classId: page.classId,
    status: page.status,
    keyword: page.keyword,
    classes: page.classes,
    selectedClass: page.selectedClass,
    hasActiveFilters: page.hasActiveFilters,
    error: page.error,
    showRefreshError: Boolean(page.error && page.pageReady),
    onClassChange: page.setClassId,
    onStatusChange: page.setStatus,
    onKeywordChange: page.setKeyword,
    onClearFilters: page.clearFilters,
    onRefresh: () => {
      void page.load(page.classId, "refresh");
    }
  };

  const overviewCardProps: ComponentProps<typeof TeacherSubmissionsOverviewCard> = {
    overallSummary: page.overallSummary,
    filteredSummary: page.filteredSummary,
    recentSubmittedCount: page.recentSubmittedCount,
    uniqueAssignmentCount: page.uniqueAssignmentCount
  };

  const inboxCardProps: ComponentProps<typeof TeacherSubmissionsInboxCard> = {
    loading: page.loading,
    error: page.error,
    pageReady: page.pageReady,
    rows: page.rows,
    filtered: page.filtered,
    filteredSummary: page.filteredSummary,
    onReload: () => {
      void page.load(page.classId, "refresh");
    },
    onClearFilters: page.clearFilters
  };

  return {
    authRequired: page.authRequired,
    pageError: page.pageError,
    pageLoading: page.loading && !page.pageReady && !page.authRequired,
    selectedClass: page.selectedClass,
    pendingFollowUpCount: page.overallSummary.pending + page.overallSummary.overdue,
    overdueCount: page.overallSummary.overdue,
    recentSubmittedCount: page.recentSubmittedCount,
    filteredCount: page.filteredSummary.total,
    totalCount: page.overallSummary.total,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    refreshing: page.refreshing,
    refreshDisabled: page.loading || page.refreshing,
    refresh: () => {
      void page.load(page.classId, "refresh");
    },
    reload: () => {
      void page.load(page.classId, page.pageReady ? "refresh" : "initial");
    },
    executionLoopCardProps,
    filtersCardProps,
    overviewCardProps,
    inboxCardProps
  };
}
