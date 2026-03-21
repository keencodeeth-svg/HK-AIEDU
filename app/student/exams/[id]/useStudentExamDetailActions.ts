import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type {
  ExamDetail,
  LocalDraft,
  ReviewPack,
  SubmitResult
} from "./types";
import { useStudentExamDetailLoaders } from "./useStudentExamDetailLoaders";
import { useStudentExamDetailSubmissionActions } from "./useStudentExamDetailSubmissionActions";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ExamEventCounters = {
  blurCountDelta: number;
  visibilityHiddenCountDelta: number;
};

type StudentExamDetailActionsOptions = {
  examId: string;
  data: ExamDetail | null;
  answers: Record<string, string>;
  submitted: boolean;
  saving: boolean;
  submitting: boolean;
  lockedByTime: boolean;
  lockedByServer: boolean;
  online: boolean;
  clientStartedAt: string | null;
  readLocalDraft: () => LocalDraft | null;
  writeLocalDraft: (draft: LocalDraft) => void;
  clearLocalDraft: () => void;
  clearExamState: () => void;
  handleAuthRequired: () => void;
  examEventRef: MutableRefObject<ExamEventCounters>;
  hasReviewPackSnapshotRef: MutableRefObject<boolean>;
  flushTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setData: Setter<ExamDetail | null>;
  setAnswers: Setter<Record<string, string>>;
  setDirty: Setter<boolean>;
  setSaving: Setter<boolean>;
  setSavedAt: Setter<string | null>;
  setSubmitting: Setter<boolean>;
  setResult: Setter<SubmitResult | null>;
  setAuthRequired: Setter<boolean>;
  setPageLoading: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setActionError: Setter<string | null>;
  setActionMessage: Setter<string | null>;
  setSyncNotice: Setter<string | null>;
  setClientStartedAt: Setter<string | null>;
  setPendingLocalSync: Setter<boolean>;
  setReviewPack: Setter<ReviewPack | null>;
  setReviewPackLoading: Setter<boolean>;
  setReviewPackError: Setter<string | null>;
  setTimeupTriggered: Setter<boolean>;
};

export function useStudentExamDetailActions(options: StudentExamDetailActionsOptions) {
  const loaders = useStudentExamDetailLoaders({
    examId: options.examId,
    data: options.data,
    submitted: options.submitted,
    readLocalDraft: options.readLocalDraft,
    clearLocalDraft: options.clearLocalDraft,
    clearExamState: options.clearExamState,
    handleAuthRequired: options.handleAuthRequired,
    examEventRef: options.examEventRef,
    hasReviewPackSnapshotRef: options.hasReviewPackSnapshotRef,
    flushTimerRef: options.flushTimerRef,
    setData: options.setData,
    setAnswers: options.setAnswers,
    setDirty: options.setDirty,
    setAuthRequired: options.setAuthRequired,
    setPageLoading: options.setPageLoading,
    setLoadError: options.setLoadError,
    setActionError: options.setActionError,
    setActionMessage: options.setActionMessage,
    setSyncNotice: options.setSyncNotice,
    setClientStartedAt: options.setClientStartedAt,
    setPendingLocalSync: options.setPendingLocalSync,
    setReviewPack: options.setReviewPack,
    setReviewPackLoading: options.setReviewPackLoading,
    setReviewPackError: options.setReviewPackError,
    setSavedAt: options.setSavedAt,
    setResult: options.setResult,
    setTimeupTriggered: options.setTimeupTriggered
  });

  const submissionActions = useStudentExamDetailSubmissionActions({
    examId: options.examId,
    data: options.data,
    answers: options.answers,
    submitted: options.submitted,
    saving: options.saving,
    submitting: options.submitting,
    lockedByTime: options.lockedByTime,
    lockedByServer: options.lockedByServer,
    online: options.online,
    clientStartedAt: options.clientStartedAt,
    writeLocalDraft: options.writeLocalDraft,
    clearLocalDraft: options.clearLocalDraft,
    clearExamState: options.clearExamState,
    handleAuthRequired: options.handleAuthRequired,
    flushExamEvents: loaders.flushExamEvents,
    loadReviewPack: loaders.loadReviewPack,
    setData: options.setData,
    setAnswers: options.setAnswers,
    setDirty: options.setDirty,
    setSaving: options.setSaving,
    setSavedAt: options.setSavedAt,
    setSubmitting: options.setSubmitting,
    setResult: options.setResult,
    setAuthRequired: options.setAuthRequired,
    setLoadError: options.setLoadError,
    setActionError: options.setActionError,
    setActionMessage: options.setActionMessage,
    setSyncNotice: options.setSyncNotice,
    setClientStartedAt: options.setClientStartedAt,
    setPendingLocalSync: options.setPendingLocalSync
  });

  return {
    ...loaders,
    ...submissionActions
  };
}
