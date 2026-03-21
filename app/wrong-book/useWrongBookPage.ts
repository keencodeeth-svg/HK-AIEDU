"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import type {
  CorrectionTask,
  ReviewQueueData,
  ReviewQueueItem,
  Summary,
  WrongBookItem
} from "./types";
import {
  getWrongBookDefaultDueDate,
  hasWrongBookContent,
  isWrongBookActionBusy
} from "./utils";
import { useWrongBookActions } from "./useWrongBookActions";
import { useWrongBookLoaders } from "./useWrongBookLoaders";

export function useWrongBookPage() {
  const loadRequestIdRef = useRef(0);
  const hasHistorySnapshotRef = useRef(false);
  const hasCorrectionsSnapshotRef = useRef(false);
  const hasReviewQueueSnapshotRef = useRef(false);
  const [list, setList] = useState<WrongBookItem[]>([]);
  const [tasks, setTasks] = useState<CorrectionTask[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueData | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [reviewSubmitting, setReviewSubmitting] = useState<Record<string, boolean>>({});
  const [reviewMessages, setReviewMessages] = useState<Record<string, string>>({});
  const [taskGeneratorMessage, setTaskGeneratorMessage] = useState<string | null>(null);
  const [taskGeneratorErrors, setTaskGeneratorErrors] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [completingTaskIds, setCompletingTaskIds] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(() => getWrongBookDefaultDueDate());

  const clearTaskGeneratorFeedback = useCallback(() => {
    setTaskGeneratorMessage(null);
    setTaskGeneratorErrors([]);
  }, []);

  const clearActionNotice = useCallback(() => {
    setActionMessage(null);
    setActionError(null);
  }, []);

  const clearHistoryState = useCallback(() => {
    hasHistorySnapshotRef.current = false;
    setList([]);
    setSelected({});
  }, []);

  const clearCorrectionsState = useCallback(() => {
    hasCorrectionsSnapshotRef.current = false;
    setTasks([]);
    setSummary(null);
    setCompletingTaskIds({});
  }, []);

  const clearReviewQueueState = useCallback(() => {
    hasReviewQueueSnapshotRef.current = false;
    setReviewQueue(null);
    setReviewAnswers({});
    setReviewSubmitting({});
    setReviewMessages({});
  }, []);

  const clearWrongBookState = useCallback(() => {
    clearHistoryState();
    clearCorrectionsState();
    clearReviewQueueState();
    clearTaskGeneratorFeedback();
    clearActionNotice();
    setPageError(null);
    setLastLoadedAt(null);
  }, [
    clearActionNotice,
    clearCorrectionsState,
    clearHistoryState,
    clearReviewQueueState,
    clearTaskGeneratorFeedback
  ]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearWrongBookState();
    setLoading(false);
    setRefreshing(false);
    setCreatingTasks(false);
    setAuthRequired(true);
  }, [clearWrongBookState]);

  const { load } = useWrongBookLoaders({
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
  });

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSelect = useCallback(
    (id: string) => {
      clearTaskGeneratorFeedback();
      setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    [clearTaskGeneratorFeedback]
  );

  const handleReviewAnswerChange = useCallback(
    (questionId: string, value: string) => {
      setReviewAnswers((prev) => ({
        ...prev,
        [questionId]: value
      }));
      setReviewMessages((prev) => ({ ...prev, [questionId]: "" }));
      clearActionNotice();
    },
    [clearActionNotice]
  );

  const { handleCreateTasks, handleComplete, submitReview } = useWrongBookActions({
    list,
    selected,
    dueDate,
    reviewAnswers,
    load,
    handleAuthRequired,
    clearTaskGeneratorFeedback,
    clearActionNotice,
    setSelected,
    setReviewAnswers,
    setReviewSubmitting,
    setReviewMessages,
    setTaskGeneratorMessage,
    setTaskGeneratorErrors,
    setActionMessage,
    setActionError,
    setCreatingTasks,
    setCompletingTaskIds,
    setAuthRequired
  });

  const hasContent = hasWrongBookContent({
    list,
    tasks,
    reviewQueue,
    summary
  });
  const actionBusy = isWrongBookActionBusy({
    creatingTasks,
    completingTaskIds,
    reviewSubmitting
  });
  const lastLoadedAtLabel = lastLoadedAt ? formatLoadedTime(lastLoadedAt) : null;

  const updateDueDate = useCallback((value: string) => {
    setDueDate(value);
  }, []);

  return {
    list,
    tasks,
    summary,
    reviewQueue,
    selected,
    reviewAnswers,
    reviewSubmitting,
    reviewMessages,
    taskGeneratorMessage,
    taskGeneratorErrors,
    actionMessage,
    actionError,
    loading,
    refreshing,
    creatingTasks,
    completingTaskIds,
    pageError,
    authRequired,
    dueDate,
    hasContent,
    actionBusy,
    lastLoadedAtLabel,
    load,
    toggleSelect,
    handleReviewAnswerChange,
    handleCreateTasks,
    handleComplete,
    submitReview,
    updateDueDate
  };
}
