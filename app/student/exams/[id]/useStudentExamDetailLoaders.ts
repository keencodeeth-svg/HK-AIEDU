import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  ExamDetail,
  LocalDraft,
  ReviewPack,
  SubmitResult
} from "./types";
import {
  getStudentExamDetailRequestMessage,
  getStudentExamReviewPackRequestMessage,
  isMissingStudentExamDetailError,
  resolveStudentExamLoadState
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ExamEventCounters = {
  blurCountDelta: number;
  visibilityHiddenCountDelta: number;
};

type ExamEventResponse = {
  data?: {
    blurCount?: number;
    visibilityHiddenCount?: number;
  } | null;
};

type ExamReviewPackResponse = {
  data?: ReviewPack | null;
};

type StudentExamDetailLoadersOptions = {
  examId: string;
  data: ExamDetail | null;
  submitted: boolean;
  readLocalDraft: () => LocalDraft | null;
  clearLocalDraft: () => void;
  clearExamState: () => void;
  handleAuthRequired: () => void;
  examEventRef: MutableRefObject<ExamEventCounters>;
  hasReviewPackSnapshotRef: MutableRefObject<boolean>;
  flushTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setData: Setter<ExamDetail | null>;
  setAnswers: Setter<Record<string, string>>;
  setDirty: Setter<boolean>;
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
  setSavedAt: Setter<string | null>;
  setResult: Setter<SubmitResult | null>;
  setTimeupTriggered: Setter<boolean>;
};

export function useStudentExamDetailLoaders({
  examId,
  data,
  submitted,
  readLocalDraft,
  clearLocalDraft,
  clearExamState,
  handleAuthRequired,
  examEventRef,
  hasReviewPackSnapshotRef,
  flushTimerRef,
  setData,
  setAnswers,
  setDirty,
  setAuthRequired,
  setPageLoading,
  setLoadError,
  setActionError,
  setActionMessage,
  setSyncNotice,
  setClientStartedAt,
  setPendingLocalSync,
  setReviewPack,
  setReviewPackLoading,
  setReviewPackError,
  setSavedAt,
  setResult,
  setTimeupTriggered
}: StudentExamDetailLoadersOptions) {
  const flushExamEvents = useCallback(async () => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
      return;
    }

    const blurCountDelta = examEventRef.current.blurCountDelta;
    const visibilityHiddenCountDelta =
      examEventRef.current.visibilityHiddenCountDelta;
    if (blurCountDelta <= 0 && visibilityHiddenCountDelta <= 0) {
      return;
    }

    examEventRef.current = { blurCountDelta: 0, visibilityHiddenCountDelta: 0 };
    try {
      await requestJson<ExamEventResponse>(`/api/student/exams/${examId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blurCountDelta, visibilityHiddenCountDelta }),
        keepalive: true
      });
      setAuthRequired(false);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      if (isMissingStudentExamDetailError(error)) {
        clearExamState();
        setAuthRequired(false);
        setLoadError(getStudentExamDetailRequestMessage(error, "加载考试详情失败"));
        return;
      }

      examEventRef.current.blurCountDelta += blurCountDelta;
      examEventRef.current.visibilityHiddenCountDelta += visibilityHiddenCountDelta;
    }
  }, [
    clearExamState,
    data,
    examEventRef,
    examId,
    handleAuthRequired,
    setAuthRequired,
    setLoadError,
    submitted
  ]);

  const queueExamEvent = useCallback((type: "blur" | "hidden") => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
      return;
    }

    if (type === "blur") {
      examEventRef.current.blurCountDelta += 1;
    } else {
      examEventRef.current.visibilityHiddenCountDelta += 1;
    }

    if (flushTimerRef.current) {
      return;
    }

    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flushExamEvents();
    }, 800);
  }, [data, examEventRef, flushExamEvents, flushTimerRef, submitted]);

  const loadReviewPack = useCallback(async () => {
    setReviewPackLoading(true);
    setReviewPackError(null);

    try {
      const payload = await requestJson<ExamReviewPackResponse>(
        `/api/student/exams/${examId}/review-pack`
      );
      hasReviewPackSnapshotRef.current = true;
      setReviewPack(payload.data ?? null);
      setAuthRequired(false);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingStudentExamDetailError(error)) {
        clearExamState();
        setAuthRequired(false);
        setLoadError(getStudentExamDetailRequestMessage(error, "加载考试详情失败"));
      } else {
        if (!hasReviewPackSnapshotRef.current) {
          setReviewPack(null);
        }
        setReviewPackError(
          getStudentExamReviewPackRequestMessage(error, "复盘包加载失败")
        );
      }
    } finally {
      setReviewPackLoading(false);
    }
  }, [
    clearExamState,
    examId,
    handleAuthRequired,
    hasReviewPackSnapshotRef,
    setAuthRequired,
    setLoadError,
    setReviewPack,
    setReviewPackError,
    setReviewPackLoading
  ]);

  const load = useCallback(async () => {
    setPageLoading(true);
    setLoadError(null);
    setActionError(null);
    setActionMessage(null);
    setSyncNotice(null);
    setReviewPackError(null);

    try {
      const payload = await requestJson<ExamDetail>(`/api/student/exams/${examId}`);
      const loadState = resolveStudentExamLoadState(payload, readLocalDraft());

      setData(payload);
      setAuthRequired(false);
      setAnswers(loadState.mergedAnswers);
      setDirty(loadState.dirty);
      setPendingLocalSync(loadState.pendingLocalSync);
      setSyncNotice(loadState.syncNotice);
      if (loadState.nextClientStartedAt !== undefined) {
        setClientStartedAt(loadState.nextClientStartedAt);
      }
      if (loadState.shouldClearLocalDraft) {
        clearLocalDraft();
      }
      setSavedAt(payload.assignment?.autoSavedAt ?? null);
      setResult(null);
      setTimeupTriggered(false);
      if (loadState.shouldLoadReviewPack) {
        void loadReviewPack();
      } else {
        hasReviewPackSnapshotRef.current = false;
        setReviewPack(null);
        setReviewPackError(null);
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      clearExamState();
      setAuthRequired(false);
      setLoadError(getStudentExamDetailRequestMessage(error, "加载失败"));
    } finally {
      setPageLoading(false);
    }
  }, [
    clearExamState,
    clearLocalDraft,
    examId,
    handleAuthRequired,
    hasReviewPackSnapshotRef,
    loadReviewPack,
    readLocalDraft,
    setActionError,
    setActionMessage,
    setAnswers,
    setAuthRequired,
    setClientStartedAt,
    setData,
    setDirty,
    setLoadError,
    setPageLoading,
    setPendingLocalSync,
    setResult,
    setReviewPack,
    setReviewPackError,
    setSavedAt,
    setSyncNotice,
    setTimeupTriggered
  ]);

  return {
    flushExamEvents,
    queueExamEvent,
    loadReviewPack,
    load
  };
}
