"use client";

import { useTeacherExamDetailPageActions } from "./useTeacherExamDetailPageActions";
import { useTeacherExamDetailPageEffects } from "./useTeacherExamDetailPageEffects";
import { useTeacherExamDetailPageState } from "./useTeacherExamDetailPageState";

export function useTeacherExamDetailPage(id: string) {
  const pageState = useTeacherExamDetailPageState();

  const actions = useTeacherExamDetailPageActions({
    id,
    data: pageState.data,
    updatingStatus: pageState.updatingStatus,
    publishingReviewPack: pageState.publishingReviewPack,
    requestIdRef: pageState.requestIdRef,
    hasSnapshotRef: pageState.hasSnapshotRef,
    clearExamDetailState: pageState.clearExamDetailState,
    handleAuthRequired: pageState.handleAuthRequired,
    setData: pageState.setData,
    setAuthRequired: pageState.setAuthRequired,
    setLoadError: pageState.setLoadError,
    setStatusError: pageState.setStatusError,
    setUpdatingStatus: pageState.setUpdatingStatus,
    setPublishingReviewPack: pageState.setPublishingReviewPack,
    setPublishMessage: pageState.setPublishMessage,
    setPublishError: pageState.setPublishError,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useTeacherExamDetailPageEffects({
    load: actions.load
  });

  return {
    data: pageState.data,
    authRequired: pageState.authRequired,
    loadError: pageState.loadError,
    statusError: pageState.statusError,
    updatingStatus: pageState.updatingStatus,
    publishingReviewPack: pageState.publishingReviewPack,
    publishMessage: pageState.publishMessage,
    publishError: pageState.publishError,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    lastLoadedAt: pageState.lastLoadedAt,
    lastLoadedAtLabel: pageState.lastLoadedAtLabel,
    mathView: pageState.mathView,
    now: pageState.now,
    rankedStudents: pageState.rankedStudents,
    submittedRate: pageState.submittedRate,
    topRiskStudent: pageState.topRiskStudent,
    totalQuestionScore: pageState.totalQuestionScore,
    dueRelativeLabel: pageState.dueRelativeLabel,
    load: actions.load,
    handleStatusAction: actions.handleStatusAction,
    handlePublishReviewPack: actions.handlePublishReviewPack
  };
}
