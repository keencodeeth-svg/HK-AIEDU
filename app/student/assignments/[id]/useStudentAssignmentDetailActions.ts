"use client";

import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AssignmentDetail,
  AssignmentRefreshStatus,
  SubmitResult,
  UploadItem
} from "./types";
import {
  getStudentAssignmentDetailRequestMessage,
  getStudentAssignmentDeleteUploadSuccessMessage,
  getStudentAssignmentSubmitSuccessMessage,
  getStudentAssignmentUploadRequestMessage,
  getStudentAssignmentUploadSuccessMessage,
  isMissingStudentAssignmentDetailError,
  mergeStudentAssignmentSubmitResult
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AssignmentUploadMutationResponse = {
  data?: UploadItem[];
  removed?: boolean;
};

type StudentAssignmentDetailActionsOptions = {
  assignmentId: string;
  answers: Record<string, string>;
  submissionText: string;
  refreshUploads: () => Promise<AssignmentRefreshStatus>;
  refreshReview: () => Promise<AssignmentRefreshStatus>;
  handleAuthRequired: () => void;
  handleMissingAssignmentError: (error: unknown) => void;
  setData: Setter<AssignmentDetail | null>;
  setResult: Setter<SubmitResult | null>;
  setSubmitting: Setter<boolean>;
  setUploading: Setter<boolean>;
  setDeletingUploadId: Setter<string | null>;
  setActionError: Setter<string | null>;
  setActionMessage: Setter<string | null>;
};

export function useStudentAssignmentDetailActions({
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
}: StudentAssignmentDetailActionsOptions) {
  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    setUploading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const payload = await requestJson<AssignmentUploadMutationResponse>(
        `/api/student/assignments/${assignmentId}/uploads`,
        {
          method: "POST",
          body: formData
        }
      );

      const savedCount = Array.isArray(payload.data) ? payload.data.length : files.length;
      const refreshStatus = await refreshUploads();
      if (refreshStatus === "auth" || refreshStatus === "missing") {
        return;
      }
      setActionMessage(getStudentAssignmentUploadSuccessMessage(savedCount, refreshStatus));
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingStudentAssignmentDetailError(error)) {
        handleMissingAssignmentError(error);
      } else {
        setActionError(getStudentAssignmentUploadRequestMessage(error, "上传失败"));
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }, [
    assignmentId,
    handleAuthRequired,
    handleMissingAssignmentError,
    refreshUploads,
    setActionError,
    setActionMessage,
    setUploading
  ]);

  const handleDeleteUpload = useCallback(async (uploadId: string) => {
    setDeletingUploadId(uploadId);
    setActionError(null);
    setActionMessage(null);

    try {
      await requestJson<AssignmentUploadMutationResponse>(
        `/api/student/assignments/${assignmentId}/uploads?uploadId=${uploadId}`,
        {
          method: "DELETE"
        }
      );

      const refreshStatus = await refreshUploads();
      if (refreshStatus === "auth" || refreshStatus === "missing") {
        return;
      }
      setActionMessage(getStudentAssignmentDeleteUploadSuccessMessage(refreshStatus));
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingStudentAssignmentDetailError(error)) {
        handleMissingAssignmentError(error);
      } else {
        setActionError(getStudentAssignmentUploadRequestMessage(error, "删除失败"));
      }
    } finally {
      setDeletingUploadId(null);
    }
  }, [
    assignmentId,
    handleAuthRequired,
    handleMissingAssignmentError,
    refreshUploads,
    setActionError,
    setActionMessage,
    setDeletingUploadId
  ]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const payload = await requestJson<SubmitResult>(
        `/api/student/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, submissionText })
        }
      );

      setResult(payload);
      setData((current) => mergeStudentAssignmentSubmitResult(current, payload));

      const refreshStatus = await refreshReview();
      if (refreshStatus === "auth" || refreshStatus === "missing") {
        return;
      }
      setActionMessage(getStudentAssignmentSubmitSuccessMessage(refreshStatus));
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingStudentAssignmentDetailError(error)) {
        handleMissingAssignmentError(error);
      } else {
        setActionError(getStudentAssignmentDetailRequestMessage(error, "提交失败"));
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    assignmentId,
    handleAuthRequired,
    handleMissingAssignmentError,
    refreshReview,
    setActionError,
    setActionMessage,
    setData,
    setResult,
    setSubmitting,
    submissionText
  ]);

  return {
    handleUpload,
    handleDeleteUpload,
    handleSubmit
  };
}
