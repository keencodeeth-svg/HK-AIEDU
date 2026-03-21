import { useCallback, useRef, useState } from "react";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type { ExamDetail } from "./types";
import { getTeacherExamDetailDerivedState } from "./utils";

export function useTeacherExamDetailPageState() {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);

  const [data, setData] = useState<ExamDetail | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [publishingReviewPack, setPublishingReviewPack] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const mathView = useMathViewSettings("teacher-exam-detail");
  const now = Date.now();

  const clearExamDetailState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData(null);
    setLastLoadedAt(null);
    setPublishMessage(null);
    setPublishError(null);
    setStatusError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearExamDetailState();
    setLoadError(null);
    setAuthRequired(true);
  }, [clearExamDetailState]);

  const derivedState = getTeacherExamDetailDerivedState({
    data,
    lastLoadedAt,
    now
  });

  return {
    requestIdRef,
    hasSnapshotRef,
    data,
    authRequired,
    loadError,
    statusError,
    updatingStatus,
    publishingReviewPack,
    publishMessage,
    publishError,
    loading,
    refreshing,
    lastLoadedAt,
    mathView,
    now,
    rankedStudents: derivedState.rankedStudents,
    submittedRate: derivedState.submittedRate,
    topRiskStudent: derivedState.topRiskStudent,
    totalQuestionScore: derivedState.totalQuestionScore,
    dueRelativeLabel: derivedState.dueRelativeLabel,
    lastLoadedAtLabel: derivedState.lastLoadedAtLabel,
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
    setLastLoadedAt,
    clearExamDetailState,
    handleAuthRequired
  };
}
