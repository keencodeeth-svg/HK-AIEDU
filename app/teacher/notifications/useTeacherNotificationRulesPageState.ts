import { useCallback, useMemo, useRef, useState } from "react";
import type { ClassItem, HistoryItem, HistoryResponse, PreviewData, RuleItem } from "./types";
import {
  buildDraftRule,
  DEFAULT_RULE,
  getTeacherNotificationRulesPageDerivedState,
  upsertTeacherNotificationRule
} from "./utils";

const EMPTY_RULES: RuleItem[] = [];

export function useTeacherNotificationRulesPageState() {
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
    applySavedRules(upsertTeacherNotificationRule(savedRulesRef.current, nextRule));
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
    applySavedRules(EMPTY_RULES);
    applyClassId("");
    setDraftRule(buildDraftRule("", EMPTY_RULES));
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

  const updateDraft = useCallback((patch: Partial<RuleItem>) => {
    setMessage(null);
    setActionError(null);
    setDraftRule((previous) => ({
      ...previous,
      ...patch,
      classId
    }));
  }, [classId]);

  const derivedState = useMemo(
    () =>
      getTeacherNotificationRulesPageDerivedState({
        classes,
        savedRules,
        classId,
        draftRule,
        preview,
        previewRuleSnapshot,
        history
      }),
    [classId, classes, draftRule, history, preview, previewRuleSnapshot, savedRules]
  );

  return {
    classIdRef,
    loadRequestIdRef,
    classChangeRequestIdRef,
    actionRequestIdRef,
    previewRequestIdRef,
    historyRequestIdRef,
    savedRulesRef,
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
    selectedClass: derivedState.selectedClass,
    savedRuleForClass: derivedState.savedRuleForClass,
    hasUnsavedChanges: derivedState.hasUnsavedChanges,
    isPreviewCurrent: derivedState.isPreviewCurrent,
    configuredRuleCount: derivedState.configuredRuleCount,
    enabledRuleCount: derivedState.enabledRuleCount,
    latestHistory: derivedState.latestHistory,
    latestClassResult: derivedState.latestClassResult,
    overdueAssignments: derivedState.overdueAssignments,
    dueSoonAssignments: derivedState.dueSoonAssignments,
    commandState: derivedState.commandState,
    previewTargetDelta: derivedState.previewTargetDelta,
    setClasses,
    setSavedRules,
    setClassId,
    setDraftRule,
    setPreview,
    setPreviewRuleSnapshot,
    setHistory,
    setHistorySummary,
    setMessage,
    setLoadError,
    setActionError,
    setLoading,
    setRefreshing,
    setPreviewing,
    setHistoryLoading,
    setSaving,
    setRunning,
    setAuthRequired,
    setLastLoadedAt,
    applyClassId,
    applySavedRules,
    upsertSavedRule,
    clearNotificationScopedState,
    clearNotificationPageState,
    handleAuthRequired,
    updateDraft
  };
}
