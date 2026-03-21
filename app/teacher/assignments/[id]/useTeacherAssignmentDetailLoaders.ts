"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { RubricItem, TeacherAssignmentDetailData } from "./types";
import {
  getTeacherAssignmentDetailRequestMessage,
  isMissingTeacherAssignmentDetailError,
  normalizeRubricItems
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AssignmentRubricsResponse = {
  data?: RubricItem[];
};

type TeacherAssignmentDetailLoadMode = "initial" | "refresh";

type TeacherAssignmentDetailLoadersOptions = {
  id: string;
  loadRequestIdRef: MutableRefObject<number>;
  rubricRequestIdRef: MutableRefObject<number>;
  hasDetailSnapshotRef: MutableRefObject<boolean>;
  rubricsReadyRef: MutableRefObject<boolean>;
  clearAssignmentDetailState: () => void;
  handleAuthRequired: () => void;
  setData: Setter<TeacherAssignmentDetailData | null>;
  setAuthRequired: Setter<boolean>;
  setLoading: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setRubrics: Setter<RubricItem[]>;
  setRubricsLoading: Setter<boolean>;
  setRubricsReady: Setter<boolean>;
  setRubricLoadError: Setter<string | null>;
};

export function useTeacherAssignmentDetailLoaders({
  id,
  loadRequestIdRef,
  rubricRequestIdRef,
  hasDetailSnapshotRef,
  rubricsReadyRef,
  clearAssignmentDetailState,
  handleAuthRequired,
  setData,
  setAuthRequired,
  setLoading,
  setLoadError,
  setRubrics,
  setRubricsLoading,
  setRubricsReady,
  setRubricLoadError
}: TeacherAssignmentDetailLoadersOptions) {
  const requestRubrics = useCallback(async () => {
    const payload = await requestJson<AssignmentRubricsResponse>(`/api/teacher/assignments/${id}/rubrics`);
    return normalizeRubricItems(payload.data ?? []);
  }, [id]);

  const load = useCallback(
    async (mode: TeacherAssignmentDetailLoadMode = "initial") => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      setLoading(true);
      setLoadError(null);
      setRubricLoadError(null);
      setRubricsLoading(true);

      if (mode === "initial" && !hasDetailSnapshotRef.current) {
        setData(null);
      }

      try {
        const [detailResult, rubricsResult] = await Promise.allSettled([
          requestJson<TeacherAssignmentDetailData>(`/api/teacher/assignments/${id}`),
          requestRubrics()
        ]);

        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        const detailAuthError = detailResult.status === "rejected" && isAuthError(detailResult.reason);
        const rubricsAuthError = rubricsResult.status === "rejected" && isAuthError(rubricsResult.reason);

        if (detailAuthError || rubricsAuthError) {
          handleAuthRequired();
          return;
        }

        if (detailResult.status === "rejected") {
          const nextMessage = getTeacherAssignmentDetailRequestMessage(detailResult.reason, "加载失败");
          if (isMissingTeacherAssignmentDetailError(detailResult.reason) || !hasDetailSnapshotRef.current) {
            clearAssignmentDetailState();
          }
          setAuthRequired(false);
          setLoadError(nextMessage);
          return;
        }

        hasDetailSnapshotRef.current = true;
        setAuthRequired(false);
        setData(detailResult.value);

        if (rubricsResult.status === "fulfilled") {
          setRubrics(rubricsResult.value);
          setRubricsReady(true);
          setRubricLoadError(null);
          return;
        }

        if (isMissingTeacherAssignmentDetailError(rubricsResult.reason)) {
          clearAssignmentDetailState();
          setLoadError(getTeacherAssignmentDetailRequestMessage(rubricsResult.reason, "加载失败"));
          return;
        }

        setRubricLoadError(getTeacherAssignmentDetailRequestMessage(rubricsResult.reason, "评分细则加载失败"));
        if (!rubricsReadyRef.current) {
          setRubrics([]);
          setRubricsReady(false);
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setRubricsLoading(false);
        }
      }
    },
    [
      clearAssignmentDetailState,
      handleAuthRequired,
      hasDetailSnapshotRef,
      id,
      loadRequestIdRef,
      requestRubrics,
      rubricsReadyRef,
      setAuthRequired,
      setData,
      setLoadError,
      setLoading,
      setRubrics,
      setRubricsLoading,
      setRubricsReady,
      setRubricLoadError
    ]
  );

  const retryRubrics = useCallback(async () => {
    const requestId = rubricRequestIdRef.current + 1;
    rubricRequestIdRef.current = requestId;
    setRubricsLoading(true);
    setRubricLoadError(null);

    try {
      const nextRubrics = await requestRubrics();
      if (requestId !== rubricRequestIdRef.current) {
        return;
      }
      setRubrics(nextRubrics);
      setRubricsReady(true);
      setAuthRequired(false);
    } catch (nextError) {
      if (requestId !== rubricRequestIdRef.current) {
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      if (isMissingTeacherAssignmentDetailError(nextError)) {
        clearAssignmentDetailState();
        setLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "加载失败"));
        return;
      }
      setRubricLoadError(getTeacherAssignmentDetailRequestMessage(nextError, "评分细则加载失败"));
      if (!rubricsReadyRef.current) {
        setRubrics([]);
        setRubricsReady(false);
      }
    } finally {
      if (requestId === rubricRequestIdRef.current) {
        setRubricsLoading(false);
      }
    }
  }, [
    clearAssignmentDetailState,
    handleAuthRequired,
    requestRubrics,
    rubricRequestIdRef,
    rubricsReadyRef,
    setAuthRequired,
    setLoadError,
    setRubrics,
    setRubricsLoading,
    setRubricsReady,
    setRubricLoadError
  ]);

  return {
    load,
    retryRubrics
  };
}
