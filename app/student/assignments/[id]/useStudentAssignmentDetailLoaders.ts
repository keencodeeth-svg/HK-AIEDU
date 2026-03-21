"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AssignmentDetail,
  AssignmentRefreshStatus,
  AssignmentReviewPayload,
  UploadItem
} from "./types";
import {
  buildStudentAssignmentSnapshotNotice,
  getStudentAssignmentDetailRequestMessage,
  getStudentAssignmentReviewRequestMessage,
  getStudentAssignmentUploadRequestMessage,
  isMissingStudentAssignmentDetailError,
  shouldLoadStudentAssignmentReview,
  shouldLoadStudentAssignmentUploads
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AssignmentUploadsResponse = {
  data?: UploadItem[];
};

type StudentAssignmentDetailLoadersOptions = {
  assignmentId: string;
  loadRequestIdRef: MutableRefObject<number>;
  reviewRequestIdRef: MutableRefObject<number>;
  uploadsRequestIdRef: MutableRefObject<number>;
  hasAssignmentSnapshotRef: MutableRefObject<boolean>;
  hasReviewSnapshotRef: MutableRefObject<boolean>;
  hasUploadsSnapshotRef: MutableRefObject<boolean>;
  clearAssignmentState: () => void;
  handleAuthRequired: () => void;
  handleMissingAssignmentError: (error: unknown) => void;
  setData: Setter<AssignmentDetail | null>;
  setReview: Setter<AssignmentReviewPayload | null>;
  setUploads: Setter<UploadItem[]>;
  setPageLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setPageNotice: Setter<string | null>;
  setActionError: Setter<string | null>;
  setActionMessage: Setter<string | null>;
};

export function useStudentAssignmentDetailLoaders({
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
}: StudentAssignmentDetailLoadersOptions) {
  const refreshUploads = useCallback(async (): Promise<AssignmentRefreshStatus> => {
    const requestId = uploadsRequestIdRef.current + 1;
    uploadsRequestIdRef.current = requestId;

    try {
      const payload = await requestJson<AssignmentUploadsResponse>(
        `/api/student/assignments/${assignmentId}/uploads`
      );
      if (uploadsRequestIdRef.current !== requestId) {
        return "stale";
      }
      hasUploadsSnapshotRef.current = true;
      setUploads(Array.isArray(payload.data) ? payload.data : []);
      setAuthRequired(false);
      return "ok";
    } catch (error) {
      if (uploadsRequestIdRef.current !== requestId) {
        return "stale";
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }
      if (isMissingStudentAssignmentDetailError(error)) {
        handleMissingAssignmentError(error);
        return "missing";
      }
      if (!hasUploadsSnapshotRef.current) {
        setUploads([]);
      }
      return "failed";
    }
  }, [
    assignmentId,
    handleAuthRequired,
    handleMissingAssignmentError,
    hasUploadsSnapshotRef,
    setAuthRequired,
    setUploads,
    uploadsRequestIdRef
  ]);

  const refreshReview = useCallback(async (): Promise<AssignmentRefreshStatus> => {
    const requestId = reviewRequestIdRef.current + 1;
    reviewRequestIdRef.current = requestId;

    try {
      const payload = await requestJson<AssignmentReviewPayload>(
        `/api/student/assignments/${assignmentId}/review`
      );
      if (reviewRequestIdRef.current !== requestId) {
        return "stale";
      }
      hasReviewSnapshotRef.current = true;
      setReview(payload);
      setAuthRequired(false);
      return "ok";
    } catch (error) {
      if (reviewRequestIdRef.current !== requestId) {
        return "stale";
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }
      if (isMissingStudentAssignmentDetailError(error)) {
        handleMissingAssignmentError(error);
        return "missing";
      }
      if (!hasReviewSnapshotRef.current) {
        setReview(null);
      }
      return "failed";
    }
  }, [
    assignmentId,
    handleAuthRequired,
    handleMissingAssignmentError,
    hasReviewSnapshotRef,
    reviewRequestIdRef,
    setAuthRequired,
    setReview
  ]);

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

      const shouldLoadReview = shouldLoadStudentAssignmentReview(payload);
      const shouldLoadUploads = shouldLoadStudentAssignmentUploads(payload);
      const reviewRequestId = reviewRequestIdRef.current + 1;
      const uploadsRequestId = uploadsRequestIdRef.current + 1;
      reviewRequestIdRef.current = reviewRequestId;
      uploadsRequestIdRef.current = uploadsRequestId;

      const [reviewResult, uploadsResult] = await Promise.allSettled([
        shouldLoadReview
          ? requestJson<AssignmentReviewPayload>(`/api/student/assignments/${assignmentId}/review`)
          : Promise.resolve(null),
        shouldLoadUploads
          ? requestJson<AssignmentUploadsResponse>(`/api/student/assignments/${assignmentId}/uploads`)
          : Promise.resolve(null)
      ]);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const nextNotices: string[] = [];

      if (reviewRequestIdRef.current === reviewRequestId) {
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
            handleMissingAssignmentError(reviewResult.reason);
            return;
          }

          const reviewMessage = getStudentAssignmentReviewRequestMessage(
            reviewResult.reason,
            "老师反馈加载失败"
          );
          const hasReviewSnapshot = hasReviewSnapshotRef.current;
          if (!hasReviewSnapshot) {
            setReview(null);
          }
          nextNotices.push(
            buildStudentAssignmentSnapshotNotice("老师反馈", reviewMessage, hasReviewSnapshot)
          );
        }
      }

      if (uploadsRequestIdRef.current === uploadsRequestId) {
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
            handleMissingAssignmentError(uploadsResult.reason);
            return;
          }

          const uploadsMessage = getStudentAssignmentUploadRequestMessage(
            uploadsResult.reason,
            "上传记录加载失败"
          );
          const hasUploadsSnapshot = hasUploadsSnapshotRef.current;
          if (!hasUploadsSnapshot) {
            setUploads([]);
          }
          nextNotices.push(
            buildStudentAssignmentSnapshotNotice("上传记录", uploadsMessage, hasUploadsSnapshot)
          );
        }
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
  }, [
    assignmentId,
    clearAssignmentState,
    handleAuthRequired,
    handleMissingAssignmentError,
    hasAssignmentSnapshotRef,
    hasReviewSnapshotRef,
    hasUploadsSnapshotRef,
    loadRequestIdRef,
    reviewRequestIdRef,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setData,
    setLoadError,
    setPageLoading,
    setPageNotice,
    setReview,
    setUploads,
    uploadsRequestIdRef
  ]);

  return {
    load,
    refreshReview,
    refreshUploads
  };
}
