"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type {
  AssignmentDetail,
  AssignmentReviewPayload,
  SubmitResult,
  UploadItem
} from "./types";
import {
  deriveStudentAssignmentPageState,
  getStudentAssignmentDetailRequestMessage,
  isMissingStudentAssignmentDetailError
} from "./utils";
import { useStudentAssignmentDetailActions } from "./useStudentAssignmentDetailActions";
import { useStudentAssignmentDetailLoaders } from "./useStudentAssignmentDetailLoaders";

export function useStudentAssignmentDetailPage(assignmentId: string) {
  const loadRequestIdRef = useRef(0);
  const reviewRequestIdRef = useRef(0);
  const uploadsRequestIdRef = useRef(0);
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

  const handleMissingAssignmentError = useCallback((error: unknown) => {
    if (!isMissingStudentAssignmentDetailError(error)) {
      return;
    }
    clearAssignmentState();
    setAuthRequired(false);
    setLoadError(getStudentAssignmentDetailRequestMessage(error, "加载作业详情失败"));
  }, [clearAssignmentState]);

  const { load, refreshReview, refreshUploads } = useStudentAssignmentDetailLoaders({
    assignmentId,
    loadRequestIdRef,
    reviewRequestIdRef,
    uploadsRequestIdRef,
    hasAssignmentSnapshotRef,
    hasReviewSnapshotRef,
    hasUploadsSnapshotRef,
    clearAssignmentState,
    handleAuthRequired,
    handleMissingAssignmentError,
    setData,
    setReview,
    setUploads,
    setPageLoading,
    setAuthRequired,
    setLoadError,
    setPageNotice,
    setActionError,
    setActionMessage
  });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (result) {
      feedbackSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const { handleUpload, handleDeleteUpload, handleSubmit } = useStudentAssignmentDetailActions({
    assignmentId,
    answers,
    submissionText,
    refreshUploads,
    refreshReview,
    handleAuthRequired,
    handleMissingAssignmentError,
    setData,
    setResult,
    setSubmitting,
    setUploading,
    setDeletingUploadId,
    setActionError,
    setActionMessage
  });

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setActionError(null);
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const assignmentState = deriveStudentAssignmentPageState({
    data,
    answers,
    result,
    review,
    uploads,
    submissionText
  });

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
    ...assignmentState,
    load,
    handleUpload,
    handleDeleteUpload,
    handleSubmit,
    handleAnswerChange,
    setSubmissionText
  };
}
