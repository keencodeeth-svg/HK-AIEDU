"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ClassItem,
  HistoryItem,
  HistoryResponse,
  PreviewData,
  RuleItem,
  RuleResponse,
  TeacherNotificationLoadStatus
} from "./types";
import {
  buildDraftRule,
  getTeacherNotificationMissingClassError,
  getTeacherNotificationRefreshErrors,
  getTeacherNotificationRulesRequestMessage,
  resolveTeacherNotificationClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadOptions = {
  silent?: boolean;
  clearOnError?: boolean;
};

type TeacherNotificationRulesLoadersOptions = {
  classIdRef: MutableRefObject<string>;
  loadRequestIdRef: MutableRefObject<number>;
  actionRequestIdRef: MutableRefObject<number>;
  previewRequestIdRef: MutableRefObject<number>;
  historyRequestIdRef: MutableRefObject<number>;
  handleAuthRequired: () => void;
  clearNotificationScopedState: (options?: { invalidate?: boolean }) => void;
  applySavedRules: (nextRules: RuleItem[]) => void;
  applyClassId: (nextClassId: string) => void;
  setClasses: Setter<ClassItem[]>;
  setDraftRule: Setter<RuleItem>;
  setPreview: Setter<PreviewData | null>;
  setPreviewRuleSnapshot: Setter<RuleItem | null>;
  setHistory: Setter<HistoryItem[]>;
  setHistorySummary: Setter<HistoryResponse["summary"] | null>;
  setAuthRequired: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPreviewing: Setter<boolean>;
  setHistoryLoading: Setter<boolean>;
  setSaving: Setter<boolean>;
  setRunning: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useTeacherNotificationRulesLoaders({
  classIdRef,
  loadRequestIdRef,
  actionRequestIdRef,
  previewRequestIdRef,
  historyRequestIdRef,
  handleAuthRequired,
  clearNotificationScopedState,
  applySavedRules,
  applyClassId,
  setClasses,
  setDraftRule,
  setPreview,
  setPreviewRuleSnapshot,
  setHistory,
  setHistorySummary,
  setAuthRequired,
  setLoadError,
  setLoading,
  setRefreshing,
  setPreviewing,
  setHistoryLoading,
  setSaving,
  setRunning,
  setLastLoadedAt
}: TeacherNotificationRulesLoadersOptions) {
  const loadPreview = useCallback(async (
    nextRule: RuleItem,
    options: LoadOptions = {}
  ) => {
    const { silent = false, clearOnError = false } = options;
    const requestId = ++previewRequestIdRef.current;

    if (!nextRule.classId) {
      setPreview(null);
      setPreviewRuleSnapshot(null);
      return null;
    }

    if (silent) {
      setPreviewing(false);
    } else {
      setPreviewing(true);
    }

    try {
      const payload = await requestJson<{ data?: PreviewData }>("/api/teacher/notifications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: nextRule.classId,
          enabled: nextRule.enabled,
          dueDays: nextRule.dueDays,
          overdueDays: nextRule.overdueDays,
          includeParents: nextRule.includeParents
        })
      });
      const nextPreview = payload.data ?? null;
      if (previewRequestIdRef.current !== requestId) {
        return nextPreview;
      }

      setPreview(nextPreview);
      setPreviewRuleSnapshot(nextPreview?.rule ?? nextRule);
      return nextPreview;
    } catch (error) {
      if (clearOnError && previewRequestIdRef.current === requestId) {
        setPreview(null);
        setPreviewRuleSnapshot(null);
      }
      throw error;
    } finally {
      if (!silent && previewRequestIdRef.current === requestId) {
        setPreviewing(false);
      }
    }
  }, [
    previewRequestIdRef,
    setPreview,
    setPreviewRuleSnapshot,
    setPreviewing
  ]);

  const loadHistory = useCallback(async (
    nextClassId: string,
    options: LoadOptions = {}
  ) => {
    const { silent = false, clearOnError = false } = options;
    const requestId = ++historyRequestIdRef.current;

    if (!nextClassId) {
      setHistory([]);
      setHistorySummary(null);
      return [] as HistoryItem[];
    }

    if (silent) {
      setHistoryLoading(false);
    } else {
      setHistoryLoading(true);
    }

    try {
      const payload = await requestJson<HistoryResponse>(
        `/api/teacher/notifications/history?classId=${encodeURIComponent(nextClassId)}&limit=8`
      );
      const nextHistory = payload.data ?? [];
      if (historyRequestIdRef.current !== requestId) {
        return nextHistory;
      }

      setHistory(nextHistory);
      setHistorySummary(payload.summary ?? null);
      return nextHistory;
    } catch (error) {
      if (clearOnError && historyRequestIdRef.current === requestId) {
        setHistory([]);
        setHistorySummary(null);
      }
      throw error;
    } finally {
      if (!silent && historyRequestIdRef.current === requestId) {
        setHistoryLoading(false);
      }
    }
  }, [
    historyRequestIdRef,
    setHistory,
    setHistoryLoading,
    setHistorySummary
  ]);

  const load = useCallback(async (
    mode: "initial" | "refresh" = "initial"
  ): Promise<TeacherNotificationLoadStatus> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    actionRequestIdRef.current += 1;
    setSaving(false);
    setRunning(false);

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const payload = await requestJson<RuleResponse>("/api/teacher/notifications/rules");
      if (loadRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextClasses = payload.classes ?? [];
      const nextRules = payload.rules ?? [];
      const currentClassId = classIdRef.current;
      const nextClassId = resolveTeacherNotificationClassId(currentClassId, nextClasses);
      const nextDraft = buildDraftRule(nextClassId, nextRules);
      const classChanged = nextClassId !== currentClassId;

      setAuthRequired(false);
      setClasses(nextClasses);
      applySavedRules(nextRules);
      applyClassId(nextClassId);
      setDraftRule(nextDraft);
      setLastLoadedAt(new Date().toISOString());

      const [previewResult, historyResult] = await Promise.allSettled([
        loadPreview(nextDraft, { silent: true, clearOnError: classChanged }),
        loadHistory(nextClassId, { silent: true, clearOnError: classChanged })
      ]);
      if (loadRequestIdRef.current !== requestId) {
        return "stale";
      }

      const previewError = previewResult.status === "rejected" ? previewResult.reason : null;
      const historyError = historyResult.status === "rejected" ? historyResult.reason : null;
      if ((previewError && isAuthError(previewError)) || (historyError && isAuthError(historyError))) {
        handleAuthRequired();
        return "auth";
      }

      const missingClassError = getTeacherNotificationMissingClassError([
        previewError,
        historyError
      ].filter(Boolean));
      if (missingClassError) {
        clearNotificationScopedState();
        setLoadError(getTeacherNotificationRulesRequestMessage(missingClassError, "加载失败"));
        return "error";
      }

      const refreshErrors = getTeacherNotificationRefreshErrors([
        { label: "提醒预览加载失败", error: previewError },
        { label: "执行历史加载失败", error: historyError }
      ]);
      if (refreshErrors.length) {
        setLoadError(refreshErrors.join("；"));
      }
      return refreshErrors.length ? "error" : "loaded";
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return "stale";
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      setLoadError(getTeacherNotificationRulesRequestMessage(error, "加载失败"));
      return "error";
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    actionRequestIdRef,
    applyClassId,
    applySavedRules,
    classIdRef,
    clearNotificationScopedState,
    handleAuthRequired,
    loadHistory,
    loadPreview,
    loadRequestIdRef,
    setAuthRequired,
    setClasses,
    setDraftRule,
    setLastLoadedAt,
    setLoadError,
    setLoading,
    setRefreshing,
    setRunning,
    setSaving
  ]);

  return {
    loadPreview,
    loadHistory,
    load
  };
}
