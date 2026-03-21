"use client";

import { useCallback } from "react";
import { useTeacherDashboardClassActions } from "./useTeacherDashboardClassActions";
import {
  useTeacherAssignmentModules,
  useTeacherDataLoader,
  useTeacherDefaultSelections
} from "./useTeacherDashboardEffects";
import { useTeacherDashboardPageState } from "./useTeacherDashboardPageState";
import { useTeacherDashboardWorkflowActions } from "./useTeacherDashboardWorkflowActions";

export function useTeacherDashboardPage() {
  const pageState = useTeacherDashboardPageState();

  const { loadAll, loadKnowledgePoints } = useTeacherDataLoader({
    setUnauthorized: pageState.setUnauthorized,
    setLoading: pageState.setLoading,
    setPageError: pageState.setPageError,
    setStaleDataError: pageState.setStaleDataError,
    setKnowledgePointsNotice: pageState.setKnowledgePointsNotice,
    setPageReady: pageState.setPageReady,
    setClasses: pageState.applyClasses,
    setAssignments: pageState.setAssignments,
    setInsights: pageState.setInsights,
    setJoinRequests: pageState.setJoinRequests,
    setKnowledgePoints: pageState.setKnowledgePoints,
    onLoaded: pageState.handleLoaded
  });

  useTeacherDefaultSelections({
    classes: pageState.classes,
    studentFormClassId: pageState.studentForm.classId,
    assignmentFormClassId: pageState.assignmentForm.classId,
    setStudentForm: pageState.setStudentForm,
    setAssignmentForm: pageState.setAssignmentForm
  });

  useTeacherAssignmentModules({
    classId: pageState.assignmentForm.classId,
    setModules: pageState.setModules,
    setAssignmentForm: pageState.setAssignmentForm,
    setUnauthorized: pageState.setUnauthorized,
    setAssignmentLoadError: pageState.setAssignmentLoadError
  });

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadAll({ preserveFeedback: true }),
      loadKnowledgePoints()
    ]);
  }, [loadAll, loadKnowledgePoints]);

  const classActions = useTeacherDashboardClassActions({
    classForm: pageState.classForm,
    studentForm: pageState.studentForm,
    assignmentForm: pageState.assignmentForm,
    classes: pageState.classes,
    modules: pageState.modules,
    loadAll,
    removeClassFromDashboard: pageState.removeClassFromDashboard,
    setUnauthorized: pageState.setUnauthorized,
    setLoading: pageState.setLoading,
    setMessage: pageState.setMessage,
    setError: pageState.setError,
    setAssignmentLoadError: pageState.setAssignmentLoadError,
    setAssignmentError: pageState.setAssignmentError,
    setAssignmentMessage: pageState.setAssignmentMessage,
    setClasses: pageState.applyClasses,
    setAssignments: pageState.setAssignments,
    setClassForm: pageState.setClassForm,
    setStudentForm: pageState.setStudentForm,
    setAssignmentForm: pageState.setAssignmentForm
  });

  const workflowActions = useTeacherDashboardWorkflowActions({
    impactByAlertId: pageState.impactByAlertId,
    loadAll,
    removeAlertImpact: pageState.removeAlertImpact,
    removeJoinRequestFromDashboard: pageState.removeJoinRequestFromDashboard,
    setUnauthorized: pageState.setUnauthorized,
    setError: pageState.setError,
    setMessage: pageState.setMessage,
    setAcknowledgingAlertId: pageState.setAcknowledgingAlertId,
    setActingAlertKey: pageState.setActingAlertKey,
    setImpactByAlertId: pageState.setImpactByAlertId,
    setLoadingImpactId: pageState.setLoadingImpactId
  });

  return {
    classes: pageState.classes,
    assignments: pageState.assignments,
    knowledgePoints: pageState.knowledgePoints,
    modules: pageState.modules,
    insights: pageState.insights,
    unauthorized: pageState.unauthorized,
    loading: pageState.loading,
    pageError: pageState.pageError,
    pageReady: pageState.pageReady,
    staleDataError: pageState.staleDataError,
    knowledgePointsNotice: pageState.knowledgePointsNotice,
    message: pageState.message,
    error: pageState.error,
    joinRequests: pageState.joinRequests,
    assignmentLoadError: pageState.assignmentLoadError,
    assignmentError: pageState.assignmentError,
    assignmentMessage: pageState.assignmentMessage,
    acknowledgingAlertId: pageState.acknowledgingAlertId,
    actingAlertKey: pageState.actingAlertKey,
    impactByAlertId: pageState.impactByAlertId,
    loadingImpactId: pageState.loadingImpactId,
    lastLoadedAt: pageState.lastLoadedAt,
    classForm: pageState.classForm,
    studentForm: pageState.studentForm,
    assignmentForm: pageState.assignmentForm,
    filteredPoints: pageState.filteredPoints,
    pendingJoinCount: pageState.pendingJoinCount,
    activeAlertCount: pageState.activeAlertCount,
    classesMissingAssignmentsCount: pageState.classesMissingAssignmentsCount,
    dueSoonAssignmentCount: pageState.dueSoonAssignmentCount,
    hasDashboardData: pageState.hasDashboardData,
    updateClassForm: pageState.updateClassForm,
    updateStudentForm: pageState.updateStudentForm,
    updateAssignmentForm: pageState.updateAssignmentForm,
    refreshDashboard,
    ...classActions,
    ...workflowActions
  };
}
