"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AiPreviewResponse,
  SeatPlan,
  SeatingResponse,
  TeacherClassItem,
  TeacherSeatingStudent
} from "./types";
import {
  getTeacherSeatingRequestMessage,
  isMissingTeacherSeatingClassError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type LoadMode = "initial" | "refresh";

type TeacherSeatingLoadersOptions = {
  loadRequestIdRef: MutableRefObject<number>;
  classIdRef: MutableRefObject<string>;
  handleAuthRequired: () => void;
  handleMissingClassSelection: (missingClassId: string) => string;
  syncClasses: (nextClasses: TeacherClassItem[]) => void;
  applyClassId: (nextClassId: string) => void;
  setStudents: Setter<TeacherSeatingStudent[]>;
  setSavedPlan: Setter<SeatPlan | null>;
  setDraftPlan: Setter<SeatPlan | null>;
  setPreview: Setter<AiPreviewResponse["data"] | null>;
  setLayoutRows: Setter<number>;
  setLayoutColumns: Setter<number>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
  setSaveError: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
};

export function useTeacherSeatingLoaders({
  loadRequestIdRef,
  classIdRef,
  handleAuthRequired,
  handleMissingClassSelection,
  syncClasses,
  applyClassId,
  setStudents,
  setSavedPlan,
  setDraftPlan,
  setPreview,
  setLayoutRows,
  setLayoutColumns,
  setLoading,
  setRefreshing,
  setAuthRequired,
  setPageError,
  setSaveError,
  setLastLoadedAt
}: TeacherSeatingLoadersOptions) {
  const loadData = useCallback(async (
    mode: LoadMode = "initial",
    targetClassId?: string
  ) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    async function runLoadData(nextMode: LoadMode, nextTargetClassId?: string) {
      const activeClassId = nextTargetClassId ?? classIdRef.current;

      if (nextMode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);
      setSaveError(null);

      try {
        const query = activeClassId ? `?classId=${encodeURIComponent(activeClassId)}` : "";
        const payload = await requestJson<SeatingResponse>(`/api/teacher/seating${query}`);
        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        const data = payload.data;
        const nextClasses = data?.classes ?? [];
        const nextClassId = data?.class?.id ?? nextClasses[0]?.id ?? "";
        const nextPlan = data?.plan ?? null;

        syncClasses(nextClasses);
        applyClassId(nextClassId);
        setStudents(data?.students ?? []);
        setSavedPlan(data?.savedPlan ?? null);
        setDraftPlan(nextPlan);
        setLayoutRows(nextPlan?.rows ?? data?.recommendedLayout?.rows ?? 4);
        setLayoutColumns(nextPlan?.columns ?? data?.recommendedLayout?.columns ?? 6);
        setPreview(null);
        setAuthRequired(false);
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }

        const errorMessage = getTeacherSeatingRequestMessage(error, "加载学期排座配置失败");
        if (isMissingTeacherSeatingClassError(error)) {
          const nextClassId = handleMissingClassSelection(activeClassId);
          if (requestId !== loadRequestIdRef.current) {
            return;
          }
          if (nextClassId) {
            await runLoadData("refresh", nextClassId);
          } else {
            setLastLoadedAt(new Date().toISOString());
          }
          setPageError(errorMessage);
          return;
        }

        setAuthRequired(false);
        setPageError(errorMessage);
      } finally {
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
      }
    }

    await runLoadData(mode, targetClassId);
  }, [
    applyClassId,
    classIdRef,
    handleAuthRequired,
    handleMissingClassSelection,
    loadRequestIdRef,
    setAuthRequired,
    setDraftPlan,
    setLastLoadedAt,
    setLayoutColumns,
    setLayoutRows,
    setLoading,
    setPageError,
    setPreview,
    setRefreshing,
    setSaveError,
    setSavedPlan,
    setStudents,
    syncClasses
  ]);

  return {
    loadData
  };
}
