"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  HistoryItem,
  PreviewData,
  RuleItem,
  TeacherNotificationLoadStatus
} from "./types";
import {
  buildDraftRule,
  getTeacherNotificationMissingClassError,
  getTeacherNotificationRefreshErrors,
  getTeacherNotificationRulesRequestMessage
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadOptions = {
  silent?: boolean;
  clearOnError?: boolean;
};

type LoadPreview = (nextRule: RuleItem, options?: LoadOptions) => Promise<PreviewData | null>;
type LoadHistory = (nextClassId: string, options?: LoadOptions) => Promise<HistoryItem[]>;
type LoadAll = (mode?: "initial" | "refresh") => Promise<TeacherNotificationLoadStatus>;

type TeacherNotificationRulesActionsOptions = {
  classId: string;
  draftRule: RuleItem;
  savedRules: RuleItem[];
  isPreviewCurrent: boolean;
  classIdRef: MutableRefObject<string>;
  classChangeRequestIdRef: MutableRefObject<number>;
  actionRequestIdRef: MutableRefObject<number>;
  handleAuthRequired: () => void;
  clearNotificationScopedState: (options?: { invalidate?: boolean }) => void;
  applyClassId: (nextClassId: string) => void;
  upsertSavedRule: (nextRule: RuleItem) => void;
  loadPreview: LoadPreview;
  loadHistory: LoadHistory;
  load: LoadAll;
  setDraftRule: Setter<RuleItem>;
  setAuthRequired: Setter<boolean>;
  setMessage: Setter<string | null>;
  setActionError: Setter<string | null>;
  setSaving: Setter<boolean>;
  setRunning: Setter<boolean>;
};

type RunResponse = {
  data?: {
    students?: number;
    parents?: number;
    assignments?: number;
    dueSoonAssignments?: number;
    overdueAssignments?: number;
  };
};

function isSettledAuthError(result: PromiseSettledResult<unknown>) {
  return result.status === "rejected" && isAuthError(result.reason);
}

function getSettledError(result: PromiseSettledResult<unknown>) {
  return result.status === "rejected" ? result.reason : null;
}

export function useTeacherNotificationRulesActions({
  classId,
  draftRule,
  savedRules,
  isPreviewCurrent,
  classIdRef,
  classChangeRequestIdRef,
  actionRequestIdRef,
  handleAuthRequired,
  clearNotificationScopedState,
  applyClassId,
  upsertSavedRule,
  loadPreview,
  loadHistory,
  load,
  setDraftRule,
  setAuthRequired,
  setMessage,
  setActionError,
  setSaving,
  setRunning
}: TeacherNotificationRulesActionsOptions) {
  const isCurrentClassChange = useCallback((requestId: number, targetClassId: string) => {
    return classChangeRequestIdRef.current === requestId && classIdRef.current === targetClassId;
  }, [classChangeRequestIdRef, classIdRef]);

  const isCurrentAction = useCallback((requestId: number, targetClassId: string) => {
    return actionRequestIdRef.current === requestId && classIdRef.current === targetClassId;
  }, [actionRequestIdRef, classIdRef]);

  const handleClassChange = useCallback(async (nextClassId: string) => {
    const requestId = classChangeRequestIdRef.current + 1;
    classChangeRequestIdRef.current = requestId;
    actionRequestIdRef.current += 1;
    setSaving(false);
    setRunning(false);

    applyClassId(nextClassId);
    setMessage(null);
    setActionError(null);
    const nextDraft = buildDraftRule(nextClassId, savedRules);
    setDraftRule(nextDraft);
    clearNotificationScopedState();

    const [previewResult, historyResult] = await Promise.allSettled([
      loadPreview(nextDraft, { clearOnError: true }),
      loadHistory(nextClassId, { clearOnError: true })
    ]);

    if (!isCurrentClassChange(requestId, nextClassId)) {
      return;
    }

    if (isSettledAuthError(previewResult) || isSettledAuthError(historyResult)) {
      handleAuthRequired();
      return;
    }

    const previewError = getSettledError(previewResult);
    const historyError = getSettledError(historyResult);
    const missingClassError = getTeacherNotificationMissingClassError(
      [previewError, historyError].filter(Boolean)
    );
    if (missingClassError) {
      setActionError(getTeacherNotificationRulesRequestMessage(missingClassError, "加载失败"));
      await load("refresh");
      return;
    }

    const refreshErrors = getTeacherNotificationRefreshErrors([
      { label: "提醒预览加载失败", error: previewError },
      { label: "执行历史加载失败", error: historyError }
    ]);
    if (refreshErrors.length) {
      setActionError(refreshErrors.join("；"));
    }
  }, [
    actionRequestIdRef,
    applyClassId,
    classChangeRequestIdRef,
    clearNotificationScopedState,
    handleAuthRequired,
    isCurrentClassChange,
    load,
    loadHistory,
    loadPreview,
    savedRules,
    setActionError,
    setDraftRule,
    setMessage,
    setRunning,
    setSaving
  ]);

  const handleSave = useCallback(async () => {
    if (!classId) {
      return;
    }

    const requestId = actionRequestIdRef.current + 1;
    const targetClassId = classId;
    actionRequestIdRef.current = requestId;
    setSaving(true);
    setMessage(null);
    setActionError(null);

    try {
      const payload = await requestJson<{ data?: RuleItem }>("/api/teacher/notifications/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          enabled: draftRule.enabled,
          dueDays: draftRule.dueDays,
          overdueDays: draftRule.overdueDays,
          includeParents: draftRule.includeParents
        })
      });

      if (actionRequestIdRef.current !== requestId) {
        return;
      }

      const savedRule = payload.data;
      if (savedRule) {
        upsertSavedRule(savedRule);
      }

      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      if (savedRule) {
        setDraftRule(savedRule);
      }

      setAuthRequired(false);
      setMessage("通知规则已保存，后续运行将默认使用这套配置。");
      try {
        await loadPreview(savedRule ?? draftRule, { silent: true });
      } catch (error) {
        if (!isCurrentAction(requestId, targetClassId)) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        if (getTeacherNotificationMissingClassError([error])) {
          setActionError(getTeacherNotificationRulesRequestMessage(error, "加载失败"));
          await load("refresh");
          return;
        }
        setActionError(
          `通知规则已保存，但提醒预览刷新失败：${getTeacherNotificationRulesRequestMessage(error, "加载失败")}`
        );
      }
    } catch (error) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (getTeacherNotificationMissingClassError([error])) {
        setActionError(getTeacherNotificationRulesRequestMessage(error, "保存失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(error, "保存失败"));
    } finally {
      if (actionRequestIdRef.current === requestId) {
        setSaving(false);
      }
    }
  }, [
    actionRequestIdRef,
    classId,
    draftRule,
    handleAuthRequired,
    isCurrentAction,
    load,
    loadPreview,
    setActionError,
    setAuthRequired,
    setDraftRule,
    setMessage,
    setSaving,
    upsertSavedRule
  ]);

  const handlePreview = useCallback(async () => {
    if (!classId) {
      return;
    }

    const requestId = actionRequestIdRef.current + 1;
    const targetClassId = classId;
    actionRequestIdRef.current = requestId;
    setMessage(null);
    setActionError(null);

    try {
      await loadPreview(draftRule);
    } catch (error) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (getTeacherNotificationMissingClassError([error])) {
        setActionError(getTeacherNotificationRulesRequestMessage(error, "预览失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(error, "预览失败"));
    }
  }, [
    actionRequestIdRef,
    classId,
    draftRule,
    handleAuthRequired,
    isCurrentAction,
    load,
    loadPreview,
    setActionError,
    setMessage
  ]);

  const handleRun = useCallback(async () => {
    if (!classId) {
      return;
    }
    if (!isPreviewCurrent) {
      setActionError("请先刷新预览，确认最新草稿会触达谁，再发送提醒。");
      return;
    }

    const requestId = actionRequestIdRef.current + 1;
    const targetClassId = classId;
    actionRequestIdRef.current = requestId;
    setRunning(true);
    setMessage(null);
    setActionError(null);

    try {
      const payload = await requestJson<RunResponse>("/api/teacher/notifications/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          enabled: draftRule.enabled,
          dueDays: draftRule.dueDays,
          overdueDays: draftRule.overdueDays,
          includeParents: draftRule.includeParents
        })
      });

      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      setAuthRequired(false);
      setMessage(
        `已发送提醒：学生 ${payload.data?.students ?? 0} 条，家长 ${payload.data?.parents ?? 0} 条，覆盖作业 ${
          payload.data?.assignments ?? 0
        } 份。`
      );
      const [previewResult, historyResult] = await Promise.allSettled([
        loadPreview(draftRule, { silent: true }),
        loadHistory(classId, { silent: true })
      ]);
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      if (isSettledAuthError(previewResult) || isSettledAuthError(historyResult)) {
        handleAuthRequired();
        return;
      }

      const previewError = getSettledError(previewResult);
      const historyError = getSettledError(historyResult);
      const missingClassError = getTeacherNotificationMissingClassError(
        [previewError, historyError].filter(Boolean)
      );
      if (missingClassError) {
        setActionError(`提醒已发送，但${getTeacherNotificationRulesRequestMessage(missingClassError, "加载失败")}`);
        await load("refresh");
        return;
      }

      const refreshErrors = getTeacherNotificationRefreshErrors([
        { label: "提醒预览刷新失败", error: previewError },
        { label: "执行历史刷新失败", error: historyError }
      ]);
      if (refreshErrors.length) {
        setActionError(`提醒已发送，但${refreshErrors.join("；")}`);
      }
    } catch (error) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (getTeacherNotificationMissingClassError([error])) {
        setActionError(getTeacherNotificationRulesRequestMessage(error, "发送失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(error, "发送失败"));
    } finally {
      if (actionRequestIdRef.current === requestId) {
        setRunning(false);
      }
    }
  }, [
    actionRequestIdRef,
    classId,
    draftRule,
    handleAuthRequired,
    isPreviewCurrent,
    isCurrentAction,
    load,
    loadHistory,
    loadPreview,
    setActionError,
    setAuthRequired,
    setMessage,
    setRunning
  ]);

  const handleReset = useCallback(async () => {
    const requestId = actionRequestIdRef.current + 1;
    const targetClassId = classId;
    actionRequestIdRef.current = requestId;
    const nextDraft = buildDraftRule(classId, savedRules);
    setDraftRule(nextDraft);
    setMessage(null);
    setActionError(null);

    try {
      await loadPreview(nextDraft);
    } catch (error) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      if (getTeacherNotificationMissingClassError([error])) {
        setActionError(getTeacherNotificationRulesRequestMessage(error, "预览同步失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(error, "预览同步失败"));
    }
  }, [
    actionRequestIdRef,
    classId,
    handleAuthRequired,
    isCurrentAction,
    load,
    loadPreview,
    savedRules,
    setActionError,
    setDraftRule,
    setMessage
  ]);

  return {
    handleClassChange,
    handleSave,
    handlePreview,
    handleRun,
    handleReset
  };
}
