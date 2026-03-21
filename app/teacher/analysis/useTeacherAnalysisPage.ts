"use client";

import { useTeacherAnalysisActions } from "./useTeacherAnalysisActions";
import { useTeacherAnalysisLoaders } from "./useTeacherAnalysisLoaders";
import { useTeacherAnalysisPageEffects } from "./useTeacherAnalysisPageEffects";
import { useTeacherAnalysisPageState } from "./useTeacherAnalysisPageState";

export function useTeacherAnalysisPage() {
  const pageState = useTeacherAnalysisPageState();

  const { loadFavorites, loadClassScopedData, loadBootstrap } = useTeacherAnalysisLoaders({
    classId: pageState.classId,
    causalityDays: pageState.causalityDays,
    classScopedRequestIdRef: pageState.classScopedRequestIdRef,
    favoritesRequestIdRef: pageState.favoritesRequestIdRef,
    skipNextClassEffectRef: pageState.skipNextClassEffectRef,
    skipNextStudentEffectRef: pageState.skipNextStudentEffectRef,
    studentIdRef: pageState.studentIdRef,
    handleAuthRequired: pageState.handleAuthRequired,
    handleMissingClassSelection: pageState.handleMissingClassSelection,
    resetScopedData: pageState.resetScopedData,
    applyStudentId: pageState.applyStudentId,
    setClasses: pageState.setClasses,
    setClassId: pageState.setClassId,
    setHeatmap: pageState.setHeatmap,
    setStudents: pageState.setStudents,
    setFavorites: pageState.setFavorites,
    setAlerts: pageState.setAlerts,
    setAlertSummary: pageState.setAlertSummary,
    setParentCollaboration: pageState.setParentCollaboration,
    setImpactByAlertId: pageState.setImpactByAlertId,
    setCausalitySummary: pageState.setCausalitySummary,
    setCausalityItems: pageState.setCausalityItems,
    setHeatmapLoading: pageState.setHeatmapLoading,
    setCausalityLoading: pageState.setCausalityLoading,
    setPageError: pageState.setPageError,
    setAuthRequired: pageState.setAuthRequired,
    setLastLoadedAt: pageState.setLastLoadedAt,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing
  });

  useTeacherAnalysisPageEffects({
    didInitRef: pageState.didInitRef,
    previousClassIdRef: pageState.previousClassIdRef,
    skipNextClassEffectRef: pageState.skipNextClassEffectRef,
    skipNextStudentEffectRef: pageState.skipNextStudentEffectRef,
    studentIdRef: pageState.studentIdRef,
    classId: pageState.classId,
    studentId: pageState.studentId,
    causalityDays: pageState.causalityDays,
    reportClassId: pageState.report?.classId,
    clearFavoritesSnapshot: pageState.clearFavoritesSnapshot,
    clearReportState: pageState.clearReportState,
    resetScopedData: pageState.resetScopedData,
    loadBootstrap,
    loadClassScopedData,
    loadFavorites
  });

  const actions = useTeacherAnalysisActions({
    classId: pageState.classId,
    causalityDays: pageState.causalityDays,
    impactByAlertId: pageState.impactByAlertId,
    studentIdRef: pageState.studentIdRef,
    handleAuthRequired: pageState.handleAuthRequired,
    handleMissingClassSelection: pageState.handleMissingClassSelection,
    loadClassScopedData,
    setAcknowledgingAlertId: pageState.setAcknowledgingAlertId,
    setActingAlertKey: pageState.setActingAlertKey,
    setAlertActionMessage: pageState.setAlertActionMessage,
    setImpactByAlertId: pageState.setImpactByAlertId,
    setLoadingImpactId: pageState.setLoadingImpactId,
    setReport: pageState.setReport,
    setReportLoading: pageState.setReportLoading,
    setReportError: pageState.setReportError,
    setAuthRequired: pageState.setAuthRequired,
    setPageError: pageState.setPageError
  });

  return {
    classes: pageState.classes,
    classId: pageState.classId,
    setClassId: pageState.setClassId,
    heatmap: pageState.heatmap,
    report: pageState.report,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    heatmapLoading: pageState.heatmapLoading,
    reportLoading: pageState.reportLoading,
    reportError: pageState.reportError,
    students: pageState.students,
    studentId: pageState.studentId,
    setStudentId: pageState.applyStudentId,
    favorites: pageState.favorites,
    alerts: pageState.alerts,
    alertSummary: pageState.alertSummary,
    parentCollaboration: pageState.parentCollaboration,
    acknowledgingAlertId: pageState.acknowledgingAlertId,
    actingAlertKey: pageState.actingAlertKey,
    alertActionMessage: pageState.alertActionMessage,
    impactByAlertId: pageState.impactByAlertId,
    loadingImpactId: pageState.loadingImpactId,
    causalitySummary: pageState.causalitySummary,
    causalityItems: pageState.causalityItems,
    causalityLoading: pageState.causalityLoading,
    causalityDays: pageState.causalityDays,
    setCausalityDays: pageState.setCausalityDays,
    pageError: pageState.pageError,
    authRequired: pageState.authRequired,
    lastLoadedAt: pageState.lastLoadedAt,
    showHeatmapSkeleton: pageState.showHeatmapSkeleton,
    showReportSkeleton: pageState.showReportSkeleton,
    selectedClass: pageState.selectedClass,
    activeAlertCount: pageState.activeAlertCount,
    weakestKnowledgePoint: pageState.weakestKnowledgePoint,
    loadBootstrap,
    ...actions
  };
}
