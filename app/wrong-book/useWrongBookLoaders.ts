"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  CorrectionTask,
  CorrectionsResponse,
  ReviewQueueData,
  ReviewQueueResponse,
  Summary,
  WrongBookItem,
  WrongBookLoadStatus,
  WrongBookResponse
} from "./types";
import {
  getWrongBookCorrectionsRequestMessage,
  getWrongBookHistoryRequestMessage,
  getWrongBookReviewQueueRequestMessage,
  pruneWrongBookReviewState,
  pruneWrongBookSelection
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type WrongBookLoadMode = "initial" | "refresh";

type WrongBookLoadersOptions = {
  loadRequestIdRef: MutableRefObject<number>;
  hasHistorySnapshotRef: MutableRefObject<boolean>;
  hasCorrectionsSnapshotRef: MutableRefObject<boolean>;
  hasReviewQueueSnapshotRef: MutableRefObject<boolean>;
  clearHistoryState: () => void;
  clearCorrectionsState: () => void;
  clearReviewQueueState: () => void;
  clearWrongBookState: () => void;
  handleAuthRequired: () => void;
  setList: Setter<WrongBookItem[]>;
  setTasks: Setter<CorrectionTask[]>;
  setSummary: Setter<Summary | null>;
  setReviewQueue: Setter<ReviewQueueData | null>;
  setSelected: Setter<Record<string, boolean>>;
  setReviewAnswers: Setter<Record<string, string>>;
  setReviewSubmitting: Setter<Record<string, boolean>>;
  setReviewMessages: Setter<Record<string, string>>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useWrongBookLoaders({
  loadRequestIdRef,
  hasHistorySnapshotRef,
  hasCorrectionsSnapshotRef,
  hasReviewQueueSnapshotRef,
  clearHistoryState,
  clearCorrectionsState,
  clearReviewQueueState,
  clearWrongBookState,
  handleAuthRequired,
  setList,
  setTasks,
  setSummary,
  setReviewQueue,
  setSelected,
  setReviewAnswers,
  setReviewSubmitting,
  setReviewMessages,
  setLoading,
  setRefreshing,
  setPageError,
  setAuthRequired,
  setLastLoadedAt
}: WrongBookLoadersOptions) {
  const load = useCallback(async (mode: WrongBookLoadMode = "initial"): Promise<WrongBookLoadStatus> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [wrongResult, taskResult, queueResult] = await Promise.allSettled([
        requestJson<WrongBookResponse>("/api/wrong-book"),
        requestJson<CorrectionsResponse>("/api/corrections"),
        requestJson<ReviewQueueResponse>("/api/wrong-book/review-queue")
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return "stale";
      }

      const hasAuthFailure = [wrongResult, taskResult, queueResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );
      if (hasAuthFailure) {
        handleAuthRequired();
        return "auth";
      }

      const nextErrors: string[] = [];
      let hasSuccess = false;

      if (wrongResult.status === "fulfilled") {
        const nextList = wrongResult.value.data ?? [];
        hasHistorySnapshotRef.current = true;
        setList(nextList);
        setSelected((prev) => pruneWrongBookSelection(nextList, prev));
        hasSuccess = true;
      } else {
        if (!hasHistorySnapshotRef.current) {
          clearHistoryState();
        }
        nextErrors.push(
          `错题本加载失败：${getWrongBookHistoryRequestMessage(
            wrongResult.reason,
            "加载错题本失败"
          )}`
        );
      }

      if (taskResult.status === "fulfilled") {
        hasCorrectionsSnapshotRef.current = true;
        setTasks(taskResult.value.data ?? []);
        setSummary(taskResult.value.summary ?? null);
        hasSuccess = true;
      } else {
        if (!hasCorrectionsSnapshotRef.current) {
          clearCorrectionsState();
        }
        nextErrors.push(
          `订正任务加载失败：${getWrongBookCorrectionsRequestMessage(
            taskResult.reason,
            "加载订正任务失败"
          )}`
        );
      }

      if (queueResult.status === "fulfilled") {
        const nextReviewQueue = queueResult.value.data ?? null;
        hasReviewQueueSnapshotRef.current = true;
        setReviewQueue(nextReviewQueue);
        setReviewAnswers((prev) => pruneWrongBookReviewState(nextReviewQueue, prev));
        setReviewSubmitting((prev) => pruneWrongBookReviewState(nextReviewQueue, prev));
        setReviewMessages((prev) => pruneWrongBookReviewState(nextReviewQueue, prev));
        hasSuccess = true;
      } else {
        if (!hasReviewQueueSnapshotRef.current) {
          clearReviewQueueState();
        }
        nextErrors.push(
          `复练队列加载失败：${getWrongBookReviewQueueRequestMessage(
            queueResult.reason,
            "加载复练队列失败"
          )}`
        );
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      setPageError(nextErrors.length ? nextErrors.join("；") : null);
      if (!nextErrors.length) {
        return "loaded";
      }
      return hasSuccess ? "partial" : "error";
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "auth";
      }

      if (
        !hasHistorySnapshotRef.current &&
        !hasCorrectionsSnapshotRef.current &&
        !hasReviewQueueSnapshotRef.current
      ) {
        clearWrongBookState();
      }
      setAuthRequired(false);
      setPageError(getWrongBookHistoryRequestMessage(nextError, "加载错题闭环失败"));
      return "error";
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    clearCorrectionsState,
    clearHistoryState,
    clearReviewQueueState,
    clearWrongBookState,
    handleAuthRequired,
    hasCorrectionsSnapshotRef,
    hasHistorySnapshotRef,
    hasReviewQueueSnapshotRef,
    loadRequestIdRef,
    setAuthRequired,
    setLastLoadedAt,
    setList,
    setLoading,
    setPageError,
    setRefreshing,
    setReviewAnswers,
    setReviewMessages,
    setReviewQueue,
    setReviewSubmitting,
    setSelected,
    setSummary,
    setTasks
  ]);

  return {
    load
  };
}
