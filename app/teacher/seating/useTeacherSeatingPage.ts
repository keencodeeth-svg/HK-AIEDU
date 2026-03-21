"use client";

import { useCallback, useEffect } from "react";
import { useTeacherSeatingActions } from "./useTeacherSeatingActions";
import { useTeacherSeatingLoaders } from "./useTeacherSeatingLoaders";
import { useTeacherSeatingPageState } from "./useTeacherSeatingPageState";

export function useTeacherSeatingPage() {
  const pageState = useTeacherSeatingPageState();
  const {
    applyClassId,
    handleMissingClassSelection,
    initialLoadStartedRef,
    setFollowUpError,
    setFollowUpMessage,
    setLastLoadedAt,
    setSaveError,
    setSaveMessage
  } = pageState;

  const { loadData } = useTeacherSeatingLoaders({
    loadRequestIdRef: pageState.loadRequestIdRef,
    classIdRef: pageState.classIdRef,
    handleAuthRequired: pageState.handleAuthRequired,
    handleMissingClassSelection: pageState.handleMissingClassSelection,
    syncClasses: pageState.syncClasses,
    applyClassId: pageState.applyClassId,
    setStudents: pageState.setStudents,
    setSavedPlan: pageState.setSavedPlan,
    setDraftPlan: pageState.setDraftPlan,
    setPreview: pageState.setPreview,
    setLayoutRows: pageState.setLayoutRows,
    setLayoutColumns: pageState.setLayoutColumns,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setAuthRequired: pageState.setAuthRequired,
    setPageError: pageState.setPageError,
    setSaveError: pageState.setSaveError,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }
    initialLoadStartedRef.current = true;
    void loadData();
  }, [initialLoadStartedRef, loadData]);

  const recoverFromMissingClass = useCallback(async (missingClassId: string) => {
    const nextClassId = handleMissingClassSelection(missingClassId);
    if (nextClassId) {
      await loadData("refresh", nextClassId);
      return;
    }
    setLastLoadedAt(new Date().toISOString());
  }, [handleMissingClassSelection, loadData, setLastLoadedAt]);

  const actions = useTeacherSeatingActions({
    classId: pageState.classId,
    draftPlan: pageState.draftPlan,
    previewPlan: pageState.previewPlan,
    savedPlan: pageState.savedPlan,
    aiOptions: pageState.aiOptions,
    layoutRows: pageState.layoutRows,
    layoutColumns: pageState.layoutColumns,
    keepLockedSeats: pageState.keepLockedSeats,
    lockedSeats: pageState.lockedSeats,
    includeParentsInReminder: pageState.includeParentsInReminder,
    studentsNeedingProfileReminder: pageState.studentsNeedingProfileReminder,
    followUpChecklist: pageState.followUpChecklist,
    handleAuthRequired: pageState.handleAuthRequired,
    recoverFromMissingClass,
    setPreviewing: pageState.setPreviewing,
    setSaving: pageState.setSaving,
    setPageError: pageState.setPageError,
    setPreview: pageState.setPreview,
    setSaveMessage: pageState.setSaveMessage,
    setSaveError: pageState.setSaveError,
    setDraftPlan: pageState.setDraftPlan,
    setSavedPlan: pageState.setSavedPlan,
    setStudents: pageState.setStudents,
    setLayoutRows: pageState.setLayoutRows,
    setLayoutColumns: pageState.setLayoutColumns,
    setFollowUpActing: pageState.setFollowUpActing,
    setFollowUpMessage: pageState.setFollowUpMessage,
    setFollowUpError: pageState.setFollowUpError
  });

  const handleClassChange = useCallback((nextClassId: string) => {
    applyClassId(nextClassId);
    setSaveMessage(null);
    setSaveError(null);
    setFollowUpMessage(null);
    setFollowUpError(null);
    void loadData("refresh", nextClassId);
  }, [
    applyClassId,
    loadData,
    setFollowUpError,
    setFollowUpMessage,
    setSaveError,
    setSaveMessage
  ]);

  return {
    classes: pageState.classes,
    classId: pageState.classId,
    students: pageState.students,
    draftPlan: pageState.draftPlan,
    savedPlan: pageState.savedPlan,
    preview: pageState.preview,
    aiOptions: pageState.aiOptions,
    keepLockedSeats: pageState.keepLockedSeats,
    lockedSeatIds: pageState.lockedSeatIds,
    layoutRows: pageState.layoutRows,
    layoutColumns: pageState.layoutColumns,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    previewing: pageState.previewing,
    saving: pageState.saving,
    authRequired: pageState.authRequired,
    pageError: pageState.pageError,
    saveMessage: pageState.saveMessage,
    saveError: pageState.saveError,
    followUpMessage: pageState.followUpMessage,
    followUpError: pageState.followUpError,
    includeParentsInReminder: pageState.includeParentsInReminder,
    followUpActing: pageState.followUpActing,
    lastLoadedAt: pageState.lastLoadedAt,
    lockedSeats: pageState.lockedSeats,
    draftSummary: pageState.draftSummary,
    previewPlan: pageState.previewPlan,
    previewSummary: pageState.previewSummary,
    previewWarnings: pageState.previewWarnings,
    previewInsights: pageState.previewInsights,
    studentMap: pageState.studentMap,
    unassignedStudents: pageState.unassignedStudents,
    roster: pageState.roster,
    studentsNeedingProfileReminder: pageState.studentsNeedingProfileReminder,
    watchStudents: pageState.watchStudents,
    classLabel: pageState.classLabel,
    followUpChecklist: pageState.followUpChecklist,
    semesterReplanReasons: pageState.semesterReplanReasons,
    semesterStatus: pageState.semesterStatus,
    semesterStatusTone: pageState.semesterStatusTone,
    frontRowCount: pageState.frontRowCount,
    setAiOptions: pageState.setAiOptions,
    setKeepLockedSeats: pageState.setKeepLockedSeats,
    setIncludeParentsInReminder: pageState.setIncludeParentsInReminder,
    toggleLockedSeat: pageState.toggleLockedSeat,
    handleLayoutChange: pageState.handleLayoutChange,
    handleClassChange,
    handleSeatAssignmentChange: pageState.handleSeatAssignmentChange,
    loadData,
    ...actions
  };
}
