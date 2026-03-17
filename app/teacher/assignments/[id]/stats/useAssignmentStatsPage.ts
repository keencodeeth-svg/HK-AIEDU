"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { AssignmentStatsData, AssignmentStatsRouteParams } from "./types";
import {
  getDistributionMaxCount,
  getDueRelativeLabel,
  getTeacherAssignmentStatsRequestMessage,
  isMissingTeacherAssignmentStatsError
} from "./utils";

export function useAssignmentStatsPage({ id }: AssignmentStatsRouteParams) {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);

  const [data, setData] = useState<AssignmentStatsData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const now = Date.now();

  const clearStatsState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData(null);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearStatsState();
    setError(null);
    setAuthRequired(true);
  }, [clearStatsState]);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
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
    setError(null);

    try {
      const payload = await requestJson<AssignmentStatsData>(
        `/api/teacher/assignments/${id}/stats`
      );
      if (requestId !== requestIdRef.current) {
        return;
      }
      hasSnapshotRef.current = true;
      setData(payload);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }

      if (isMissingTeacherAssignmentStatsError(nextError) || !hasSnapshotRef.current) {
        clearStatsState();
      }
      setError(getTeacherAssignmentStatsRequestMessage(nextError, "加载失败"));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearStatsState, handleAuthRequired, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxCount = useMemo(() => getDistributionMaxCount(data?.distribution ?? []), [data?.distribution]);
  const completionRate = data?.summary.students
    ? Math.round((data.summary.completed / data.summary.students) * 100)
    : 0;
  const lowScoreCount = data?.distribution.find((item) => item.label === "<60")?.count ?? 0;
  const watchQuestionCount = data?.questionStats.filter((item) => item.ratio < 80).length ?? 0;
  const dueRelativeLabel = data ? getDueRelativeLabel(data.assignment.dueDate, now) : "";

  return {
    id,
    data,
    authRequired,
    error,
    loading,
    refreshing,
    lastLoadedAt,
    now,
    maxCount,
    completionRate,
    lowScoreCount,
    watchQuestionCount,
    dueRelativeLabel,
    load
  };
}
