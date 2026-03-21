"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ClassItem, KnowledgePoint } from "./types";
import { getTeacherAiToolsRequestMessage } from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type TeacherClassesResponse = {
  data?: ClassItem[];
};

type KnowledgePointsResponse = {
  data?: KnowledgePoint[];
};

type TeacherAiToolsLoadersOptions = {
  bootstrapRequestIdRef: MutableRefObject<number>;
  hasClassesSnapshotRef: MutableRefObject<boolean>;
  hasKnowledgePointsSnapshotRef: MutableRefObject<boolean>;
  handleAuthRequired: () => void;
  setClasses: Setter<ClassItem[]>;
  setKnowledgePoints: Setter<KnowledgePoint[]>;
  setAuthRequired: Setter<boolean>;
  setPageLoading: Setter<boolean>;
  setPageReady: Setter<boolean>;
  setPageError: Setter<string | null>;
  setBootstrapNotice: Setter<string | null>;
  setKnowledgePointsNotice: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
};

export function useTeacherAiToolsLoaders({
  bootstrapRequestIdRef,
  hasClassesSnapshotRef,
  hasKnowledgePointsSnapshotRef,
  handleAuthRequired,
  setClasses,
  setKnowledgePoints,
  setAuthRequired,
  setPageLoading,
  setPageReady,
  setPageError,
  setBootstrapNotice,
  setKnowledgePointsNotice,
  setLastLoadedAt
}: TeacherAiToolsLoadersOptions) {
  const loadBootstrapData = useCallback(async () => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    setAuthRequired(false);
    setPageLoading(true);
    setPageError(null);
    setBootstrapNotice(null);
    setKnowledgePointsNotice(null);

    try {
      const [classesResult, knowledgePointsResult] = await Promise.allSettled([
        requestJson<TeacherClassesResponse>("/api/teacher/classes"),
        requestJson<KnowledgePointsResponse>("/api/knowledge-points")
      ]);

      if (requestId !== bootstrapRequestIdRef.current) {
        return;
      }

      const authError =
        (classesResult.status === "rejected" && isAuthError(classesResult.reason)) ||
        (knowledgePointsResult.status === "rejected" &&
          isAuthError(knowledgePointsResult.reason));

      if (authError) {
        handleAuthRequired();
        return;
      }

      let classesReady = false;

      if (classesResult.status === "fulfilled") {
        setClasses(classesResult.value.data ?? []);
        hasClassesSnapshotRef.current = true;
        classesReady = true;
        setLastLoadedAt(new Date().toISOString());
      } else {
        const nextMessage = getTeacherAiToolsRequestMessage(
          classesResult.reason,
          "班级加载失败",
          "bootstrap"
        );
        if (hasClassesSnapshotRef.current) {
          setBootstrapNotice(`班级数据刷新失败，已保留最近一次结果：${nextMessage}`);
          classesReady = true;
        } else {
          setClasses([]);
          setPageError(nextMessage);
        }
      }

      if (knowledgePointsResult.status === "fulfilled") {
        setKnowledgePoints(knowledgePointsResult.value.data ?? []);
        setKnowledgePointsNotice(null);
        hasKnowledgePointsSnapshotRef.current = true;
      } else {
        const nextMessage = getTeacherAiToolsRequestMessage(
          knowledgePointsResult.reason,
          "知识点加载失败",
          "bootstrap"
        );
        if (hasKnowledgePointsSnapshotRef.current) {
          setKnowledgePointsNotice(`已保留最近一次知识点目录：${nextMessage}`);
        } else {
          setKnowledgePoints([]);
          setKnowledgePointsNotice(nextMessage);
        }
      }

      if (classesReady) {
        setPageReady(true);
      }
    } finally {
      if (requestId === bootstrapRequestIdRef.current) {
        setPageLoading(false);
      }
    }
  }, [
    bootstrapRequestIdRef,
    handleAuthRequired,
    hasClassesSnapshotRef,
    hasKnowledgePointsSnapshotRef,
    setAuthRequired,
    setBootstrapNotice,
    setClasses,
    setKnowledgePoints,
    setKnowledgePointsNotice,
    setLastLoadedAt,
    setPageError,
    setPageLoading,
    setPageReady
  ]);

  return {
    loadBootstrapData
  };
}
