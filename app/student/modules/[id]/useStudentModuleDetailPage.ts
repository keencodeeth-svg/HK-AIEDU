"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { StudentModuleDetailData, StudentModuleDetailResponse } from "./types";
import {
  buildStudentModuleStageCopy,
  getStudentModuleDetailRequestMessage,
  isMissingStudentModuleDetailError
} from "./utils";

export function useStudentModuleDetailPage(moduleId: string) {
  const requestIdRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const [data, setData] = useState<StudentModuleDetailData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearModuleState = useCallback(() => {
    hasSnapshotRef.current = false;
    setData(null);
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearModuleState();
    setPageError(null);
    setAuthRequired(true);
  }, [clearModuleState]);

  const loadModule = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === "initial") {
        setLoading(true);
        if (!hasSnapshotRef.current) {
          setData(null);
        }
      } else {
        setRefreshing(true);
      }
      setPageError(null);

      try {
        const payload = await requestJson<StudentModuleDetailResponse>(`/api/student/modules/${moduleId}`);
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (!payload.data) {
          throw new Error("模块数据缺失");
        }
        hasSnapshotRef.current = true;
        setData(payload.data);
        setAuthRequired(false);
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
        } else {
          if (isMissingStudentModuleDetailError(error) || !hasSnapshotRef.current) {
            clearModuleState();
          }
          setAuthRequired(false);
          setPageError(getStudentModuleDetailRequestMessage(error, "加载模块详情失败"));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clearModuleState, handleAuthRequired, moduleId]
  );

  useEffect(() => {
    void loadModule("initial");
  }, [loadModule]);

  const resourceCount = data?.resources.length ?? 0;
  const assignmentCount = data?.assignments.length ?? 0;
  const completedCount = useMemo(
    () => data?.assignments.filter((assignment) => assignment.status === "completed").length ?? 0,
    [data]
  );
  const pendingCount = Math.max(assignmentCount - completedCount, 0);
  const progressPercent = assignmentCount ? Math.round((completedCount / assignmentCount) * 100) : 0;
  const fileResourceCount = useMemo(
    () => data?.resources.filter((resource) => resource.resourceType === "file").length ?? 0,
    [data]
  );
  const linkResourceCount = Math.max(resourceCount - fileResourceCount, 0);

  const stageCopy = buildStudentModuleStageCopy({
    loading,
    hasData: Boolean(data),
    resourceCount,
    assignmentCount,
    pendingCount
  });

  return {
    data,
    authRequired,
    loading,
    refreshing,
    pageError,
    lastLoadedAt,
    resourceCount,
    assignmentCount,
    completedCount,
    pendingCount,
    progressPercent,
    fileResourceCount,
    linkResourceCount,
    stageCopy,
    loadModule
  };
}
