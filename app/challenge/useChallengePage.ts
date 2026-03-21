"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ChallengeExperiment, ChallengeTask, ChallengesPayload } from "./types";
import { getChallengeClaimRequestMessage, getChallengeLoadRequestMessage } from "./utils";

export function useChallengePage() {
  const loadRequestIdRef = useRef(0);
  const hasChallengeSnapshotRef = useRef(false);
  const [tasks, setTasks] = useState<ChallengeTask[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [experiment, setExperiment] = useState<ChallengeExperiment | null>(null);

  const clearChallengeState = useCallback(() => {
    hasChallengeSnapshotRef.current = false;
    setTasks([]);
    setPoints(0);
    setExperiment(null);
    setPageError(null);
    setActionError(null);
    setActionMessage(null);
    setLoadingId(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearChallengeState();
    setAuthRequired(true);
  }, [clearChallengeState]);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);

    try {
      const payload = await requestJson<ChallengesPayload>("/api/challenges");
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      hasChallengeSnapshotRef.current = true;
      setTasks(payload.data?.tasks ?? []);
      setPoints(payload.data?.points ?? 0);
      setExperiment(payload.data?.experiment ?? null);
      setAuthRequired(false);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasChallengeSnapshotRef.current) {
          clearChallengeState();
        }
        setAuthRequired(false);
        setPageError(getChallengeLoadRequestMessage(error, "加载挑战任务失败"));
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [clearChallengeState, handleAuthRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = useCallback(
    async (taskId: string) => {
      setLoadingId(taskId);
      setActionMessage(null);
      setActionError(null);
      try {
        const payload = await requestJson<ChallengesPayload>("/api/challenges/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId })
        });
        hasChallengeSnapshotRef.current = true;
        setTasks(payload.data?.tasks ?? []);
        setPoints(payload.data?.points ?? 0);
        setExperiment(payload.data?.experiment ?? null);
        setAuthRequired(false);
        setPageError(null);
        if (payload.data?.result?.ok === false) {
          setActionError(payload.data.result.message ?? "领取失败");
        } else if (payload.data?.result?.ok === true) {
          setActionMessage(payload.data.result.message ?? "奖励领取成功");
        }
      } catch (error) {
        if (isAuthError(error)) {
          handleAuthRequired();
        } else {
          setAuthRequired(false);
          setActionError(getChallengeClaimRequestMessage(error, "领取奖励失败"));
        }
      } finally {
        setLoadingId(null);
      }
    },
    [handleAuthRequired]
  );

  return {
    tasks,
    points,
    loading,
    loadingId,
    actionMessage,
    actionError,
    pageError,
    authRequired,
    experiment,
    load,
    claim
  };
}
