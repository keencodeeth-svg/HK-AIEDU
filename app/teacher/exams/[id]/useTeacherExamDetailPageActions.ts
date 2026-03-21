"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ExamDetail } from "./types";
import {
  buildTeacherExamReviewPackMessage,
  getTeacherExamDetailRequestMessage,
  isMissingTeacherExamDetailError,
  updateTeacherExamDetailStatus
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type LoadMode = "initial" | "refresh";

type TeacherExamDetailPageActionsOptions = {
  id: string;
  data: ExamDetail | null;
  updatingStatus: boolean;
  publishingReviewPack: boolean;
  requestIdRef: MutableRefObject<number>;
  hasSnapshotRef: MutableRefObject<boolean>;
  clearExamDetailState: () => void;
  handleAuthRequired: () => void;
  setData: Setter<ExamDetail | null>;
  setAuthRequired: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setStatusError: Setter<string | null>;
  setUpdatingStatus: Setter<boolean>;
  setPublishingReviewPack: Setter<boolean>;
  setPublishMessage: Setter<string | null>;
  setPublishError: Setter<string | null>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useTeacherExamDetailPageActions({
  id,
  data,
  updatingStatus,
  publishingReviewPack,
  requestIdRef,
  hasSnapshotRef,
  clearExamDetailState,
  handleAuthRequired,
  setData,
  setAuthRequired,
  setLoadError,
  setStatusError,
  setUpdatingStatus,
  setPublishingReviewPack,
  setPublishMessage,
  setPublishError,
  setLoading,
  setRefreshing,
  setLastLoadedAt
}: TeacherExamDetailPageActionsOptions) {
  const load = useCallback(
    async (mode: LoadMode = "initial") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

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
        const payload = await requestJson<ExamDetail>(`/api/teacher/exams/${id}`);
        if (requestId !== requestIdRef.current) {
          return;
        }
        hasSnapshotRef.current = true;
        setAuthRequired(false);
        setData(payload);
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }

        const nextMessage = getTeacherExamDetailRequestMessage(nextError, "加载失败");
        if (isMissingTeacherExamDetailError(nextError) || !hasSnapshotRef.current) {
          clearExamDetailState();
        }
        setLoadError(nextMessage);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      clearExamDetailState,
      handleAuthRequired,
      hasSnapshotRef,
      id,
      requestIdRef,
      setAuthRequired,
      setData,
      setLastLoadedAt,
      setLoadError,
      setLoading,
      setRefreshing
    ]
  );

  const handleStatusAction = useCallback(
    async (action: "close" | "reopen") => {
      if (!data || updatingStatus) {
        return;
      }

      setUpdatingStatus(true);
      setStatusError(null);

      try {
        const payload = await requestJson<{ data?: { status?: ExamDetail["exam"]["status"] } }>(
          `/api/teacher/exams/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action })
          }
        );
        setAuthRequired(false);
        setData((prev) => updateTeacherExamDetailStatus(prev, payload?.data?.status));
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherExamDetailError(nextError)) {
          clearExamDetailState();
          setLoadError(getTeacherExamDetailRequestMessage(nextError, "加载失败"));
        } else {
          setStatusError(getTeacherExamDetailRequestMessage(nextError, "更新失败"));
        }
      } finally {
        setUpdatingStatus(false);
      }
    },
    [
      clearExamDetailState,
      data,
      handleAuthRequired,
      id,
      setAuthRequired,
      setData,
      setLastLoadedAt,
      setLoadError,
      setStatusError,
      setUpdatingStatus,
      updatingStatus
    ]
  );

  const handlePublishReviewPack = useCallback(
    async (dryRun: boolean) => {
      if (!data || publishingReviewPack) {
        return;
      }

      setPublishMessage(null);
      setPublishError(null);
      setPublishingReviewPack(true);

      try {
        const payload = await requestJson<{
          data?: {
            message?: string;
            publishedStudents?: number;
            targetedStudents?: number;
            skippedLowRisk?: number;
            skippedNoSubmission?: number;
          };
        }>(`/api/teacher/exams/${id}/review-pack/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minRiskLevel: "high",
            includeParents: true,
            dryRun
          })
        });

        setPublishMessage(buildTeacherExamReviewPackMessage(payload?.data, dryRun));
        setAuthRequired(false);
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherExamDetailError(nextError)) {
          clearExamDetailState();
          setLoadError(getTeacherExamDetailRequestMessage(nextError, "加载失败"));
        } else {
          setPublishError(getTeacherExamDetailRequestMessage(nextError, "发布失败"));
        }
      } finally {
        setPublishingReviewPack(false);
      }
    },
    [
      clearExamDetailState,
      data,
      handleAuthRequired,
      id,
      publishingReviewPack,
      setAuthRequired,
      setLoadError,
      setPublishError,
      setPublishMessage,
      setPublishingReviewPack
    ]
  );

  return {
    load,
    handleStatusAction,
    handlePublishReviewPack
  };
}
