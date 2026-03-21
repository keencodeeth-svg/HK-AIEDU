"use client";

import { useReportPageEffects } from "./useReportPageEffects";
import { useReportPageLoaders } from "./useReportPageLoaders";
import { useReportPageState } from "./useReportPageState";

export function useReportPage() {
  const pageState = useReportPageState();

  const { loadPage } = useReportPageLoaders({
    loadRequestIdRef: pageState.loadRequestIdRef,
    hasReportSnapshotRef: pageState.hasReportSnapshotRef,
    hasProfileSnapshotRef: pageState.hasProfileSnapshotRef,
    clearReportState: pageState.clearReportState,
    clearProfileState: pageState.clearProfileState,
    handleAuthRequired: pageState.handleAuthRequired,
    setReport: pageState.setReport,
    setProfile: pageState.setProfile,
    setLoading: pageState.setLoading,
    setAuthRequired: pageState.setAuthRequired,
    setPageError: pageState.setPageError,
    setReportError: pageState.setReportError,
    setProfileError: pageState.setProfileError,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useReportPageEffects({
    loadPage,
    report: pageState.report,
    trackedReportView: pageState.trackedReportView,
    setTrackedReportView: pageState.setTrackedReportView,
    subjectFilter: pageState.subjectFilter,
    resolvedSubjectFilter: pageState.resolvedSubjectFilter,
    setSubjectFilter: pageState.setSubjectFilter,
    chapterFilter: pageState.chapterFilter,
    resolvedChapterFilter: pageState.resolvedChapterFilter,
    setChapterFilter: pageState.setChapterFilter
  });

  return {
    report: pageState.report,
    profile: pageState.profile,
    loading: pageState.loading,
    authRequired: pageState.authRequired,
    pageError: pageState.pageError,
    reportError: pageState.reportError,
    profileError: pageState.profileError,
    lastLoadedAt: pageState.lastLoadedAt,
    profileData: pageState.profileData,
    displaySubjects: pageState.displaySubjects,
    chapterOptions: pageState.chapterOptions,
    subjectFilter: pageState.resolvedSubjectFilter,
    chapterFilter: pageState.resolvedChapterFilter,
    sortMode: pageState.sortMode,
    setSubjectFilter: pageState.setSubjectFilter,
    setChapterFilter: pageState.setChapterFilter,
    setSortMode: pageState.setSortMode,
    loadPage
  };
}
