"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ReportProfileResponse, WeeklyReportResponse } from "./types";
import {
  getReportProfileRequestMessage,
  getWeeklyReportRequestMessage,
  isErrorResponse
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ReportPageLoadersOptions = {
  loadRequestIdRef: MutableRefObject<number>;
  hasReportSnapshotRef: MutableRefObject<boolean>;
  hasProfileSnapshotRef: MutableRefObject<boolean>;
  clearReportState: () => void;
  clearProfileState: () => void;
  handleAuthRequired: () => void;
  setReport: Setter<WeeklyReportResponse | null>;
  setProfile: Setter<ReportProfileResponse | null>;
  setLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
  setReportError: Setter<string | null>;
  setProfileError: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
};

export function useReportPageLoaders({
  loadRequestIdRef,
  hasReportSnapshotRef,
  hasProfileSnapshotRef,
  clearReportState,
  clearProfileState,
  handleAuthRequired,
  setReport,
  setProfile,
  setLoading,
  setAuthRequired,
  setPageError,
  setReportError,
  setProfileError,
  setLastLoadedAt
}: ReportPageLoadersOptions) {
  const loadPage = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

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
  }, [
    clearProfileState,
    clearReportState,
    handleAuthRequired,
    hasProfileSnapshotRef,
    hasReportSnapshotRef,
    loadRequestIdRef,
    setAuthRequired,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setProfile,
    setProfileError,
    setReport,
    setReportError
  ]);

  return {
    loadPage
  };
}
