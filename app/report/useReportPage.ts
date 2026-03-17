"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ReportProfileResponse, ReportSortMode, WeeklyReportResponse } from "./types";
import {
  getChapterOptions,
  getDisplaySubjectGroups,
  getReportProfileRequestMessage,
  getWeeklyReportRequestMessage,
  isErrorResponse,
  resolveReportChapterFilter,
  resolveReportSubjectFilter
} from "./utils";

export function useReportPage() {
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

  const loadPage = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setPageError(null);
    setReportError(null);
    setProfileError(null);

    try {
      const [weeklyResult, profileResult] = await Promise.allSettled([
        requestJson<WeeklyReportResponse>("/api/report/weekly"),
        requestJson<ReportProfileResponse>("/api/report/profile")
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      const authFailed = [weeklyResult, profileResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (authFailed) {
        handleAuthRequired();
        return;
      }

      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (weeklyResult.status === "fulfilled" && !isErrorResponse(weeklyResult.value)) {
        hasReportSnapshotRef.current = true;
        setReport(weeklyResult.value);
        hasSuccess = true;
      } else {
        const nextReportError =
          weeklyResult.status === "rejected"
            ? getWeeklyReportRequestMessage(weeklyResult.reason, "加载周报失败")
            : isErrorResponse(weeklyResult.value)
              ? weeklyResult.value.error.trim() || "加载周报失败"
              : "加载周报失败";

        if (!hasReportSnapshotRef.current) {
          clearReportState();
        }
        setReportError(nextReportError);
        nextErrors.push(`周报加载失败：${nextReportError}`);
      }

      if (profileResult.status === "fulfilled" && !isErrorResponse(profileResult.value)) {
        hasProfileSnapshotRef.current = true;
        setProfile(profileResult.value);
        hasSuccess = true;
      } else {
        const nextProfileError =
          profileResult.status === "rejected"
            ? getReportProfileRequestMessage(profileResult.reason, "加载学习画像失败")
            : isErrorResponse(profileResult.value)
              ? profileResult.value.error.trim() || "加载学习画像失败"
              : "加载学习画像失败";

        if (!hasProfileSnapshotRef.current) {
          clearProfileState();
        }
        setProfileError(nextProfileError);
        nextErrors.push(`学习画像加载失败：${nextProfileError}`);
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (!hasReportSnapshotRef.current) {
        clearReportState();
      }
      if (!hasProfileSnapshotRef.current) {
        clearProfileState();
      }
      setAuthRequired(false);
      setPageError(getWeeklyReportRequestMessage(error, "加载学习报告失败"));
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [clearProfileState, clearReportState, handleAuthRequired]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!report || isErrorResponse(report) || trackedReportView) {
      return;
    }

    trackEvent({
      eventName: "report_weekly_view",
      page: "/report",
      props: {
        hasError: false,
        total: report.stats.total,
        accuracy: report.stats.accuracy
      }
    });
    setTrackedReportView(true);
  }, [report, trackedReportView]);

  const profileData = useMemo(() => (profile && !isErrorResponse(profile) ? profile : null), [profile]);

  const resolvedSubjectFilter = useMemo(
    () => resolveReportSubjectFilter(profileData, subjectFilter),
    [profileData, subjectFilter]
  );

  const displaySubjects = useMemo(
    () => getDisplaySubjectGroups(profileData, resolvedSubjectFilter),
    [profileData, resolvedSubjectFilter]
  );

  const chapterOptions = useMemo(() => getChapterOptions(displaySubjects), [displaySubjects]);

  const resolvedChapterFilter = useMemo(
    () => resolveReportChapterFilter(displaySubjects, chapterFilter),
    [chapterFilter, displaySubjects]
  );

  useEffect(() => {
    if (resolvedSubjectFilter !== subjectFilter) {
      setSubjectFilter(resolvedSubjectFilter);
    }
  }, [resolvedSubjectFilter, subjectFilter]);

  useEffect(() => {
    if (resolvedChapterFilter !== chapterFilter) {
      setChapterFilter(resolvedChapterFilter);
    }
  }, [chapterFilter, resolvedChapterFilter]);

  return {
    report,
    profile,
    loading,
    authRequired,
    pageError,
    reportError,
    profileError,
    lastLoadedAt,
    profileData,
    displaySubjects,
    chapterOptions,
    subjectFilter: resolvedSubjectFilter,
    chapterFilter: resolvedChapterFilter,
    sortMode,
    setSubjectFilter,
    setChapterFilter,
    setSortMode,
    loadPage
  };
}
