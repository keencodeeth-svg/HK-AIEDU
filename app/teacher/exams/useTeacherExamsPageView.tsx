"use client";

import type { ComponentProps } from "react";
import { SUBJECT_LABELS } from "@/lib/constants";
import TeacherExamsFiltersCard from "./_components/TeacherExamsFiltersCard";
import TeacherExamsOpsCard from "./_components/TeacherExamsOpsCard";
import TeacherExamsQueueCard from "./_components/TeacherExamsQueueCard";
import { formatLoadedTime } from "./utils";
import { useTeacherExamsPage } from "./useTeacherExamsPage";

export function useTeacherExamsPageView() {
  const page = useTeacherExamsPage();

  const filtersCardProps: ComponentProps<typeof TeacherExamsFiltersCard> = {
    classFilter: page.classFilter,
    status: page.status,
    keyword: page.keyword,
    classOptions: page.classOptions,
    selectedClass: page.selectedClass,
    hasActiveFilters: page.hasActiveFilters,
    error: page.error,
    showRefreshError: Boolean(page.error && page.list.length),
    onClassFilterChange: page.setClassFilter,
    onStatusChange: page.setStatus,
    onKeywordChange: page.setKeyword,
    onClearFilters: page.clearFilters,
    onRefresh: () => {
      void page.load("refresh");
    }
  };

  const opsCardProps: ComponentProps<typeof TeacherExamsOpsCard> = {
    overallSummary: page.overallSummary,
    filteredSummary: page.filteredSummary,
    topPriorityExam: page.topPriorityExam,
    latestCreatedExam: page.latestCreatedExam,
    classOptionsCount: page.classOptions.length
  };

  const queueCardProps: ComponentProps<typeof TeacherExamsQueueCard> = {
    list: page.list,
    filtered: page.filtered,
    topPriorityExam: page.topPriorityExam,
    now: page.now,
    onClearFilters: page.clearFilters
  };

  const selectedClassChipLabel = page.selectedClass
    ? `${page.selectedClass.name} · ${SUBJECT_LABELS[page.selectedClass.subject] ?? page.selectedClass.subject}`
    : null;

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasExams: page.list.length > 0,
    pageError: page.error,
    totalCount: page.overallSummary.total,
    publishedCount: page.overallSummary.published,
    dueSoonCount: page.overallSummary.dueSoon,
    filteredCount: page.filteredSummary.total,
    selectedClassChipLabel,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    refreshing: page.refreshing,
    refreshDisabled: page.loading || page.refreshing,
    refresh: () => {
      void page.load("refresh");
    },
    reload: () => {
      void page.load();
    },
    filtersCardProps,
    opsCardProps,
    queueCardProps
  };
}
