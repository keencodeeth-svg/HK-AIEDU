"use client";

import { useEffect } from "react";
import { useTeacherAiToolsLoaders } from "./useTeacherAiToolsLoaders";
import { useTeacherAiToolsPaperActions } from "./useTeacherAiToolsPaperActions";
import { useTeacherAiToolsPageState } from "./useTeacherAiToolsPageState";
import { useTeacherAiToolsWorkflowActions } from "./useTeacherAiToolsWorkflowActions";

export function useTeacherAiToolsPage() {
  const pageState = useTeacherAiToolsPageState();

  const { loadBootstrapData } = useTeacherAiToolsLoaders({
    bootstrapRequestIdRef: pageState.bootstrapRequestIdRef,
    hasClassesSnapshotRef: pageState.hasClassesSnapshotRef,
    hasKnowledgePointsSnapshotRef: pageState.hasKnowledgePointsSnapshotRef,
    handleAuthRequired: pageState.handleAuthRequired,
    setClasses: pageState.setClasses,
    setKnowledgePoints: pageState.setKnowledgePoints,
    setAuthRequired: pageState.setAuthRequired,
    setPageLoading: pageState.setPageLoading,
    setPageReady: pageState.setPageReady,
    setPageError: pageState.setPageError,
    setBootstrapNotice: pageState.setBootstrapNotice,
    setKnowledgePointsNotice: pageState.setKnowledgePointsNotice,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  const { handleGeneratePaper, applyPaperQuickFix } = useTeacherAiToolsPaperActions({
    paperForm: pageState.paperForm,
    loading: pageState.loading,
    paperAutoFixing: pageState.paperAutoFixing,
    handleAuthRequired: pageState.handleAuthRequired,
    resetPaperScope: pageState.resetPaperScope,
    loadBootstrapData,
    setLoading: pageState.setLoading,
    setPaperForm: pageState.setPaperForm,
    setPaperResult: pageState.setPaperResult,
    setPaperError: pageState.setPaperError,
    setPaperErrorSuggestions: pageState.setPaperErrorSuggestions,
    setPaperAutoFixHint: pageState.setPaperAutoFixHint,
    setPaperAutoFixing: pageState.setPaperAutoFixing
  });

  const {
    handleGenerateOutline,
    handleWrongReview,
    handleReviewPack,
    handleAssignReviewSheet,
    handleAssignAllReviewSheets,
    handleRetryFailedReviewSheets,
    handleCheckQuestion
  } = useTeacherAiToolsWorkflowActions({
    outlineForm: pageState.outlineForm,
    wrongForm: pageState.wrongForm,
    reviewPackResult: pageState.reviewPackResult,
    reviewPackFailedItems: pageState.reviewPackFailedItems,
    reviewPackDispatchIncludeIsolated: pageState.reviewPackDispatchIncludeIsolated,
    checkForm: pageState.checkForm,
    handleAuthRequired: pageState.handleAuthRequired,
    resetOutlineScope: pageState.resetOutlineScope,
    resetWrongScope: pageState.resetWrongScope,
    loadBootstrapData,
    setLoading: pageState.setLoading,
    setOutlineError: pageState.setOutlineError,
    setOutlineResult: pageState.setOutlineResult,
    setWrongError: pageState.setWrongError,
    setWrongResult: pageState.setWrongResult,
    setReviewPackError: pageState.setReviewPackError,
    setReviewPackResult: pageState.setReviewPackResult,
    setReviewPackAssigningId: pageState.setReviewPackAssigningId,
    setReviewPackAssigningAll: pageState.setReviewPackAssigningAll,
    setReviewPackAssignMessage: pageState.setReviewPackAssignMessage,
    setReviewPackAssignError: pageState.setReviewPackAssignError,
    setReviewPackDispatchQuality: pageState.setReviewPackDispatchQuality,
    setReviewPackFailedItems: pageState.setReviewPackFailedItems,
    setReviewPackRelaxedItems: pageState.setReviewPackRelaxedItems,
    setReviewPackRetryingFailed: pageState.setReviewPackRetryingFailed,
    setCheckForm: pageState.setCheckForm,
    setCheckError: pageState.setCheckError,
    setCheckResult: pageState.setCheckResult
  });

  return {
    classes: pageState.classes,
    authRequired: pageState.authRequired,
    pageLoading: pageState.pageLoading,
    pageReady: pageState.pageReady,
    pageError: pageState.pageError,
    bootstrapNotice: pageState.bootstrapNotice,
    knowledgePointsNotice: pageState.knowledgePointsNotice,
    lastLoadedAt: pageState.lastLoadedAt,
    reload: loadBootstrapData,
    paperForm: pageState.paperForm,
    setPaperForm: pageState.setPaperForm,
    paperPoints: pageState.paperPoints,
    loading: pageState.loading,
    paperAutoFixing: pageState.paperAutoFixing,
    paperAutoFixHint: pageState.paperAutoFixHint,
    paperResult: pageState.paperResult,
    paperError: pageState.paperError,
    paperErrorSuggestions: pageState.paperErrorSuggestions,
    outlineForm: pageState.outlineForm,
    setOutlineForm: pageState.setOutlineForm,
    outlinePoints: pageState.outlinePoints,
    outlineError: pageState.outlineError,
    outlineResult: pageState.outlineResult,
    wrongForm: pageState.wrongForm,
    setWrongForm: pageState.setWrongForm,
    wrongError: pageState.wrongError,
    wrongResult: pageState.wrongResult,
    reviewPackResult: pageState.reviewPackResult,
    reviewPackError: pageState.reviewPackError,
    reviewPackAssigningId: pageState.reviewPackAssigningId,
    reviewPackAssigningAll: pageState.reviewPackAssigningAll,
    reviewPackAssignMessage: pageState.reviewPackAssignMessage,
    reviewPackAssignError: pageState.reviewPackAssignError,
    reviewPackDispatchIncludeIsolated: pageState.reviewPackDispatchIncludeIsolated,
    setReviewPackDispatchIncludeIsolated: pageState.setReviewPackDispatchIncludeIsolated,
    reviewPackDispatchQuality: pageState.reviewPackDispatchQuality,
    reviewPackFailedItems: pageState.reviewPackFailedItems,
    reviewPackRelaxedItems: pageState.reviewPackRelaxedItems,
    reviewPackRetryingFailed: pageState.reviewPackRetryingFailed,
    showGuideCard: pageState.showGuideCard,
    checkForm: pageState.checkForm,
    setCheckForm: pageState.setCheckForm,
    checkPreviewOptions: pageState.checkPreviewOptions,
    hasCheckPreview: pageState.hasCheckPreview,
    checkError: pageState.checkError,
    checkResult: pageState.checkResult,
    handleGeneratePaper,
    applyPaperQuickFix,
    handleGenerateOutline,
    handleWrongReview,
    handleReviewPack,
    handleAssignAllReviewSheets,
    handleRetryFailedReviewSheets,
    handleAssignReviewSheet,
    handleCheckQuestion,
    hideGuideCard: pageState.hideGuideCard,
    showGuideAgain: pageState.showGuideAgain
  };
}
