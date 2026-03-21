import { useCallback, useMemo, useRef, useState } from "react";
import type { ReportProfileResponse, ReportSortMode, WeeklyReportResponse } from "./types";
import { getReportPageDerivedState } from "./utils";

export function useReportPageState() {
  const loadRequestIdRef = useRef(0);
  const hasReportSnapshotRef = useRef(false);
  const hasProfileSnapshotRef = useRef(false);

  const [report, setReport] = useState<WeeklyReportResponse | null>(null);
  const [profile, setProfile] = useState<ReportProfileResponse | null>(null);
  const [trackedReportView, setTrackedReportView] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [sortMode, setSortMode] = useState<ReportSortMode>("ratio-asc");
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearReportState = useCallback(() => {
    hasReportSnapshotRef.current = false;
    setReport(null);
    setReportError(null);
  }, []);

  const clearProfileState = useCallback(() => {
    hasProfileSnapshotRef.current = false;
    setProfile(null);
    setProfileError(null);
    setSubjectFilter("all");
    setChapterFilter("all");
  }, []);

  const clearReportPageState = useCallback(() => {
    clearReportState();
    clearProfileState();
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearProfileState, clearReportState]);

  const handleAuthRequired = useCallback(() => {
    clearReportPageState();
    setAuthRequired(true);
  }, [clearReportPageState]);

  const derivedState = useMemo(
    () =>
      getReportPageDerivedState({
        profile,
        subjectFilter,
        chapterFilter
      }),
    [chapterFilter, profile, subjectFilter]
  );

  return {
    loadRequestIdRef,
    hasReportSnapshotRef,
    hasProfileSnapshotRef,
    report,
    profile,
    trackedReportView,
    subjectFilter,
    chapterFilter,
    sortMode,
    loading,
    authRequired,
    pageError,
    reportError,
    profileError,
    lastLoadedAt,
    profileData: derivedState.profileData,
    displaySubjects: derivedState.displaySubjects,
    chapterOptions: derivedState.chapterOptions,
    resolvedSubjectFilter: derivedState.resolvedSubjectFilter,
    resolvedChapterFilter: derivedState.resolvedChapterFilter,
    setReport,
    setProfile,
    setTrackedReportView,
    setSubjectFilter,
    setChapterFilter,
    setSortMode,
    setLoading,
    setAuthRequired,
    setPageError,
    setReportError,
    setProfileError,
    setLastLoadedAt,
    clearReportState,
    clearProfileState,
    clearReportPageState,
    handleAuthRequired
  };
}
