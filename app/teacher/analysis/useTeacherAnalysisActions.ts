"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AnalysisAlertImpactData,
  AnalysisReportData,
  TeacherAlertActionType
} from "./types";
import {
  getTeacherAnalysisAlertRequestMessage,
  getTeacherAnalysisClassRequestMessage,
  isMissingTeacherAnalysisAlertError,
  isMissingTeacherAnalysisClassError,
  removeTeacherAnalysisAlertImpact
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type AlertImpactResponse = { data?: AnalysisAlertImpactData };
type AlertActionResponse = { data?: { result?: { message?: string } } };
type ReportResponse = { data?: AnalysisReportData | null };

type LoadClassScopedData = (
  targetClassId: string,
  days: number,
  preferredStudentId?: string
) => Promise<void>;

type TeacherAnalysisActionsOptions = {
  classId: string;
  causalityDays: number;
  impactByAlertId: Record<string, AnalysisAlertImpactData>;
  studentIdRef: MutableRefObject<string>;
  handleAuthRequired: () => void;
  handleMissingClassSelection: (missingClassId: string) => void;
  loadClassScopedData: LoadClassScopedData;
  setAcknowledgingAlertId: Setter<string | null>;
  setActingAlertKey: Setter<string | null>;
  setAlertActionMessage: Setter<string | null>;
  setImpactByAlertId: Setter<Record<string, AnalysisAlertImpactData>>;
  setLoadingImpactId: Setter<string | null>;
  setReport: Setter<AnalysisReportData | null>;
  setReportLoading: Setter<boolean>;
  setReportError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
};

export function useTeacherAnalysisActions({
  classId,
  causalityDays,
  impactByAlertId,
  studentIdRef,
  handleAuthRequired,
  handleMissingClassSelection,
  loadClassScopedData,
  setAcknowledgingAlertId,
  setActingAlertKey,
  setAlertActionMessage,
  setImpactByAlertId,
  setLoadingImpactId,
  setReport,
  setReportLoading,
  setReportError,
  setAuthRequired,
  setPageError
}: TeacherAnalysisActionsOptions) {
  const loadAlertImpact = useCallback(async (alertId: string, force = false) => {
    if (!force && impactByAlertId[alertId]) {
      return;
    }

    setLoadingImpactId(alertId);
    try {
      const payload = await requestJson<AlertImpactResponse>(`/api/teacher/alerts/${alertId}/impact`);
      if (payload.data) {
        setImpactByAlertId((previous) => ({ ...previous, [alertId]: payload.data as AnalysisAlertImpactData }));
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingTeacherAnalysisAlertError(error)) {
        setImpactByAlertId((previous) => removeTeacherAnalysisAlertImpact(previous, alertId));
        setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(error, "加载效果追踪失败"));
        if (classId) {
          await loadClassScopedData(classId, causalityDays, studentIdRef.current);
        }
      } else {
        setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(error, "加载效果追踪失败"));
      }
    } finally {
      setLoadingImpactId(null);
    }
  }, [
    causalityDays,
    classId,
    handleAuthRequired,
    impactByAlertId,
    loadClassScopedData,
    setAlertActionMessage,
    setImpactByAlertId,
    setLoadingImpactId,
    studentIdRef
  ]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    setAcknowledgingAlertId(alertId);
    setAlertActionMessage(null);
    try {
      const payload = await requestJson<AlertActionResponse>(`/api/teacher/alerts/${alertId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "mark_done" })
      });
      setAlertActionMessage(payload.data?.result?.message ?? "预警已确认");
      if (classId) {
        await loadClassScopedData(classId, causalityDays, studentIdRef.current);
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingTeacherAnalysisAlertError(error)) {
        setImpactByAlertId((previous) => removeTeacherAnalysisAlertImpact(previous, alertId));
        setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(error, "确认预警失败"));
        if (classId) {
          await loadClassScopedData(classId, causalityDays, studentIdRef.current);
        }
      } else {
        setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(error, "确认预警失败"));
      }
    } finally {
      setAcknowledgingAlertId(null);
    }
  }, [
    causalityDays,
    classId,
    handleAuthRequired,
    loadClassScopedData,
    setAcknowledgingAlertId,
    setAlertActionMessage,
    setImpactByAlertId,
    studentIdRef
  ]);

  const runAlertAction = useCallback(async (alertId: string, actionType: TeacherAlertActionType) => {
    const actionKey = `${alertId}:${actionType}`;
    setActingAlertKey(actionKey);
    setAlertActionMessage(null);
    try {
      const payload = await requestJson<AlertActionResponse>(`/api/teacher/alerts/${alertId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType })
      });
      setAlertActionMessage(payload.data?.result?.message ?? "动作已执行");
      if (classId) {
        await loadClassScopedData(classId, causalityDays, studentIdRef.current);
      }
      await loadAlertImpact(alertId, true);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingTeacherAnalysisAlertError(error)) {
        setImpactByAlertId((previous) => removeTeacherAnalysisAlertImpact(previous, alertId));
        setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(error, "执行失败"));
        if (classId) {
          await loadClassScopedData(classId, causalityDays, studentIdRef.current);
        }
      } else {
        setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(error, "执行失败"));
      }
    } finally {
      setActingAlertKey(null);
    }
  }, [
    causalityDays,
    classId,
    handleAuthRequired,
    loadAlertImpact,
    loadClassScopedData,
    setActingAlertKey,
    setAlertActionMessage,
    setImpactByAlertId,
    studentIdRef
  ]);

  const generateReport = useCallback(async () => {
    if (!classId) {
      return;
    }

    setReportLoading(true);
    setReportError(null);
    try {
      const payload = await requestJson<ReportResponse>("/api/teacher/insights/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId })
      });
      setReport(payload.data ?? null);
      setAuthRequired(false);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingTeacherAnalysisClassError(error)) {
        const nextMessage = getTeacherAnalysisClassRequestMessage(error, "学情报告生成失败");
        handleMissingClassSelection(classId);
        setPageError(nextMessage);
        setReportError(nextMessage);
      } else {
        setReportError(getTeacherAnalysisClassRequestMessage(error, "学情报告生成失败"));
      }
    } finally {
      setReportLoading(false);
    }
  }, [
    classId,
    handleAuthRequired,
    handleMissingClassSelection,
    setAuthRequired,
    setPageError,
    setReport,
    setReportError,
    setReportLoading
  ]);

  return {
    acknowledgeAlert,
    loadAlertImpact,
    runAlertAction,
    generateReport
  };
}
