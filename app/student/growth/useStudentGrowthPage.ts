"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { StudentGrowthData } from "./types";
import { getStudentGrowthRequestMessage } from "./utils";

type StudentGrowthResponse = StudentGrowthData & {
  error?: string;
};

export function useStudentGrowthPage() {
  const requestIdRef = useRef(0);
  const hasGrowthSnapshotRef = useRef(false);
  const [data, setData] = useState<StudentGrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const clearGrowthState = useCallback(() => {
    hasGrowthSnapshotRef.current = false;
    setData(null);
    setPageError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearGrowthState();
    setAuthRequired(true);
  }, [clearGrowthState]);

  const loadGrowth = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const isRefresh = mode === "refresh";

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const payload = await requestJson<StudentGrowthResponse>("/api/student/growth");
        if (requestId !== requestIdRef.current) {
          return;
        }

        setData(payload);
        setAuthRequired(false);
        hasGrowthSnapshotRef.current = true;
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (isAuthError(error)) {
          handleAuthRequired();
        } else {
          if (!hasGrowthSnapshotRef.current) {
            clearGrowthState();
          }
          setAuthRequired(false);
          setPageError(getStudentGrowthRequestMessage(error, "加载成长档案失败"));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clearGrowthState, handleAuthRequired]
  );

  useEffect(() => {
    void loadGrowth();
  }, [loadGrowth]);

  return {
    data,
    loading,
    refreshing,
    pageError,
    authRequired,
    loadGrowth
  };
}
