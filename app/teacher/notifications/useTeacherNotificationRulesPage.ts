"use client";

import { useTeacherNotificationRulesActions } from "./useTeacherNotificationRulesActions";
import { useTeacherNotificationRulesPageEffects } from "./useTeacherNotificationRulesPageEffects";
import { useTeacherNotificationRulesLoaders } from "./useTeacherNotificationRulesLoaders";
import { useTeacherNotificationRulesPageState } from "./useTeacherNotificationRulesPageState";

export function useTeacherNotificationRulesPage() {
  const pageState = useTeacherNotificationRulesPageState();

  const { loadPreview, loadHistory, load } = useTeacherNotificationRulesLoaders({
    classIdRef: pageState.classIdRef,
    loadRequestIdRef: pageState.loadRequestIdRef,
    actionRequestIdRef: pageState.actionRequestIdRef,
    previewRequestIdRef: pageState.previewRequestIdRef,
    historyRequestIdRef: pageState.historyRequestIdRef,
    handleAuthRequired: pageState.handleAuthRequired,
    clearNotificationScopedState: pageState.clearNotificationScopedState,
    applySavedRules: pageState.applySavedRules,
    applyClassId: pageState.applyClassId,
    setClasses: pageState.setClasses,
    setDraftRule: pageState.setDraftRule,
    setPreview: pageState.setPreview,
    setPreviewRuleSnapshot: pageState.setPreviewRuleSnapshot,
    setHistory: pageState.setHistory,
    setHistorySummary: pageState.setHistorySummary,
    setAuthRequired: pageState.setAuthRequired,
    setLoadError: pageState.setLoadError,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setPreviewing: pageState.setPreviewing,
    setHistoryLoading: pageState.setHistoryLoading,
    setSaving: pageState.setSaving,
    setRunning: pageState.setRunning,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useTeacherNotificationRulesPageEffects({
    load
  });

  const actions = useTeacherNotificationRulesActions({
    classId: pageState.classId,
    draftRule: pageState.draftRule,
    savedRules: pageState.savedRules,
    isPreviewCurrent: pageState.isPreviewCurrent,
    classIdRef: pageState.classIdRef,
    classChangeRequestIdRef: pageState.classChangeRequestIdRef,
    actionRequestIdRef: pageState.actionRequestIdRef,
    handleAuthRequired: pageState.handleAuthRequired,
    clearNotificationScopedState: pageState.clearNotificationScopedState,
    applyClassId: pageState.applyClassId,
    upsertSavedRule: pageState.upsertSavedRule,
    loadPreview,
    loadHistory,
    load,
    setDraftRule: pageState.setDraftRule,
    setAuthRequired: pageState.setAuthRequired,
    setMessage: pageState.setMessage,
    setActionError: pageState.setActionError,
    setSaving: pageState.setSaving,
    setRunning: pageState.setRunning
  });

  return {
    classes: pageState.classes,
    savedRules: pageState.savedRules,
    classId: pageState.classId,
    draftRule: pageState.draftRule,
    preview: pageState.preview,
    previewRuleSnapshot: pageState.previewRuleSnapshot,
    history: pageState.history,
    historySummary: pageState.historySummary,
    message: pageState.message,
    loadError: pageState.loadError,
    actionError: pageState.actionError,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    previewing: pageState.previewing,
    historyLoading: pageState.historyLoading,
    saving: pageState.saving,
    running: pageState.running,
    authRequired: pageState.authRequired,
    lastLoadedAt: pageState.lastLoadedAt,
    selectedClass: pageState.selectedClass,
    savedRuleForClass: pageState.savedRuleForClass,
    hasUnsavedChanges: pageState.hasUnsavedChanges,
    isPreviewCurrent: pageState.isPreviewCurrent,
    configuredRuleCount: pageState.configuredRuleCount,
    enabledRuleCount: pageState.enabledRuleCount,
    latestHistory: pageState.latestHistory,
    latestClassResult: pageState.latestClassResult,
    overdueAssignments: pageState.overdueAssignments,
    dueSoonAssignments: pageState.dueSoonAssignments,
    commandState: pageState.commandState,
    previewTargetDelta: pageState.previewTargetDelta,
    updateDraft: pageState.updateDraft,
    ...actions,
    load
  };
}
