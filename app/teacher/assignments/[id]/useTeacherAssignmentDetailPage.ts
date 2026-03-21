"use client";

import { useTeacherAssignmentDetailActions } from "./useTeacherAssignmentDetailActions";
import { useTeacherAssignmentDetailPageEffects } from "./useTeacherAssignmentDetailPageEffects";
import { useTeacherAssignmentDetailPageState } from "./useTeacherAssignmentDetailPageState";
import { useTeacherAssignmentDetailLoaders } from "./useTeacherAssignmentDetailLoaders";

export function useTeacherAssignmentDetailPage(id: string) {
  const pageState = useTeacherAssignmentDetailPageState();

  const { load, retryRubrics } = useTeacherAssignmentDetailLoaders({
    id,
    loadRequestIdRef: pageState.loadRequestIdRef,
    rubricRequestIdRef: pageState.rubricRequestIdRef,
    hasDetailSnapshotRef: pageState.hasDetailSnapshotRef,
    rubricsReadyRef: pageState.rubricsReadyRef,
    clearAssignmentDetailState: pageState.clearAssignmentDetailState,
    handleAuthRequired: pageState.handleAuthRequired,
    setData: pageState.setData,
    setAuthRequired: pageState.setAuthRequired,
    setLoading: pageState.setLoading,
    setLoadError: pageState.setLoadError,
    setRubrics: pageState.setRubrics,
    setRubricsLoading: pageState.setRubricsLoading,
    setRubricsReady: pageState.setRubricsReady,
    setRubricLoadError: pageState.setRubricLoadError
  });

  useTeacherAssignmentDetailPageEffects({
    load
  });

  const actions = useTeacherAssignmentDetailActions({
    data: pageState.data,
    notifyTarget: pageState.notifyTarget,
    threshold: pageState.threshold,
    notifyMessage: pageState.notifyMessage,
    notifyLoading: pageState.notifyLoading,
    rubrics: pageState.rubrics,
    rubricsReady: pageState.rubricsReady,
    rubricSaving: pageState.rubricSaving,
    notifyRequestIdRef: pageState.notifyRequestIdRef,
    saveRubricsRequestIdRef: pageState.saveRubricsRequestIdRef,
    clearAssignmentDetailState: pageState.clearAssignmentDetailState,
    handleAuthRequired: pageState.handleAuthRequired,
    setAuthRequired: pageState.setAuthRequired,
    setLoadError: pageState.setLoadError,
    setNotifyLoading: pageState.setNotifyLoading,
    setNotifySuccess: pageState.setNotifySuccess,
    setNotifyError: pageState.setNotifyError,
    setRubrics: pageState.setRubrics,
    setRubricsReady: pageState.setRubricsReady,
    setRubricLoadError: pageState.setRubricLoadError,
    setRubricMessage: pageState.setRubricMessage,
    setRubricError: pageState.setRubricError,
    setRubricSaving: pageState.setRubricSaving,
    setStudentFilter: pageState.setStudentFilter,
    setStudentKeyword: pageState.setStudentKeyword
  });

  return {
    data: pageState.data,
    authRequired: pageState.authRequired,
    loading: pageState.loading,
    loadError: pageState.loadError,
    notifyTarget: pageState.notifyTarget,
    threshold: pageState.threshold,
    notifyMessage: pageState.notifyMessage,
    notifyLoading: pageState.notifyLoading,
    notifySuccess: pageState.notifySuccess,
    notifyError: pageState.notifyError,
    rubrics: pageState.rubrics,
    rubricsLoading: pageState.rubricsLoading,
    rubricsReady: pageState.rubricsReady,
    rubricLoadError: pageState.rubricLoadError,
    rubricMessage: pageState.rubricMessage,
    rubricError: pageState.rubricError,
    rubricSaving: pageState.rubricSaving,
    studentFilter: pageState.studentFilter,
    studentKeyword: pageState.studentKeyword,
    now: pageState.now,
    assignmentOverdue: pageState.assignmentOverdue,
    completedStudents: pageState.completedStudents,
    pendingStudents: pageState.pendingStudents,
    reviewReadyStudents: pageState.reviewReadyStudents,
    scoredStudents: pageState.scoredStudents,
    lowScoreStudents: pageState.lowScoreStudents,
    latestCompletedStudent: pageState.latestCompletedStudent,
    completionRate: pageState.completionRate,
    averagePercent: pageState.averagePercent,
    notifyPreviewStudents: pageState.notifyPreviewStudents,
    hasStudentFilters: pageState.hasStudentFilters,
    filteredStudents: pageState.filteredStudents,
    setNotifyTarget: pageState.setNotifyTarget,
    setThreshold: pageState.setThreshold,
    setNotifyMessage: pageState.setNotifyMessage,
    setStudentFilter: pageState.setStudentFilter,
    setStudentKeyword: pageState.setStudentKeyword,
    updateRubric: actions.updateRubric,
    updateLevel: actions.updateLevel,
    addRubric: actions.addRubric,
    removeRubric: actions.removeRubric,
    addLevel: actions.addLevel,
    removeLevel: actions.removeLevel,
    clearStudentFilters: actions.clearStudentFilters,
    load,
    retryRubrics,
    handleNotify: actions.handleNotify,
    handleSaveRubrics: actions.handleSaveRubrics
  };
}
