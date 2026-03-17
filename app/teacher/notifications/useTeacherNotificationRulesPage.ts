"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  ClassItem,
  HistoryItem,
  HistoryResponse,
  PreviewData,
  RuleItem,
  RuleResponse
} from "./types";
import {
  buildDraftRule,
  DEFAULT_RULE,
  getTeacherNotificationRulesRequestMessage,
  getCommandState,
  isMissingTeacherNotificationClassError,
  isSameRule
} from "./utils";

type LoadOptions = {
  silent?: boolean;
  clearOnError?: boolean;
};

type TeacherNotificationLoadStatus = "auth" | "error" | "loaded" | "stale";

export function useTeacherNotificationRulesPage() {
  const classIdRef = useRef("");
  const loadRequestIdRef = useRef(0);
  const classChangeRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const savedRulesRef = useRef<RuleItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [savedRules, setSavedRules] = useState<RuleItem[]>([]);
  const [classId, setClassId] = useState("");
  const [draftRule, setDraftRule] = useState<RuleItem>({ id: "", classId: "", ...DEFAULT_RULE });
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewRuleSnapshot, setPreviewRuleSnapshot] = useState<RuleItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<HistoryResponse["summary"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const applySavedRules = useCallback((nextRules: RuleItem[]) => {
    savedRulesRef.current = nextRules;
    setSavedRules(nextRules);
  }, []);

  const upsertSavedRule = useCallback((nextRule: RuleItem) => {
    const currentRules = savedRulesRef.current;
    const index = currentRules.findIndex((item) => item.classId === nextRule.classId);
    const nextRules =
      index >= 0
        ? currentRules.map((item, itemIndex) => (itemIndex === index ? nextRule : item))
        : [...currentRules, nextRule];

    applySavedRules(nextRules);
  }, [applySavedRules]);

  const clearNotificationScopedState = useCallback((options?: { invalidate?: boolean }) => {
    if (options?.invalidate !== false) {
      previewRequestIdRef.current += 1;
      historyRequestIdRef.current += 1;
    }
    setPreviewing(false);
    setHistoryLoading(false);
    setPreview(null);
    setPreviewRuleSnapshot(null);
    setHistory([]);
    setHistorySummary(null);
  }, []);

  const clearNotificationPageState = useCallback(() => {
    setClasses([]);
    applySavedRules([]);
    applyClassId("");
    setDraftRule({ id: "", classId: "", ...DEFAULT_RULE });
    clearNotificationScopedState();
    setMessage(null);
    setLoadError(null);
    setActionError(null);
    setLastLoadedAt(null);
  }, [applyClassId, applySavedRules, clearNotificationScopedState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    classChangeRequestIdRef.current += 1;
    actionRequestIdRef.current += 1;
    clearNotificationPageState();
    setLoading(false);
    setRefreshing(false);
    setPreviewing(false);
    setHistoryLoading(false);
    setSaving(false);
    setRunning(false);
    setAuthRequired(true);
  }, [clearNotificationPageState]);

  const loadPreview = useCallback(async (nextRule: RuleItem, options: LoadOptions = {}) => {
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
    } catch (nextError) {
      if (clearOnError && previewRequestIdRef.current === requestId) {
        setPreview(null);
        setPreviewRuleSnapshot(null);
      }
      throw nextError;
    } finally {
      if (!silent && previewRequestIdRef.current === requestId) {
        setPreviewing(false);
      }
    }
  }, []);

  const loadHistory = useCallback(async (nextClassId: string, options: LoadOptions = {}) => {
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
    } catch (nextError) {
      if (clearOnError && historyRequestIdRef.current === requestId) {
        setHistory([]);
        setHistorySummary(null);
      }
      throw nextError;
    } finally {
      if (!silent && historyRequestIdRef.current === requestId) {
        setHistoryLoading(false);
      }
    }
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<TeacherNotificationLoadStatus> => {
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
        const nextClassId =
          currentClassId && nextClasses.some((item) => item.id === currentClassId) ? currentClassId : nextClasses[0]?.id ?? "";
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

        const previewAuthError = previewResult.status === "rejected" && isAuthError(previewResult.reason);
        const historyAuthError = historyResult.status === "rejected" && isAuthError(historyResult.reason);
        if (previewAuthError || historyAuthError) {
          handleAuthRequired();
          return "auth";
        }

        const missingClassError =
          (previewResult.status === "rejected" && isMissingTeacherNotificationClassError(previewResult.reason) && previewResult.reason) ||
          (historyResult.status === "rejected" && isMissingTeacherNotificationClassError(historyResult.reason) && historyResult.reason) ||
          null;
        if (missingClassError) {
          clearNotificationScopedState();
          setLoadError(getTeacherNotificationRulesRequestMessage(missingClassError, "加载失败"));
          return "error";
        }

        const refreshErrors: string[] = [];
        if (previewResult.status === "rejected") {
          refreshErrors.push(
            `提醒预览加载失败：${getTeacherNotificationRulesRequestMessage(previewResult.reason, "加载失败")}`
          );
        }
        if (historyResult.status === "rejected") {
          refreshErrors.push(
            `执行历史加载失败：${getTeacherNotificationRulesRequestMessage(historyResult.reason, "加载失败")}`
          );
        }
        if (refreshErrors.length) {
          setLoadError(refreshErrors.join("；"));
        }
        return refreshErrors.length ? "error" : "loaded";
      } catch (nextError) {
        if (loadRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return "auth";
        } else {
          setLoadError(getTeacherNotificationRulesRequestMessage(nextError, "加载失败"));
          return "error";
        }
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyClassId, applySavedRules, clearNotificationScopedState, handleAuthRequired, loadHistory, loadPreview]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const savedRuleForClass = useMemo(() => buildDraftRule(classId, savedRules), [classId, savedRules]);
  const hasUnsavedChanges = classId ? !isSameRule(draftRule, savedRuleForClass) : false;
  const isPreviewCurrent = classId ? Boolean(previewRuleSnapshot && isSameRule(previewRuleSnapshot, draftRule)) : false;
  const configuredRuleCount = savedRules.length;
  const enabledRuleCount = savedRules.filter((item) => item.enabled).length;
  const latestHistory = history[0] ?? null;
  const latestClassResult = latestHistory?.classResults.find((entry) => entry.classId === classId) ?? latestHistory?.classResults[0] ?? null;
  const overdueAssignments = useMemo(
    () => preview?.sampleAssignments.filter((item) => item.stage === "overdue") ?? [],
    [preview?.sampleAssignments]
  );
  const dueSoonAssignments = useMemo(
    () => preview?.sampleAssignments.filter((item) => item.stage === "due_soon") ?? [],
    [preview?.sampleAssignments]
  );
  const commandState = getCommandState({ draftRule, preview, hasUnsavedChanges, isPreviewCurrent });
  const previewTargetDelta =
    latestClassResult && preview ? preview.summary.studentTargets - latestClassResult.studentTargets : null;

  const isCurrentClassChange = useCallback((requestId: number, targetClassId: string) => {
    return classChangeRequestIdRef.current === requestId && classIdRef.current === targetClassId;
  }, []);

  const isCurrentAction = useCallback((requestId: number, targetClassId: string) => {
    return actionRequestIdRef.current === requestId && classIdRef.current === targetClassId;
  }, []);

  function updateDraft(patch: Partial<RuleItem>) {
    setMessage(null);
    setActionError(null);
    setDraftRule((prev) => ({
      ...prev,
      ...patch,
      classId
    }));
  }

  async function handleClassChange(nextClassId: string) {
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

    const previewAuthError = previewResult.status === "rejected" && isAuthError(previewResult.reason);
    const historyAuthError = historyResult.status === "rejected" && isAuthError(historyResult.reason);
    if (previewAuthError || historyAuthError) {
      handleAuthRequired();
      return;
    }

    const missingClassError =
      (previewResult.status === "rejected" && isMissingTeacherNotificationClassError(previewResult.reason) && previewResult.reason) ||
      (historyResult.status === "rejected" && isMissingTeacherNotificationClassError(historyResult.reason) && historyResult.reason) ||
      null;
    if (missingClassError) {
      setActionError(getTeacherNotificationRulesRequestMessage(missingClassError, "加载失败"));
      await load("refresh");
      return;
    }

    const refreshErrors: string[] = [];
    if (previewResult.status === "rejected") {
      refreshErrors.push(
        `提醒预览加载失败：${getTeacherNotificationRulesRequestMessage(previewResult.reason, "加载失败")}`
      );
    }
    if (historyResult.status === "rejected") {
      refreshErrors.push(
        `执行历史加载失败：${getTeacherNotificationRulesRequestMessage(historyResult.reason, "加载失败")}`
      );
    }
    if (refreshErrors.length) {
      setActionError(refreshErrors.join("；"));
    }
  }

  async function handleSave() {
    if (!classId) return;

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
      } catch (nextError) {
        if (!isCurrentAction(requestId, targetClassId)) {
          return;
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }
        if (isMissingTeacherNotificationClassError(nextError)) {
          setActionError(getTeacherNotificationRulesRequestMessage(nextError, "加载失败"));
          await load("refresh");
          return;
        }
        setActionError(
          `通知规则已保存，但提醒预览刷新失败：${getTeacherNotificationRulesRequestMessage(nextError, "加载失败")}`
        );
      }
    } catch (nextError) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherNotificationClassError(nextError)) {
        setActionError(getTeacherNotificationRulesRequestMessage(nextError, "保存失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(nextError, "保存失败"));
    } finally {
      if (actionRequestIdRef.current === requestId) {
        setSaving(false);
      }
    }
  }

  async function handlePreview() {
    if (!classId) return;

    const requestId = actionRequestIdRef.current + 1;
    const targetClassId = classId;
    actionRequestIdRef.current = requestId;
    setMessage(null);
    setActionError(null);
    try {
      await loadPreview(draftRule);
    } catch (nextError) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherNotificationClassError(nextError)) {
        setActionError(getTeacherNotificationRulesRequestMessage(nextError, "预览失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(nextError, "预览失败"));
    }
  }

  async function handleRun() {
    if (!classId) return;
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
      const payload = await requestJson<{
        data?: {
          students?: number;
          parents?: number;
          assignments?: number;
          dueSoonAssignments?: number;
          overdueAssignments?: number;
        };
      }>("/api/teacher/notifications/run", {
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

      const previewAuthError = previewResult.status === "rejected" && isAuthError(previewResult.reason);
      const historyAuthError = historyResult.status === "rejected" && isAuthError(historyResult.reason);
      if (previewAuthError || historyAuthError) {
        handleAuthRequired();
        return;
      }

      const missingClassError =
        (previewResult.status === "rejected" && isMissingTeacherNotificationClassError(previewResult.reason) && previewResult.reason) ||
        (historyResult.status === "rejected" && isMissingTeacherNotificationClassError(historyResult.reason) && historyResult.reason) ||
        null;
      if (missingClassError) {
        setActionError(`提醒已发送，但${getTeacherNotificationRulesRequestMessage(missingClassError, "加载失败")}`);
        await load("refresh");
        return;
      }

      const refreshErrors: string[] = [];
      if (previewResult.status === "rejected") {
        refreshErrors.push(
          `提醒预览刷新失败：${getTeacherNotificationRulesRequestMessage(previewResult.reason, "加载失败")}`
        );
      }
      if (historyResult.status === "rejected") {
        refreshErrors.push(
          `执行历史刷新失败：${getTeacherNotificationRulesRequestMessage(historyResult.reason, "加载失败")}`
        );
      }
      if (refreshErrors.length) {
        setActionError(`提醒已发送，但${refreshErrors.join("；")}`);
      }
    } catch (nextError) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherNotificationClassError(nextError)) {
        setActionError(getTeacherNotificationRulesRequestMessage(nextError, "发送失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(nextError, "发送失败"));
    } finally {
      if (actionRequestIdRef.current === requestId) {
        setRunning(false);
      }
    }
  }

  async function handleReset() {
    const requestId = actionRequestIdRef.current + 1;
    const targetClassId = classId;
    actionRequestIdRef.current = requestId;
    const nextDraft = buildDraftRule(classId, savedRules);
    setDraftRule(nextDraft);
    setMessage(null);
    setActionError(null);
    try {
      await loadPreview(nextDraft);
    } catch (nextError) {
      if (!isCurrentAction(requestId, targetClassId)) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherNotificationClassError(nextError)) {
        setActionError(getTeacherNotificationRulesRequestMessage(nextError, "预览同步失败"));
        await load("refresh");
        return;
      }
      setActionError(getTeacherNotificationRulesRequestMessage(nextError, "预览同步失败"));
    }
  }

  return {
    classes,
    savedRules,
    classId,
    draftRule,
    preview,
    previewRuleSnapshot,
    history,
    historySummary,
    message,
    loadError,
    actionError,
    loading,
    refreshing,
    previewing,
    historyLoading,
    saving,
    running,
    authRequired,
    lastLoadedAt,
    selectedClass,
    savedRuleForClass,
    hasUnsavedChanges,
    isPreviewCurrent,
    configuredRuleCount,
    enabledRuleCount,
    latestHistory,
    latestClassResult,
    overdueAssignments,
    dueSoonAssignments,
    commandState,
    previewTargetDelta,
    updateDraft,
    handleClassChange,
    handleSave,
    handlePreview,
    handleRun,
    handleReset,
    load
  };
}
