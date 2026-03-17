"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type { AssignmentDetail, AssignmentReviewPayload, AssignmentStageCopy, SubmitResult, UploadItem } from "./types";
import {
  buildAssignmentStageCopy,
  getStudentAssignmentDetailRequestMessage,
  getStudentAssignmentReviewRequestMessage,
  getStudentAssignmentUploadRequestMessage,
  isMissingStudentAssignmentDetailError
} from "./utils";

type AssignmentUploadsResponse = {
  data?: UploadItem[];
};

type AssignmentUploadMutationResponse = {
  data?: UploadItem[];
  removed?: boolean;
};

type RefreshStatus = "ok" | "failed" | "auth" | "missing";

export function useStudentAssignmentDetailPage(assignmentId: string) {
  const loadRequestIdRef = useRef(0);
  const hasAssignmentSnapshotRef = useRef(false);
  const hasReviewSnapshotRef = useRef(false);
  const hasUploadsSnapshotRef = useRef(false);
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [review, setReview] = useState<AssignmentReviewPayload | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const mathView = useMathViewSettings("student-assignment");
  const feedbackSectionRef = useRef<HTMLDivElement | null>(null);

  const clearAssignmentState = useCallback(() => {
    hasAssignmentSnapshotRef.current = false;
    hasReviewSnapshotRef.current = false;
    hasUploadsSnapshotRef.current = false;
    setData(null);
    setAnswers({});
    setResult(null);
    setReview(null);
    setUploads([]);
    setUploading(false);
    setDeletingUploadId(null);
    setSubmitting(false);
    setSubmissionText("");
    setLoadError(null);
    setPageNotice(null);
    setActionError(null);
    setActionMessage(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearAssignmentState();
    setAuthRequired(true);
  }, [clearAssignmentState]);

  const refreshUploads = useCallback(async (): Promise<RefreshStatus> => {
    try {
      const payload = await requestJson<AssignmentUploadsResponse>(`/api/student/assignments/${assignmentId}/uploads`);
      hasUploadsSnapshotRef.current = true;
      setUploads(Array.isArray(payload.data) ? payload.data : []);
      setAuthRequired(false);
      return "ok";
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }
      if (isMissingStudentAssignmentDetailError(error)) {
        clearAssignmentState();
        setAuthRequired(false);
        setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载作业详情失败"));
        return "missing";
      }
      if (!hasUploadsSnapshotRef.current) {
        setUploads([]);
      }
      return "failed";
    }
  }, [assignmentId, clearAssignmentState, handleAuthRequired]);

  const refreshReview = useCallback(async (): Promise<RefreshStatus> => {
    try {
      const payload = await requestJson<AssignmentReviewPayload>(`/api/student/assignments/${assignmentId}/review`);
      hasReviewSnapshotRef.current = true;
      setReview(payload);
      setAuthRequired(false);
      return "ok";
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }
      if (isMissingStudentAssignmentDetailError(error)) {
        clearAssignmentState();
        setAuthRequired(false);
        setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载作业详情失败"));
        return "missing";
      }
      if (!hasReviewSnapshotRef.current) {
        setReview(null);
      }
      return "failed";
    }
  }, [assignmentId, clearAssignmentState, handleAuthRequired]);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setPageLoading(true);
    setLoadError(null);
    setPageNotice(null);
    setActionError(null);
    setActionMessage(null);

    try {
      const payload = await requestJson<AssignmentDetail>(`/api/student/assignments/${assignmentId}`);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      setData(payload);
      hasAssignmentSnapshotRef.current = true;
      setAuthRequired(false);

      const shouldLoadReview = payload.progress?.status === "completed";
      const shouldLoadUploads = payload.assignment?.submissionType === "upload" || payload.assignment?.submissionType === "essay";
      const [reviewResult, uploadsResult] = await Promise.allSettled([
        shouldLoadReview ? requestJson<AssignmentReviewPayload>(`/api/student/assignments/${assignmentId}/review`) : Promise.resolve(null),
        shouldLoadUploads ? requestJson<AssignmentUploadsResponse>(`/api/student/assignments/${assignmentId}/uploads`) : Promise.resolve(null)
      ]);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const nextNotices: string[] = [];

      if (!shouldLoadReview) {
        hasReviewSnapshotRef.current = false;
        setReview(null);
      } else if (reviewResult.status === "fulfilled") {
        hasReviewSnapshotRef.current = true;
        setReview(reviewResult.value);
      } else {
        if (isAuthError(reviewResult.reason)) {
          handleAuthRequired();
          return;
        }
        if (isMissingStudentAssignmentDetailError(reviewResult.reason)) {
          clearAssignmentState();
          setAuthRequired(false);
          setLoadError(getStudentAssignmentDetailRequestMessage(reviewResult.reason, "加载作业详情失败"));
          return;
        }

        const reviewMessage = getStudentAssignmentReviewRequestMessage(reviewResult.reason, "老师反馈加载失败");
        if (!hasReviewSnapshotRef.current) {
          setReview(null);
        }
        nextNotices.push(
          hasReviewSnapshotRef.current
            ? `老师反馈刷新失败，已展示最近一次成功数据：${reviewMessage}`
            : `老师反馈加载失败：${reviewMessage}`
        );
      }

      if (!shouldLoadUploads) {
        hasUploadsSnapshotRef.current = false;
        setUploads([]);
      } else if (uploadsResult.status === "fulfilled") {
        const nextUploads = uploadsResult.value?.data;
        hasUploadsSnapshotRef.current = true;
        setUploads(Array.isArray(nextUploads) ? nextUploads : []);
      } else {
        if (isAuthError(uploadsResult.reason)) {
          handleAuthRequired();
          return;
        }
        if (isMissingStudentAssignmentDetailError(uploadsResult.reason)) {
          clearAssignmentState();
          setAuthRequired(false);
          setLoadError(getStudentAssignmentDetailRequestMessage(uploadsResult.reason, "加载作业详情失败"));
          return;
        }

        const uploadsMessage = getStudentAssignmentUploadRequestMessage(uploadsResult.reason, "上传记录加载失败");
        if (!hasUploadsSnapshotRef.current) {
          setUploads([]);
        }
        nextNotices.push(
          hasUploadsSnapshotRef.current
            ? `上传记录刷新失败，已展示最近一次成功数据：${uploadsMessage}`
            : `上传记录加载失败：${uploadsMessage}`
        );
      }

      setPageNotice(nextNotices.length ? nextNotices.join("；") : null);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      if (!hasAssignmentSnapshotRef.current || isMissingStudentAssignmentDetailError(error)) {
        clearAssignmentState();
      }
      setAuthRequired(false);
      setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载失败"));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setPageLoading(false);
      }
    }
  }, [assignmentId, clearAssignmentState, handleAuthRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (result) {
      feedbackSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (!files.length) return;

      setUploading(true);
      setActionError(null);
      setActionMessage(null);

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        const payload = await requestJson<AssignmentUploadMutationResponse>(`/api/student/assignments/${assignmentId}/uploads`, {
          method: "POST",
          body: formData
        });

        const savedCount = Array.isArray(payload.data) ? payload.data.length : files.length;
        const refreshStatus = await refreshUploads();
        if (refreshStatus === "auth" || refreshStatus === "missing") {
          return;
        }
        setActionMessage(
          refreshStatus === "ok"
            ? `已上传 ${savedCount} 份文件，确认后即可提交。`
            : `已上传 ${savedCount} 份文件，但上传列表刷新失败，请稍后重试。`
        );
      } catch (error) {
        if (isAuthError(error)) {
          handleAuthRequired();
        } else if (isMissingStudentAssignmentDetailError(error)) {
          clearAssignmentState();
          setAuthRequired(false);
          setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载作业详情失败"));
        } else {
          setActionError(getStudentAssignmentUploadRequestMessage(error, "上传失败"));
        }
      } finally {
        setUploading(false);
        event.target.value = "";
      }
    },
    [assignmentId, clearAssignmentState, handleAuthRequired, refreshUploads]
  );

  const handleDeleteUpload = useCallback(
    async (uploadId: string) => {
      setDeletingUploadId(uploadId);
      setActionError(null);
      setActionMessage(null);

      try {
        await requestJson<AssignmentUploadMutationResponse>(`/api/student/assignments/${assignmentId}/uploads?uploadId=${uploadId}`, {
          method: "DELETE"
        });

        const refreshStatus = await refreshUploads();
        if (refreshStatus === "auth" || refreshStatus === "missing") {
          return;
        }
        setActionMessage(
          refreshStatus === "ok"
            ? "已删除上传文件，可重新上传后再提交。"
            : "文件已删除，但上传列表刷新失败，请稍后重试。"
        );
      } catch (error) {
        if (isAuthError(error)) {
          handleAuthRequired();
        } else if (isMissingStudentAssignmentDetailError(error)) {
          clearAssignmentState();
          setAuthRequired(false);
          setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载作业详情失败"));
        } else {
          setActionError(getStudentAssignmentUploadRequestMessage(error, "删除失败"));
        }
      } finally {
        setDeletingUploadId(null);
      }
    },
    [assignmentId, clearAssignmentState, handleAuthRequired, refreshUploads]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setActionError(null);
      setActionMessage(null);

      try {
        const payload = await requestJson<SubmitResult>(`/api/student/assignments/${assignmentId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, submissionText })
        });

        hasAssignmentSnapshotRef.current = true;
        setResult(payload);
        setData((current) =>
          current
            ? {
                ...current,
                progress: {
                  ...(current.progress ?? {}),
                  status: "completed",
                  score: payload.score,
                  total: payload.total
                }
              }
            : current
        );

        const refreshStatus = await refreshReview();
        if (refreshStatus === "auth" || refreshStatus === "missing") {
          return;
        }
        setActionMessage(
          refreshStatus === "ok"
            ? "提交成功，已为你定位到下方结果与反馈区。"
            : "提交成功，但老师反馈刷新失败，请稍后重新进入查看。"
        );
      } catch (error) {
        if (isAuthError(error)) {
          handleAuthRequired();
        } else if (isMissingStudentAssignmentDetailError(error)) {
          clearAssignmentState();
          setAuthRequired(false);
          setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载作业详情失败"));
        } else {
          setActionError(getStudentAssignmentDetailRequestMessage(error, "提交失败"));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [answers, assignmentId, clearAssignmentState, handleAuthRequired, refreshReview, submissionText]
  );

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setActionError(null);
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const alreadyCompleted = data?.progress?.status === "completed" && !result;
  const isUpload = data?.assignment.submissionType === "upload";
  const isEssay = data?.assignment.submissionType === "essay";
  const isQuiz = Boolean(data) && !isUpload && !isEssay;
  const maxUploads = data?.assignment.maxUploads ?? 3;
  const hasUploads = uploads.length > 0;
  const hasText = Boolean(submissionText.trim());
  const answeredCount = data?.questions.reduce((count, question) => (answers[question.id] ? count + 1 : count), 0) ?? 0;
  const canSubmit = data
    ? alreadyCompleted
      ? false
      : isUpload
        ? hasUploads
        : isEssay
          ? hasUploads || hasText
          : data.questions.length > 0 && answeredCount === data.questions.length
    : false;
  const hasFeedbackContent = Boolean(
    result || review?.review || review?.rubrics?.length || review?.aiReview || (review?.questions?.length && isQuiz)
  );
  const stageCopy: AssignmentStageCopy = data
    ? buildAssignmentStageCopy({
        data,
        result,
        review,
        alreadyCompleted,
        isUpload,
        isEssay,
        uploadsCount: uploads.length,
        maxUploads,
        hasUploads,
        hasText,
        answeredCount
      })
    : { title: "", description: "" };
  const statusLabel = result ? "已提交" : alreadyCompleted ? "已完成" : canSubmit ? "待提交" : "进行中";

  return {
    data,
    answers,
    result,
    review,
    pageLoading,
    submitting,
    uploads,
    uploading,
    deletingUploadId,
    submissionText,
    authRequired,
    loadError,
    pageNotice,
    actionError,
    actionMessage,
    mathView,
    feedbackSectionRef,
    alreadyCompleted,
    isUpload,
    isEssay,
    isQuiz,
    maxUploads,
    hasUploads,
    hasText,
    answeredCount,
    canSubmit,
    hasFeedbackContent,
    stageCopy,
    statusLabel,
    load,
    handleUpload,
    handleDeleteUpload,
    handleSubmit,
    handleAnswerChange,
    setSubmissionText
  };
}
