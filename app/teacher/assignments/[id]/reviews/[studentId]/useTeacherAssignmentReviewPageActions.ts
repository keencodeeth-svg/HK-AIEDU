"use client";

import { useCallback, type Dispatch, type FormEventHandler, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  TeacherAssignmentAiReviewResult,
  TeacherAssignmentReviewData,
  TeacherAssignmentReviewItemState,
  TeacherAssignmentReviewQuestion,
  TeacherAssignmentReviewRubricState
} from "./types";
import {
  buildTeacherAssignmentReviewSubmitPayload,
  getTeacherAssignmentReviewRequestMessage,
  isMissingTeacherAssignmentReviewError
} from "./utils";

type TeacherAssignmentAiReviewResponse = {
  data?: {
    result?: TeacherAssignmentAiReviewResult | null;
  } | null;
};

type Setter<T> = Dispatch<SetStateAction<T>>;

type TeacherAssignmentReviewPageActionsOptions = {
  id: string;
  studentId: string;
  data: TeacherAssignmentReviewData | null;
  overallComment: string;
  itemState: TeacherAssignmentReviewItemState;
  rubricState: TeacherAssignmentReviewRubricState;
  wrongQuestions: TeacherAssignmentReviewQuestion[];
  loadRequestIdRef: MutableRefObject<number>;
  aiRequestIdRef: MutableRefObject<number>;
  saveRequestIdRef: MutableRefObject<number>;
  hasSnapshotRef: MutableRefObject<boolean>;
  clearReviewState: () => void;
  syncReviewState: (payload: TeacherAssignmentReviewData) => void;
  handleAuthRequired: () => void;
  setData: Setter<TeacherAssignmentReviewData | null>;
  setAuthRequired: Setter<boolean>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setSaving: Setter<boolean>;
  setMessage: Setter<string | null>;
  setLoadError: Setter<string | null>;
  setSaveError: Setter<string | null>;
  setAiError: Setter<string | null>;
  setAiLoading: Setter<boolean>;
  setAiReview: Setter<TeacherAssignmentAiReviewResult | null>;
};

export function useTeacherAssignmentReviewPageActions({
  id,
  studentId,
  data,
  overallComment,
  itemState,
  rubricState,
  wrongQuestions,
  loadRequestIdRef,
  aiRequestIdRef,
  saveRequestIdRef,
  hasSnapshotRef,
  clearReviewState,
  syncReviewState,
  handleAuthRequired,
  setData,
  setAuthRequired,
  setLoading,
  setRefreshing,
  setSaving,
  setMessage,
  setLoadError,
  setSaveError,
  setAiError,
  setAiLoading,
  setAiReview
}: TeacherAssignmentReviewPageActionsOptions) {
  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
        if (!hasSnapshotRef.current) {
          setData(null);
        }
      }
      setLoadError(null);

      try {
        const payload = await requestJson<TeacherAssignmentReviewData>(
          `/api/teacher/assignments/${id}/reviews/${studentId}`
        );
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        hasSnapshotRef.current = true;
        setAuthRequired(false);
        syncReviewState(payload);
      } catch (nextError) {
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }

        if (isMissingTeacherAssignmentReviewError(nextError) || !hasSnapshotRef.current) {
          clearReviewState();
        }
        setAuthRequired(false);
        setLoadError(getTeacherAssignmentReviewRequestMessage(nextError, "加载失败"));
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      clearReviewState,
      handleAuthRequired,
      hasSnapshotRef,
      id,
      loadRequestIdRef,
      setAuthRequired,
      setData,
      setLoadError,
      setLoading,
      setRefreshing,
      studentId,
      syncReviewState
    ]
  );

  const handleAiReview = useCallback(async () => {
    if (!data) return;
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;
    setAiLoading(true);
    setAiError(null);

    try {
      const payload = await requestJson<TeacherAssignmentAiReviewResponse>(
        `/api/teacher/assignments/${id}/ai-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId })
        }
      );
      if (requestId !== aiRequestIdRef.current) {
        return;
      }
      setAuthRequired(false);
      setAiReview(payload.data?.result ?? null);
    } catch (nextError) {
      if (requestId !== aiRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (isMissingTeacherAssignmentReviewError(nextError)) {
        clearReviewState();
        setLoadError(getTeacherAssignmentReviewRequestMessage(nextError, "加载失败"));
      } else {
        setAiError(getTeacherAssignmentReviewRequestMessage(nextError, "AI 批改失败"));
      }
    } finally {
      if (requestId === aiRequestIdRef.current) {
        setAiLoading(false);
      }
    }
  }, [
    aiRequestIdRef,
    clearReviewState,
    data,
    handleAuthRequired,
    id,
    setAiError,
    setAiLoading,
    setAiReview,
    setAuthRequired,
    setLoadError,
    studentId
  ]);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    async (event) => {
      event.preventDefault();
      if (!data) return;
      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      setSaving(true);
      setMessage(null);
      setSaveError(null);
      const payload = buildTeacherAssignmentReviewSubmitPayload({
        data,
        overallComment,
        wrongQuestions,
        itemState,
        rubricState
      });

      try {
        await requestJson(`/api/teacher/assignments/${id}/reviews/${studentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        setAuthRequired(false);
        setMessage("批改已保存并通知学生。");
      } catch (nextError) {
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherAssignmentReviewError(nextError)) {
          clearReviewState();
          setLoadError(getTeacherAssignmentReviewRequestMessage(nextError, "加载失败"));
        } else {
          setSaveError(getTeacherAssignmentReviewRequestMessage(nextError, "保存失败"));
        }
      } finally {
        if (requestId === saveRequestIdRef.current) {
          setSaving(false);
        }
      }
    },
    [
      clearReviewState,
      data,
      handleAuthRequired,
      id,
      itemState,
      overallComment,
      rubricState,
      saveRequestIdRef,
      setAuthRequired,
      setLoadError,
      setMessage,
      setSaveError,
      setSaving,
      studentId,
      wrongQuestions
    ]
  );

  return {
    load,
    handleAiReview,
    handleSubmit
  };
}
