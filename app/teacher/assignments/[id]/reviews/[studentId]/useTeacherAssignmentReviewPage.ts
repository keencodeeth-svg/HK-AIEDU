"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEventHandler } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  TeacherAssignmentAiReviewResult,
  TeacherAssignmentReviewData,
  TeacherAssignmentReviewItemState,
  TeacherAssignmentReviewRouteParams,
  TeacherAssignmentReviewRubricState
} from "./types";
import {
  buildReviewItemState,
  buildReviewRubricState,
  getTeacherAssignmentReviewRequestMessage,
  isMissingTeacherAssignmentReviewError
} from "./utils";

type TeacherAssignmentAiReviewResponse = {
  data?: {
    result?: TeacherAssignmentAiReviewResult | null;
  } | null;
};

export function useTeacherAssignmentReviewPage({ id, studentId }: TeacherAssignmentReviewRouteParams) {
  const loadRequestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);

  const [data, setData] = useState<TeacherAssignmentReviewData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overallComment, setOverallComment] = useState("");
  const [itemState, setItemState] = useState<TeacherAssignmentReviewItemState>({});
  const [rubricState, setRubricState] = useState<TeacherAssignmentReviewRubricState>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<TeacherAssignmentAiReviewResult | null>(null);

  const clearReviewState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData(null);
    setOverallComment("");
    setItemState({});
    setRubricState({});
    setAiReview(null);
    setMessage(null);
    setSaveError(null);
    setAiError(null);
  }, []);

  const syncReviewState = useCallback((payload: TeacherAssignmentReviewData) => {
    setData(payload);
    setOverallComment(payload.review?.overallComment ?? "");
    setItemState(buildReviewItemState(payload.reviewItems ?? []));
    setRubricState(buildReviewRubricState(payload.reviewRubrics ?? [], payload.rubrics ?? []));
    setAiReview(payload.aiReview?.result ?? null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearReviewState();
    setLoadError(null);
    setAuthRequired(true);
  }, [clearReviewState]);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
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
      const payload = await requestJson<TeacherAssignmentReviewData>(`/api/teacher/assignments/${id}/reviews/${studentId}`);
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
  }, [clearReviewState, handleAuthRequired, id, studentId, syncReviewState]);

  useEffect(() => {
    void load();
  }, [load]);

  const wrongQuestions = useMemo(
    () => (data?.questions ?? []).filter((item) => !item.correct),
    [data]
  );
  const canAiReview =
    (data?.uploads?.length ?? 0) > 0 || Boolean(data?.submission?.submissionText?.trim());
  const isEssay = data?.assignment?.submissionType === "essay";
  const isUpload = data?.assignment?.submissionType === "upload";
  const isQuiz = !isEssay && !isUpload;

  const handleAiReview = useCallback(async () => {
    if (!data) return;
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;
    setAiLoading(true);
    setAiError(null);

    try {
      const payload = await requestJson<TeacherAssignmentAiReviewResponse>(`/api/teacher/assignments/${id}/ai-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId })
      });
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
  }, [clearReviewState, data, handleAuthRequired, id, studentId]);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(async (event) => {
    event.preventDefault();
    if (!data) return;
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    const items = wrongQuestions.map((question) => ({
      questionId: question.id,
      wrongTag: itemState[question.id]?.wrongTag || "",
      comment: itemState[question.id]?.comment || ""
    }));
    const rubrics = data.rubrics.map((rubric) => ({
      rubricId: rubric.id,
      score: rubricState[rubric.id]?.score ?? 0,
      comment: rubricState[rubric.id]?.comment ?? ""
    }));

    try {
      await requestJson(`/api/teacher/assignments/${id}/reviews/${studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overallComment, items, rubrics })
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
  }, [clearReviewState, data, handleAuthRequired, id, itemState, overallComment, rubricState, studentId, wrongQuestions]);

  const handleQuestionWrongTagChange = useCallback((questionId: string, value: string) => {
    setItemState((prev) => ({
      ...prev,
      [questionId]: {
        wrongTag: value,
        comment: prev[questionId]?.comment ?? ""
      }
    }));
  }, []);

  const handleQuestionCommentChange = useCallback((questionId: string, value: string) => {
    setItemState((prev) => ({
      ...prev,
      [questionId]: {
        wrongTag: prev[questionId]?.wrongTag ?? "",
        comment: value
      }
    }));
  }, []);

  const handleRubricScoreChange = useCallback((rubricId: string, value: number) => {
    setRubricState((prev) => ({
      ...prev,
      [rubricId]: {
        score: value,
        comment: prev[rubricId]?.comment ?? ""
      }
    }));
  }, []);

  const handleRubricCommentChange = useCallback((rubricId: string, value: string) => {
    setRubricState((prev) => ({
      ...prev,
      [rubricId]: {
        score: prev[rubricId]?.score ?? 0,
        comment: value
      }
    }));
  }, []);

  return {
    id,
    studentId,
    data,
    authRequired,
    loading,
    refreshing,
    overallComment,
    itemState,
    rubricState,
    saving,
    message,
    loadError,
    saveError,
    aiError,
    aiLoading,
    aiReview,
    wrongQuestions,
    canAiReview,
    isEssay,
    isUpload,
    isQuiz,
    setOverallComment,
    load,
    handleAiReview,
    handleSubmit,
    handleQuestionWrongTagChange,
    handleQuestionCommentChange,
    handleRubricScoreChange,
    handleRubricCommentChange
  };
}
