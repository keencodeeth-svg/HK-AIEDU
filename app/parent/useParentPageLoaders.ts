"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AssignmentListItem,
  AssignmentSummary,
  CorrectionSummary,
  CorrectionTask,
  EffectSummary,
  ExecutionSummary,
  FavoriteItem,
  ParentActionItem,
  WeeklyReport
} from "./types";
import {
  getParentAssignmentsRequestMessage,
  getParentCorrectionsRequestMessage,
  getParentFavoritesRequestMessage,
  getParentReportRequestMessage,
  isParentMissingStudentContextError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ParentAssignmentsPayload = {
  data?: AssignmentListItem[];
  summary?: AssignmentSummary | null;
  execution?: ExecutionSummary | null;
  effect?: EffectSummary | null;
  reminderText?: string;
  actionItems?: ParentActionItem[];
  parentTips?: string[];
  estimatedMinutes?: number;
};

type ParentCorrectionsPayload = {
  data?: CorrectionTask[];
  summary?: CorrectionSummary | null;
};

type ParentFavoritesPayload = {
  data?: FavoriteItem[];
};

export type ParentLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "error" | "loaded" | "stale";
};

type ParentPageLoadersOptions = {
  loadRequestIdRef: MutableRefObject<number>;
  hasReportSnapshotRef: MutableRefObject<boolean>;
  hasCorrectionsSnapshotRef: MutableRefObject<boolean>;
  hasAssignmentsSnapshotRef: MutableRefObject<boolean>;
  hasFavoritesSnapshotRef: MutableRefObject<boolean>;
  clearReportState: () => void;
  clearCorrectionsState: () => void;
  clearAssignmentsState: () => void;
  clearFavoritesState: () => void;
  clearParentPageState: () => void;
  handleAuthRequired: () => void;
  setReport: Setter<WeeklyReport | null>;
  setTasks: Setter<CorrectionTask[]>;
  setSummary: Setter<CorrectionSummary | null>;
  setAssignmentList: Setter<AssignmentListItem[]>;
  setAssignmentSummary: Setter<AssignmentSummary | null>;
  setAssignmentExecution: Setter<ExecutionSummary | null>;
  setAssignmentEffect: Setter<EffectSummary | null>;
  setAssignmentReminder: Setter<string>;
  setAssignmentActionItems: Setter<ParentActionItem[]>;
  setAssignmentParentTips: Setter<string[]>;
  setAssignmentEstimatedMinutes: Setter<number>;
  setFavorites: Setter<FavoriteItem[]>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useParentPageLoaders({
  loadRequestIdRef,
  hasReportSnapshotRef,
  hasCorrectionsSnapshotRef,
  hasAssignmentsSnapshotRef,
  hasFavoritesSnapshotRef,
  clearReportState,
  clearCorrectionsState,
  clearAssignmentsState,
  clearFavoritesState,
  clearParentPageState,
  handleAuthRequired,
  setReport,
  setTasks,
  setSummary,
  setAssignmentList,
  setAssignmentSummary,
  setAssignmentExecution,
  setAssignmentEffect,
  setAssignmentReminder,
  setAssignmentActionItems,
  setAssignmentParentTips,
  setAssignmentEstimatedMinutes,
  setFavorites,
  setLoading,
  setRefreshing,
  setPageError,
  setAuthRequired,
  setLastLoadedAt
}: ParentPageLoadersOptions) {
  const loadAll = useCallback(async (mode: "initial" | "refresh" = "initial"): Promise<ParentLoadResult> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [reportResult, correctionsResult, assignmentsResult, favoritesResult] =
        await Promise.allSettled([
          requestJson<WeeklyReport>("/api/report/weekly"),
          requestJson<ParentCorrectionsPayload>("/api/corrections"),
          requestJson<ParentAssignmentsPayload>("/api/parent/assignments"),
          requestJson<ParentFavoritesPayload>("/api/parent/favorites")
        ]);

      if (loadRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }

      const results = [reportResult, correctionsResult, assignmentsResult, favoritesResult];
      const parentContextFailure = results.some(
        (result) => result.status === "rejected" && isParentMissingStudentContextError(result.reason)
      );
      const authFailure = results.some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (parentContextFailure) {
        clearParentPageState();
        setAuthRequired(false);
        const nextPageError = [
          reportResult.status === "rejected"
            ? `家长周报加载失败：${getParentReportRequestMessage(reportResult.reason, "加载家长周报失败")}`
            : null,
          correctionsResult.status === "rejected"
            ? `订正任务加载失败：${getParentCorrectionsRequestMessage(
                correctionsResult.reason,
                "加载订正任务失败"
              )}`
            : null,
          assignmentsResult.status === "rejected"
            ? `作业提醒加载失败：${getParentAssignmentsRequestMessage(
                assignmentsResult.reason,
                "加载作业提醒失败"
              )}`
            : null,
          favoritesResult.status === "rejected"
            ? `收藏题目加载失败：${getParentFavoritesRequestMessage(
                favoritesResult.reason,
                "加载收藏题目失败"
              )}`
            : null
        ]
          .filter(Boolean)
          .join("；");
        setPageError(
          nextPageError || "当前家长账号尚未绑定学生信息，绑定后即可查看孩子的学习动态。"
        );
        return { status: "error", errorMessage: nextPageError, hasSuccess: false };
      }

      if (authFailure) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (reportResult.status === "fulfilled") {
        hasReportSnapshotRef.current = true;
        setReport(reportResult.value);
        hasSuccess = true;
      } else {
        if (!hasReportSnapshotRef.current) {
          clearReportState();
        }
        nextErrors.push(
          `家长周报加载失败：${getParentReportRequestMessage(
            reportResult.reason,
            "加载家长周报失败"
          )}`
        );
      }

      if (correctionsResult.status === "fulfilled") {
        hasCorrectionsSnapshotRef.current = true;
        setTasks(correctionsResult.value.data ?? []);
        setSummary(correctionsResult.value.summary ?? null);
        hasSuccess = true;
      } else {
        if (!hasCorrectionsSnapshotRef.current) {
          clearCorrectionsState();
        }
        nextErrors.push(
          `订正任务加载失败：${getParentCorrectionsRequestMessage(
            correctionsResult.reason,
            "加载订正任务失败"
          )}`
        );
      }

      if (assignmentsResult.status === "fulfilled") {
        hasAssignmentsSnapshotRef.current = true;
        setAssignmentList(assignmentsResult.value.data ?? []);
        setAssignmentSummary(assignmentsResult.value.summary ?? null);
        setAssignmentExecution(assignmentsResult.value.execution ?? null);
        setAssignmentEffect(assignmentsResult.value.effect ?? null);
        setAssignmentReminder(assignmentsResult.value.reminderText ?? "");
        setAssignmentActionItems(assignmentsResult.value.actionItems ?? []);
        setAssignmentParentTips(assignmentsResult.value.parentTips ?? []);
        setAssignmentEstimatedMinutes(assignmentsResult.value.estimatedMinutes ?? 0);
        hasSuccess = true;
      } else {
        if (!hasAssignmentsSnapshotRef.current) {
          clearAssignmentsState();
        }
        nextErrors.push(
          `作业提醒加载失败：${getParentAssignmentsRequestMessage(
            assignmentsResult.reason,
            "加载作业提醒失败"
          )}`
        );
      }

      if (favoritesResult.status === "fulfilled") {
        hasFavoritesSnapshotRef.current = true;
        setFavorites(favoritesResult.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasFavoritesSnapshotRef.current) {
          clearFavoritesState();
        }
        nextErrors.push(
          `收藏题目加载失败：${getParentFavoritesRequestMessage(
            favoritesResult.reason,
            "加载收藏题目失败"
          )}`
        );
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }

      return {
        status: nextErrors.length ? "error" : "loaded",
        errorMessage: nextErrors.length ? nextErrors.join("；") : null,
        hasSuccess
      };
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isParentMissingStudentContextError(nextError)) {
        clearParentPageState();
        setAuthRequired(false);
        const nextPageError = getParentAssignmentsRequestMessage(nextError, "加载家长空间失败");
        setPageError(nextPageError);
        return { status: "error", errorMessage: nextPageError, hasSuccess: false };
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      if (!hasReportSnapshotRef.current) {
        clearReportState();
      }
      if (!hasCorrectionsSnapshotRef.current) {
        clearCorrectionsState();
      }
      if (!hasAssignmentsSnapshotRef.current) {
        clearAssignmentsState();
      }
      if (!hasFavoritesSnapshotRef.current) {
        clearFavoritesState();
      }

      const nextPageError = getParentReportRequestMessage(nextError, "加载家长空间失败");
      setAuthRequired(false);
      setPageError(nextPageError);
      return { status: "error", errorMessage: nextPageError, hasSuccess: false };
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    clearAssignmentsState,
    clearCorrectionsState,
    clearFavoritesState,
    clearParentPageState,
    clearReportState,
    handleAuthRequired,
    hasAssignmentsSnapshotRef,
    hasCorrectionsSnapshotRef,
    hasFavoritesSnapshotRef,
    hasReportSnapshotRef,
    loadRequestIdRef,
    setAssignmentActionItems,
    setAssignmentEffect,
    setAssignmentEstimatedMinutes,
    setAssignmentExecution,
    setAssignmentList,
    setAssignmentParentTips,
    setAssignmentReminder,
    setAssignmentSummary,
    setAuthRequired,
    setFavorites,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setRefreshing,
    setReport,
    setSummary,
    setTasks
  ]);

  return {
    loadAll
  };
}
