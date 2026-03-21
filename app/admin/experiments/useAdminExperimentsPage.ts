"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  ABReport,
  ExperimentABReportResponse,
  ExperimentFlag,
  ExperimentFlagsResponse
} from "./types";

function getAdminExperimentsErrorMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "管理员会话已失效，请重新登录后继续操作。";
  }
  if (requestMessage === "missing key") {
    return "实验标识缺失，请刷新页面后重试。";
  }
  if (requestMessage === "missing update fields") {
    return "未检测到需要保存的灰度变更。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function useAdminExperimentsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [flags, setFlags] = useState<ExperimentFlag[]>([]);
  const [report, setReport] = useState<ABReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [flagsPayload, reportPayload] = await Promise.all([
        requestJson<ExperimentFlagsResponse>("/api/admin/experiments/flags"),
        requestJson<ExperimentABReportResponse>("/api/admin/experiments/ab-report?days=7")
      ]);
      setFlags(flagsPayload.data ?? []);
      setReport(reportPayload.data ?? null);
      setAuthRequired(false);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      }
      setError(getAdminExperimentsErrorMessage(nextError, "加载实验数据失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFlag = useCallback(
    async (flag: ExperimentFlag, patch: Partial<Pick<ExperimentFlag, "enabled" | "rollout">>) => {
      setMessage(null);
      setError(null);

      const payload = {
        key: flag.key,
        enabled: patch.enabled ?? flag.enabled,
        rollout: patch.rollout ?? flag.rollout
      };

      await runWithStepUp(
        async () => {
          await requestJson("/api/admin/experiments/flags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          await load();
          setMessage("灰度开关已更新");
        },
        (nextError) => {
          if (isAuthError(nextError)) {
            setAuthRequired(true);
          }
          setError(getAdminExperimentsErrorMessage(nextError, "保存失败"));
        }
      );
    },
    [load, runWithStepUp]
  );

  const updateFlagRollout = useCallback((flagKey: string, rollout: number) => {
    const nextRollout = Math.max(0, Math.min(100, rollout));
    setFlags((current) =>
      current.map((item) => (item.key === flagKey ? { ...item, rollout: nextRollout } : item))
    );
  }, []);

  return {
    flags,
    report,
    loading,
    authRequired,
    message,
    error,
    load,
    saveFlag,
    updateFlagRollout,
    stepUpDialog
  };
}
