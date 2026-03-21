"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { FocusMode, FocusSummary, FocusSummaryResponse } from "./types";
import { getFocusSessionSaveRequestMessage, getFocusSummaryRequestMessage } from "./utils";

export function useFocusPage() {
  const loadRequestIdRef = useRef(0);
  const hasSummarySnapshotRef = useRef(false);
  const startedAtRef = useRef<string | null>(null);
  const [mode, setMode] = useState<FocusMode>("focus");
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const resetSessionState = useCallback(() => {
    startedAtRef.current = null;
    setRunning(false);
    setSecondsLeft(0);
  }, []);

  const clearSummaryState = useCallback(() => {
    hasSummarySnapshotRef.current = false;
    setSummary(null);
  }, []);

  const clearFocusPageState = useCallback(() => {
    clearSummaryState();
    resetSessionState();
    setPageError(null);
  }, [clearSummaryState, resetSessionState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearFocusPageState();
    setAuthRequired(true);
  }, [clearFocusPageState]);

  const loadSummary = useCallback(
    async (options?: { preserveSnapshot?: boolean }) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      setPageError(null);

      try {
        const payload = await requestJson<FocusSummaryResponse>("/api/focus/summary");
        if (loadRequestIdRef.current !== requestId) {
          return false;
        }

        hasSummarySnapshotRef.current = true;
        setSummary(payload.data ?? null);
        setAuthRequired(false);
        return true;
      } catch (error) {
        if (loadRequestIdRef.current !== requestId) {
          return false;
        }
        if (isAuthError(error)) {
          handleAuthRequired();
        } else {
          if (!hasSummarySnapshotRef.current || options?.preserveSnapshot === false) {
            clearSummaryState();
          }
          setAuthRequired(false);
          setPageError(getFocusSummaryRequestMessage(error, "加载专注统计失败"));
        }
        return false;
      }
    },
    [clearSummaryState, handleAuthRequired]
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const completeSession = useCallback(async () => {
    setSaving(true);
    setPageError(null);

    try {
      await requestJson("/api/focus/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          durationMinutes: duration,
          startedAt: startedAtRef.current,
          endedAt: new Date().toISOString()
        })
      });
      resetSessionState();
      await loadSummary({ preserveSnapshot: true });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setPageError(getFocusSessionSaveRequestMessage(error, "记录专注时长失败"));
      }
    } finally {
      setSaving(false);
    }
  }, [duration, handleAuthRequired, loadSummary, mode, resetSessionState]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRunning(false);
          void completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [completeSession, running]);

  const updateMode = useCallback(
    (nextMode: FocusMode) => {
      setMode(nextMode);
      setDuration(nextMode === "focus" ? 25 : 5);
      resetSessionState();
      setPageError(null);
    },
    [resetSessionState]
  );

  const updateDuration = useCallback(
    (nextDuration: number) => {
      setDuration(nextDuration);
      resetSessionState();
      setPageError(null);
    },
    [resetSessionState]
  );

  const startTimer = useCallback(() => {
    setPageError(null);
    setSecondsLeft(duration * 60);
    setRunning(true);
    startedAtRef.current = new Date().toISOString();
  }, [duration]);

  const stopTimer = useCallback(() => {
    resetSessionState();
  }, [resetSessionState]);

  return {
    mode,
    duration,
    secondsLeft,
    running,
    saving,
    summary,
    authRequired,
    pageError,
    loadSummary,
    completeSession,
    updateMode,
    updateDuration,
    startTimer,
    stopTimer
  };
}
