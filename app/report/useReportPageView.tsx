"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import { ReportHeader } from "./_components/ReportHeader";
import { ReportOverviewCard } from "./_components/ReportOverviewCard";
import { ReportProfileHeatmapCard } from "./_components/ReportProfileHeatmapCard";
import { ReportTrendCard } from "./_components/ReportTrendCard";
import { ReportWeakPointsCard } from "./_components/ReportWeakPointsCard";
import { useReportPage } from "./useReportPage";
import { getVisibleKnowledgeItems, isErrorResponse } from "./utils";

export function useReportPageView() {
  const page = useReportPage();
  const hasReportData = Boolean(page.report && !isErrorResponse(page.report));
  const hasProfileData = Boolean(page.profileData);
  const hasProfileSection = Boolean(page.profile) || Boolean(page.profileError);
  const hasAnyData = hasReportData || hasProfileData;

  const headerProps: ComponentProps<typeof ReportHeader> = {
    chipLabel: page.lastLoadedAt ? `近 7 天 · 更新于 ${formatLoadedTime(page.lastLoadedAt)}` : "近 7 天"
  };

  const overviewCardProps: ComponentProps<typeof ReportOverviewCard> = {
    stats: !page.report || isErrorResponse(page.report) ? null : page.report.stats,
    previousStats: !page.report || isErrorResponse(page.report) ? null : page.report.previousStats
  };

  const profileHeatmapCardProps: ComponentProps<typeof ReportProfileHeatmapCard> = {
    profileLoading: page.loading && !page.profile,
    hasProfileError: Boolean(page.profileError) || Boolean(page.profile && isErrorResponse(page.profile)),
    subjectGroups: page.displaySubjects.map((group) => ({
      ...group,
      filteredItems: getVisibleKnowledgeItems(group.items, page.chapterFilter, page.sortMode)
    })),
    subjectOptions: page.profileData?.subjects ?? [],
    chapterOptions: page.chapterOptions,
    subjectFilter: page.subjectFilter,
    chapterFilter: page.chapterFilter,
    sortMode: page.sortMode,
    onSubjectFilterChange: (value) => {
      page.setSubjectFilter(value);
      page.setChapterFilter("all");
    },
    onChapterFilterChange: page.setChapterFilter,
    onSortModeChange: page.setSortMode
  };

  const trendCardProps: ComponentProps<typeof ReportTrendCard> = {
    trend: !page.report || isErrorResponse(page.report) ? [] : page.report.trend ?? []
  };

  const weakPointsCardProps: ComponentProps<typeof ReportWeakPointsCard> = {
    weakPoints: !page.report || isErrorResponse(page.report) ? [] : page.report.weakPoints ?? [],
    suggestions: !page.report || isErrorResponse(page.report) ? [] : page.report.suggestions ?? []
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    pageError: page.pageError,
    reportError: page.reportError,
    profileError: page.profileError,
    hasReportData,
    hasProfileData,
    hasProfileSection,
    hasAnyData,
    report: page.report,
    headerProps,
    overviewCardProps,
    profileHeatmapCardProps,
    trendCardProps,
    weakPointsCardProps,
    reload: () => {
      void page.loadPage();
    }
  };
}
