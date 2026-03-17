"use client";

import type { ComponentProps } from "react";
import GradebookDistributionCard from "./_components/GradebookDistributionCard";
import GradebookExecutionLoopCard from "./_components/GradebookExecutionLoopCard";
import GradebookFiltersCard from "./_components/GradebookFiltersCard";
import GradebookSummaryCard from "./_components/GradebookSummaryCard";
import GradebookTableCard from "./_components/GradebookTableCard";
import GradebookTrendCard from "./_components/GradebookTrendCard";
import { useTeacherGradebookPage } from "./useTeacherGradebookPage";

export function useTeacherGradebookPageView() {
  const page = useTeacherGradebookPage();

  const executionLoopCardProps: ComponentProps<typeof GradebookExecutionLoopCard> = {
    selectedClass: page.selectedClass,
    summary: page.data?.summary ?? null,
    assignments: page.assignments,
    assignmentStatMap: page.assignmentStatMap,
    students: page.data?.students ?? [],
    trendMap: page.trendMap,
    now: page.now
  };

  const filtersCardProps: ComponentProps<typeof GradebookFiltersCard> = {
    classes: page.data?.classes ?? [],
    assignments: page.assignments,
    classId: page.classId,
    viewMode: page.viewMode,
    assignmentFilter: page.assignmentFilter,
    studentKeyword: page.studentKeyword,
    statusFilter: page.statusFilter,
    error: page.error,
    onClassChange: page.handleClassChange,
    onViewModeChange: page.setViewMode,
    onAssignmentFilterChange: page.setAssignmentFilter,
    onStudentKeywordChange: page.setStudentKeyword,
    onStatusFilterChange: page.setStatusFilter
  };

  const summaryCardProps: ComponentProps<typeof GradebookSummaryCard> = {
    summary: page.data?.summary ?? null,
    assignmentFilter: page.assignmentFilter,
    visibleAssignmentsCount: page.visibleAssignments.length,
    overdueStudentCount: page.overdueStudentCount,
    followUpStudentCount: page.followUpStudentCount,
    urgentAssignmentCount: page.urgentAssignmentCount,
    onExportCsv: page.exportCSV,
    onExportExcel: page.exportExcel
  };

  const trendCardProps: ComponentProps<typeof GradebookTrendCard> = {
    trend: page.data?.trend ?? []
  };

  const distributionCardProps: ComponentProps<typeof GradebookDistributionCard> = {
    distribution: page.data?.distribution ?? []
  };

  const tableCardProps: ComponentProps<typeof GradebookTableCard> = {
    loading: page.loading,
    viewMode: page.viewMode,
    students: page.filteredStudents,
    filteredAssignments: page.filteredAssignments,
    visibleAssignments: page.visibleAssignments,
    assignmentStatMap: page.assignmentStatMap,
    ranked: page.ranked,
    trendMap: page.trendMap,
    now: page.now
  };

  return {
    data: page.data,
    authRequired: page.authRequired,
    error: page.error,
    loading: page.loading,
    selectedClass: page.selectedClass,
    followUpStudentCount: page.followUpStudentCount,
    overdueStudentCount: page.overdueStudentCount,
    urgentAssignmentCount: page.urgentAssignmentCount,
    executionLoopCardProps,
    filtersCardProps,
    summaryCardProps,
    trendCardProps,
    distributionCardProps,
    tableCardProps,
    reload: () => {
      void page.load(page.classId || undefined);
    }
  };
}
