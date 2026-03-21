"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AlertImpactData,
  TeacherAlertActionType
} from "./types";
import {
  getTeacherDashboardAlertRequestMessage,
  getTeacherDashboardJoinRequestMessage,
  isMissingTeacherDashboardAlertError,
  isMissingTeacherDashboardJoinRequestError
} from "./dashboard-utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadAll = (options?: { background?: boolean; preserveFeedback?: boolean }) => Promise<void>;

type AlertActionResponse = {
  message?: string;
  data?: {
    result?: {
      message?: string;
    };
  };
};

type AlertImpactResponse = {
  data?: AlertImpactData;
};

type JoinRequestMutationResponse = {
  message?: string;
  ok?: boolean;
};

type TeacherDashboardWorkflowActionsOptions = {
  impactByAlertId: Record<string, AlertImpactData>;
  loadAll: LoadAll;
  removeAlertImpact: (alertId: string) => void;
  removeJoinRequestFromDashboard: (requestId: string) => void;
  setUnauthorized: Setter<boolean>;
  setError: Setter<string | null>;
  setMessage: Setter<string | null>;
  setAcknowledgingAlertId: Setter<string | null>;
  setActingAlertKey: Setter<string | null>;
  setImpactByAlertId: Setter<Record<string, AlertImpactData>>;
  setLoadingImpactId: Setter<string | null>;
};

export function useTeacherDashboardWorkflowActions({
  impactByAlertId,
  loadAll,
  removeAlertImpact,
  removeJoinRequestFromDashboard,
  setUnauthorized,
  setError,
  setMessage,
  setAcknowledgingAlertId,
  setActingAlertKey,
  setImpactByAlertId,
  setLoadingImpactId
}: TeacherDashboardWorkflowActionsOptions) {
  const loadAlertImpact = useCallback(async (alertId: string, force = false) => {
    if (!force && impactByAlertId[alertId]) {
      return;
    }

    setLoadingImpactId(alertId);
    try {
      const payload = await requestJson<AlertImpactResponse>(`/api/teacher/alerts/${alertId}/impact`);
      if (payload.data) {
        setImpactByAlertId((previous) => ({ ...previous, [alertId]: payload.data! }));
      }
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else if (isMissingTeacherDashboardAlertError(error)) {
        removeAlertImpact(alertId);
        await loadAll({ background: true, preserveFeedback: true });
      }
      // Keep the current dashboard usable if the impact side panel fails to refresh.
    } finally {
      setLoadingImpactId(null);
    }
  }, [
    impactByAlertId,
    loadAll,
    removeAlertImpact,
    setImpactByAlertId,
    setLoadingImpactId,
    setUnauthorized
  ]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    setAcknowledgingAlertId(alertId);
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<AlertActionResponse>(
        `/api/teacher/alerts/${alertId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionType: "mark_done" })
        }
      );
      setMessage(payload.data?.result?.message ?? "预警已标记处理。");
      await loadAll({ background: true, preserveFeedback: true });
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardAlertRequestMessage(error, "确认预警失败");
        if (isMissingTeacherDashboardAlertError(error)) {
          removeAlertImpact(alertId);
          await loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    } finally {
      setAcknowledgingAlertId(null);
    }
  }, [
    loadAll,
    removeAlertImpact,
    setAcknowledgingAlertId,
    setError,
    setMessage,
    setUnauthorized
  ]);

  const runAlertAction = useCallback(async (alertId: string, actionType: TeacherAlertActionType) => {
    const actionKey = `${alertId}:${actionType}`;
    setActingAlertKey(actionKey);
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<AlertActionResponse>(
        `/api/teacher/alerts/${alertId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionType })
        }
      );

      const actionMessage = payload.data?.result?.message ?? "预警动作已执行";
      await loadAll({ background: true, preserveFeedback: true });
      await loadAlertImpact(alertId, true);
      setMessage(actionMessage);
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardAlertRequestMessage(error, "执行预警动作失败");
        if (isMissingTeacherDashboardAlertError(error)) {
          removeAlertImpact(alertId);
          await loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    } finally {
      setActingAlertKey(null);
    }
  }, [
    loadAlertImpact,
    loadAll,
    removeAlertImpact,
    setActingAlertKey,
    setError,
    setMessage,
    setUnauthorized
  ]);

  const handleApprove = useCallback(async (requestId: string) => {
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<JoinRequestMutationResponse>(
        `/api/teacher/join-requests/${requestId}/approve`,
        { method: "POST" }
      );
      setMessage(payload.message ?? "已通过加入班级申请。");
      void loadAll({ background: true, preserveFeedback: true });
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardJoinRequestMessage(error, "通过申请失败");
        if (isMissingTeacherDashboardJoinRequestError(error)) {
          removeJoinRequestFromDashboard(requestId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    }
  }, [
    loadAll,
    removeJoinRequestFromDashboard,
    setError,
    setMessage,
    setUnauthorized
  ]);

  const handleReject = useCallback(async (requestId: string) => {
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson<JoinRequestMutationResponse>(
        `/api/teacher/join-requests/${requestId}/reject`,
        { method: "POST" }
      );
      setMessage(payload.message ?? "已拒绝加入班级申请。");
      void loadAll({ background: true, preserveFeedback: true });
    } catch (error) {
      if (isAuthError(error)) {
        setUnauthorized(true);
      } else {
        const nextMessage = getTeacherDashboardJoinRequestMessage(error, "拒绝申请失败");
        if (isMissingTeacherDashboardJoinRequestError(error)) {
          removeJoinRequestFromDashboard(requestId);
          void loadAll({ background: true, preserveFeedback: true });
        }
        setError(nextMessage);
      }
    }
  }, [
    loadAll,
    removeJoinRequestFromDashboard,
    setError,
    setMessage,
    setUnauthorized
  ]);

  return {
    acknowledgeAlert,
    runAlertAction,
    loadAlertImpact,
    handleApprove,
    handleReject
  };
}
