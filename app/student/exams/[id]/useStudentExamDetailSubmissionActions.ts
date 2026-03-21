import { type Dispatch, type FormEvent, type SetStateAction, useCallback } from "react";
import {
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  ExamDetail,
  LocalDraft,
  SubmitResult,
  StudentExamSubmitTrigger
} from "./types";
import {
  buildStudentExamOfflineDraft,
  getStudentExamDetailRequestMessage,
  getStudentExamSubmitMessage,
  getStudentExamSubmitSyncNotice,
  isMissingStudentExamDetailError,
  mergeStudentExamAutosaveDetail,
  mergeStudentExamSubmissionDetail
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ExamAutosaveResponse = {
  savedAt?: string | null;
  status?: ExamDetail["assignment"]["status"];
  startedAt?: string | null;
};

type ExamSubmitResponse = SubmitResult & {
  alreadySubmitted?: boolean;
};

type StudentExamDetailSubmissionActionsOptions = {
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
  writeLocalDraft: (draft: LocalDraft) => void;
  clearLocalDraft: () => void;
  clearExamState: () => void;
  handleAuthRequired: () => void;
  flushExamEvents: () => Promise<void>;
  loadReviewPack: () => Promise<void>;
  setData: Setter<ExamDetail | null>;
  setAnswers: Setter<Record<string, string>>;
  setDirty: Setter<boolean>;
  setSaving: Setter<boolean>;
  setSavedAt: Setter<string | null>;
  setSubmitting: Setter<boolean>;
  setResult: Setter<SubmitResult | null>;
  setAuthRequired: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setActionError: Setter<string | null>;
  setActionMessage: Setter<string | null>;
  setSyncNotice: Setter<string | null>;
  setClientStartedAt: Setter<string | null>;
  setPendingLocalSync: Setter<boolean>;
};

export function useStudentExamDetailSubmissionActions({
  examId,
  data,
  answers,
  submitted,
  saving,
  submitting,
  lockedByTime,
  lockedByServer,
  online,
  clientStartedAt,
  writeLocalDraft,
  clearLocalDraft,
  clearExamState,
  handleAuthRequired,
  flushExamEvents,
  loadReviewPack,
  setData,
  setAnswers,
  setDirty,
  setSaving,
  setSavedAt,
  setSubmitting,
  setResult,
  setAuthRequired,
  setLoadError,
  setActionError,
  setActionMessage,
  setSyncNotice,
  setClientStartedAt,
  setPendingLocalSync
}: StudentExamDetailSubmissionActionsOptions) {
  const saveDraft = useCallback(async (mode: "auto" | "manual" | "sync" = "auto") => {
    if (!data || submitted || saving || lockedByTime || lockedByServer) {
      return;
    }

    setSaving(true);
    if (mode !== "auto") {
      setActionError(null);
      setActionMessage(null);
    }

    try {
      const payload = await requestJson<ExamAutosaveResponse>(
        `/api/student/exams/${examId}/autosave`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers })
        }
      );

      setSavedAt(payload.savedAt ?? new Date().toISOString());
      setDirty(false);
      setPendingLocalSync(false);
      clearLocalDraft();
      setAuthRequired(false);
      if (payload.startedAt) {
        setClientStartedAt(payload.startedAt);
      }
      if (online) {
        setSyncNotice(null);
      }
      if (mode === "manual") {
        setActionMessage("已保存到云端草稿，可继续安心作答。");
      } else if (mode === "sync") {
        setActionMessage("本地暂存答案已成功同步到云端。");
      }
      setData((previous) => mergeStudentExamAutosaveDetail(previous, payload));
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

      if (getRequestStatus(error) !== undefined) {
        setActionError(getStudentExamDetailRequestMessage(error, "自动保存失败"));
        return;
      }

      const localDraft = buildStudentExamOfflineDraft(answers, clientStartedAt);
      setClientStartedAt(localDraft.clientStartedAt ?? null);
      writeLocalDraft(localDraft);
      setPendingLocalSync(true);
      setSyncNotice("网络异常，答案已本地暂存，恢复网络后会自动同步。");
    } finally {
      setSaving(false);
    }
  }, [
    answers,
    clearExamState,
    clearLocalDraft,
    clientStartedAt,
    data,
    examId,
    handleAuthRequired,
    lockedByServer,
    lockedByTime,
    online,
    saving,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setClientStartedAt,
    setData,
    setDirty,
    setLoadError,
    setPendingLocalSync,
    setSavedAt,
    setSaving,
    setSyncNotice,
    submitted,
    writeLocalDraft
  ]);

  const submitExam = useCallback(async (trigger: StudentExamSubmitTrigger) => {
    if (!data || submitted || submitting || lockedByServer) {
      return;
    }

    if (!online) {
      const localDraft = buildStudentExamOfflineDraft(answers, clientStartedAt);
      setClientStartedAt(localDraft.clientStartedAt ?? null);
      writeLocalDraft(localDraft);
      setPendingLocalSync(true);
      setActionError("当前离线，无法提交。答案已本地暂存，请恢复网络后重试。");
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await flushExamEvents();
      const payload = await requestJson<ExamSubmitResponse>(
        `/api/student/exams/${examId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers })
        }
      );

      setResult(payload);
      setSavedAt(payload.submittedAt ?? new Date().toISOString());
      setDirty(false);
      setPendingLocalSync(false);
      clearLocalDraft();
      setAuthRequired(false);
      setSyncNotice(
        getStudentExamSubmitSyncNotice(
          payload.queuedReviewCount,
          payload.reviewPackSummary ?? null
        )
      );
      setActionMessage(
        getStudentExamSubmitMessage(trigger, payload.alreadySubmitted)
      );
      await loadReviewPack();

      setData((previous) =>
        mergeStudentExamSubmissionDetail(previous, payload, answers)
      );
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

      if (getRequestStatus(error) !== undefined) {
        setActionError(getStudentExamDetailRequestMessage(error, "提交失败"));
        return;
      }

      const localDraft = buildStudentExamOfflineDraft(answers, clientStartedAt);
      setClientStartedAt(localDraft.clientStartedAt ?? null);
      writeLocalDraft(localDraft);
      setPendingLocalSync(true);
      setActionError("网络异常，当前未提交。答案已本地暂存，请恢复网络后重试。");
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    clearExamState,
    clearLocalDraft,
    clientStartedAt,
    data,
    examId,
    flushExamEvents,
    handleAuthRequired,
    loadReviewPack,
    lockedByServer,
    online,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setClientStartedAt,
    setData,
    setDirty,
    setLoadError,
    setPendingLocalSync,
    setResult,
    setSavedAt,
    setSubmitting,
    setSyncNotice,
    submitted,
    submitting,
    writeLocalDraft
  ]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitExam("manual");
  }, [submitExam]);

  const handleAnswerChange = useCallback((
    questionId: string,
    value: string,
    startedAt: string | null
  ) => {
    if (!startedAt) {
      setClientStartedAt(new Date().toISOString());
    }
    setActionError(null);
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
    setDirty(true);
  }, [setActionError, setAnswers, setClientStartedAt, setDirty]);

  const handleSaveDraft = useCallback(() => {
    void saveDraft("manual");
  }, [saveDraft]);

  return {
    saveDraft,
    submitExam,
    handleSubmit,
    handleAnswerChange,
    handleSaveDraft
  };
}
