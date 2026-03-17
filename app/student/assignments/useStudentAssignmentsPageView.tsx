"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import StudentAssignmentsKpiGrid from "./_components/StudentAssignmentsKpiGrid";
import StudentAssignmentsListCard from "./_components/StudentAssignmentsListCard";
import { getStudentAssignmentUrgencyLabel } from "./utils";
import { useStudentAssignmentsPage } from "./useStudentAssignmentsPage";

export function useStudentAssignmentsPageView() {
  const page = useStudentAssignmentsPage();

  const kpiGridProps: ComponentProps<typeof StudentAssignmentsKpiGrid> = {
    pendingCount: page.pendingCount,
    completedCount: page.completedCount,
    overdueCount: page.overdueCount
  };

  const listCardProps: ComponentProps<typeof StudentAssignmentsListCard> = {
    assignments: page.assignments,
    subjectOptions: page.subjectOptions,
    filteredAssignments: page.filteredAssignments,
    visibleAssignments: page.visibleAssignments,
    statusFilter: page.statusFilter,
    subjectFilter: page.subjectFilter,
    viewMode: page.viewMode,
    keyword: page.keyword,
    showAll: page.showAll,
    hasActiveFilters: page.hasActiveFilters,
    onStatusFilterChange: page.handleStatusFilterChange,
    onSubjectFilterChange: page.handleSubjectFilterChange,
    onViewModeChange: page.handleViewModeChange,
    onKeywordChange: page.handleKeywordChange,
    onClearFilters: page.handleClearFilters,
    onToggleShowAll: page.toggleShowAll
  };

  return {
    assignments: page.assignments,
    loading: page.loading,
    refreshing: page.refreshing,
    error: page.error,
    authRequired: page.authRequired,
    dueSoonCount: page.dueSoonCount,
    activeFilterSummary: page.activeFilterSummary,
    priorityAssignmentChipLabel: page.priorityAssignment
      ? `优先处理：${page.priorityAssignment.title} · ${
          getStudentAssignmentUrgencyLabel(page.priorityAssignment) ?? "尽快完成"
        }`
      : "当前没有待处理作业",
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    kpiGridProps,
    listCardProps,
    reload: () => {
      void page.load("refresh");
    }
  };
}
