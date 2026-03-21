"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { AbilityStat, MasterySummary, RadarResponse } from "./types";
import { getStudentPortraitRequestMessage } from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type StudentPortraitPageLoadersOptions = {
  requestIdRef: MutableRefObject<number>;
  hasPortraitSnapshotRef: MutableRefObject<boolean>;
  clearPortraitState: () => void;
  handleAuthRequired: () => void;
  setAbilities: Setter<AbilityStat[]>;
  setMastery: Setter<MasterySummary | null>;
  setAuthRequired: Setter<boolean>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPageError: Setter<string | null>;
  setLastLoadedAt: Setter<string | null>;
};

export function useStudentPortraitPageLoaders({
  requestIdRef,
  hasPortraitSnapshotRef,
  clearPortraitState,
  handleAuthRequired,
  setAbilities,
  setMastery,
  setAuthRequired,
  setLoading,
  setRefreshing,
  setPageError,
  setLastLoadedAt
}: StudentPortraitPageLoadersOptions) {
  const loadPortrait = useCallback(async (mode: "initial" | "refresh" = "initial") => {
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
      const payload = await requestJson<RadarResponse>("/api/student/radar");
      if (requestId !== requestIdRef.current) {
        return;
      }

      setAbilities(payload.data?.abilities ?? []);
      setMastery(payload.data?.mastery ?? null);
      setAuthRequired(false);
      hasPortraitSnapshotRef.current = true;
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasPortraitSnapshotRef.current) {
          clearPortraitState();
        }
        setAuthRequired(false);
        setPageError(getStudentPortraitRequestMessage(error, "加载学习画像失败"));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    clearPortraitState,
    handleAuthRequired,
    hasPortraitSnapshotRef,
    requestIdRef,
    setAbilities,
    setAuthRequired,
    setLastLoadedAt,
    setLoading,
    setMastery,
    setPageError,
    setRefreshing
  ]);

  return {
    loadPortrait
  };
}
