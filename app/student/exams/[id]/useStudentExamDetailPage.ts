import { useMemo } from "react";
import { getStudentExamDetailDerivedState } from "./utils";
import { useStudentExamDetailActions } from "./useStudentExamDetailActions";
import { useStudentExamDetailPageEffects } from "./useStudentExamDetailPageEffects";
import { useStudentExamDetailPageState } from "./useStudentExamDetailPageState";

export function useStudentExamDetailPage(examId: string) {
  const pageState = useStudentExamDetailPageState(examId);

  const derivedState = useMemo(
    () =>
      getStudentExamDetailDerivedState({
        data: pageState.data,
        answers: pageState.answers,
        result: pageState.result,
        reviewPack: pageState.reviewPack,
        reviewPackError: pageState.reviewPackError,
        clientStartedAt: pageState.clientStartedAt,
        clock: pageState.clock
      }),
    [
      pageState.answers,
      pageState.clientStartedAt,
      pageState.clock,
      pageState.data,
      pageState.result,
      pageState.reviewPack,
      pageState.reviewPackError
    ]
  );

  const actions = useStudentExamDetailActions({
    examId,
    data: pageState.data,
    answers: pageState.answers,
    submitted: derivedState.submitted,
    saving: pageState.saving,
    submitting: pageState.submitting,
    lockedByTime: derivedState.lockedByTime,
    lockedByServer: derivedState.lockedByServer,
    online: pageState.online,
    clientStartedAt: pageState.clientStartedAt,
    readLocalDraft: pageState.readLocalDraft,
    writeLocalDraft: pageState.writeLocalDraft,
    clearLocalDraft: pageState.clearLocalDraft,
    clearExamState: pageState.clearExamState,
    handleAuthRequired: pageState.handleAuthRequired,
    examEventRef: pageState.examEventRef,
    hasReviewPackSnapshotRef: pageState.hasReviewPackSnapshotRef,
    flushTimerRef: pageState.flushTimerRef,
    setData: pageState.setData,
    setAnswers: pageState.setAnswers,
    setDirty: pageState.setDirty,
    setSaving: pageState.setSaving,
    setSavedAt: pageState.setSavedAt,
    setSubmitting: pageState.setSubmitting,
    setResult: pageState.setResult,
    setAuthRequired: pageState.setAuthRequired,
    setPageLoading: pageState.setPageLoading,
    setLoadError: pageState.setLoadError,
    setActionError: pageState.setActionError,
    setActionMessage: pageState.setActionMessage,
    setSyncNotice: pageState.setSyncNotice,
    setClientStartedAt: pageState.setClientStartedAt,
    setPendingLocalSync: pageState.setPendingLocalSync,
    setReviewPack: pageState.setReviewPack,
    setReviewPackLoading: pageState.setReviewPackLoading,
    setReviewPackError: pageState.setReviewPackError,
    setTimeupTriggered: pageState.setTimeupTriggered
  });

  useStudentExamDetailPageEffects({
    data: pageState.data,
    submitted: derivedState.submitted,
    dirty: pageState.dirty,
    saving: pageState.saving,
    pendingLocalSync: pageState.pendingLocalSync,
    online: pageState.online,
    submitting: pageState.submitting,
    deadlineMs: derivedState.deadlineMs,
    lockedByTime: derivedState.lockedByTime,
    lockedByServer: derivedState.lockedByServer,
    startedAt: derivedState.startedAt,
    timeupTriggered: pageState.timeupTriggered,
    result: pageState.result,
    flushTimerRef: pageState.flushTimerRef,
    resultSectionRef: pageState.resultSectionRef,
    setOnline: pageState.setOnline,
    setClock: pageState.setClock,
    setTimeupTriggered: pageState.setTimeupTriggered,
    queueExamEvent: actions.queueExamEvent,
    flushExamEvents: actions.flushExamEvents,
    load: actions.load,
    saveDraft: actions.saveDraft,
    submitExam: actions.submitExam
  });

  return {
    data: pageState.data,
    answers: pageState.answers,
    result: pageState.result,
    authRequired: pageState.authRequired,
    pageLoading: pageState.pageLoading,
    loadError: pageState.loadError,
    reviewPack: pageState.reviewPack,
    reviewPackLoading: pageState.reviewPackLoading,
    reviewPackError: pageState.reviewPackError,
    reviewPackSummary: derivedState.reviewPackSummary,
    mathView: pageState.mathView,
    submitted: derivedState.submitted,
    online: pageState.online,
    answerCount: derivedState.answerCount,
    unansweredCount: derivedState.unansweredCount,
    totalScore: derivedState.totalScore,
    remainingSeconds: derivedState.remainingSeconds,
    startedAt: derivedState.startedAt,
    saving: pageState.saving,
    savedAt: pageState.savedAt,
    syncNotice: pageState.syncNotice,
    actionMessage: pageState.actionMessage,
    actionError: pageState.actionError,
    lockReason: derivedState.lockReason,
    finalScore: derivedState.finalScore,
    finalTotal: derivedState.finalTotal,
    submitting: pageState.submitting,
    lockedByTime: derivedState.lockedByTime,
    lockedByServer: derivedState.lockedByServer,
    stageLabel: derivedState.stageLabel,
    stageCopy: derivedState.stageCopy,
    firstUnansweredQuestionId: derivedState.firstUnansweredQuestionId,
    feedbackTargetId: derivedState.feedbackTargetId,
    hasReviewPackSection: derivedState.hasReviewPackSection,
    resultSectionRef: pageState.resultSectionRef,
    load: actions.load,
    loadReviewPack: actions.loadReviewPack,
    handleSaveDraft: actions.handleSaveDraft,
    handleSubmit: actions.handleSubmit,
    handleAnswerChange: (questionId: string, value: string) =>
      actions.handleAnswerChange(questionId, value, derivedState.startedAt)
  };
}
