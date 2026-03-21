"use client";

import { useEffect, useMemo } from "react";
import type { TeacherAssignmentReviewRouteParams } from "./types";
import { getTeacherAssignmentReviewDerivedState } from "./utils";
import { useTeacherAssignmentReviewPageActions } from "./useTeacherAssignmentReviewPageActions";
import { useTeacherAssignmentReviewPageState } from "./useTeacherAssignmentReviewPageState";

export function useTeacherAssignmentReviewPage({ id, studentId }: TeacherAssignmentReviewRouteParams) {
  const pageState = useTeacherAssignmentReviewPageState();

  const derivedState = useMemo(
    () => getTeacherAssignmentReviewDerivedState(pageState.data),
    [pageState.data]
  );

  const { load, handleAiReview, handleSubmit } = useTeacherAssignmentReviewPageActions({
    id,
    studentId,
    data: pageState.data,
    overallComment: pageState.overallComment,
    itemState: pageState.itemState,
    rubricState: pageState.rubricState,
    wrongQuestions: derivedState.wrongQuestions,
    loadRequestIdRef: pageState.loadRequestIdRef,
    aiRequestIdRef: pageState.aiRequestIdRef,
    saveRequestIdRef: pageState.saveRequestIdRef,
    hasSnapshotRef: pageState.hasSnapshotRef,
    clearReviewState: pageState.clearReviewState,
    syncReviewState: pageState.syncReviewState,
    handleAuthRequired: pageState.handleAuthRequired,
    setData: pageState.setData,
    setAuthRequired: pageState.setAuthRequired,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setSaving: pageState.setSaving,
    setMessage: pageState.setMessage,
    setLoadError: pageState.setLoadError,
    setSaveError: pageState.setSaveError,
    setAiError: pageState.setAiError,
    setAiLoading: pageState.setAiLoading,
    setAiReview: pageState.setAiReview
  });

  useEffect(() => {
    void load();
  }, [load]);

  return {
    id,
    studentId,
    data: pageState.data,
    authRequired: pageState.authRequired,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    overallComment: pageState.overallComment,
    itemState: pageState.itemState,
    rubricState: pageState.rubricState,
    saving: pageState.saving,
    message: pageState.message,
    loadError: pageState.loadError,
    saveError: pageState.saveError,
    aiError: pageState.aiError,
    aiLoading: pageState.aiLoading,
    aiReview: pageState.aiReview,
    wrongQuestions: derivedState.wrongQuestions,
    canAiReview: derivedState.canAiReview,
    isEssay: derivedState.isEssay,
    isUpload: derivedState.isUpload,
    isQuiz: derivedState.isQuiz,
    setOverallComment: pageState.setOverallComment,
    load,
    handleAiReview,
    handleSubmit,
    handleQuestionWrongTagChange: pageState.handleQuestionWrongTagChange,
    handleQuestionCommentChange: pageState.handleQuestionCommentChange,
    handleRubricScoreChange: pageState.handleRubricScoreChange,
    handleRubricCommentChange: pageState.handleRubricCommentChange
  };
}
