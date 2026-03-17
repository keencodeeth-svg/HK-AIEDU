"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  AnalysisAlertImpactData,
  AnalysisAlertItem,
  AnalysisAlertSummary,
  AnalysisClassItem,
  AnalysisFavoriteItem,
  AnalysisHeatItem,
  AnalysisInterventionCausalityItem,
  AnalysisInterventionCausalitySummary,
  AnalysisParentCollaborationSummary,
  AnalysisReportData,
  AnalysisStudentItem,
  TeacherAlertActionType
} from "./types";
import {
  getTeacherAnalysisAlertRequestMessage,
  getTeacherAnalysisClassRequestMessage,
  getTeacherAnalysisFavoritesRequestMessage,
  getTeacherAnalysisRequestMessage,
  isMissingTeacherAnalysisAlertError,
  isMissingTeacherAnalysisClassError
} from "./utils";

type TeacherClassesResponse = { data?: AnalysisClassItem[] };
type TeacherInsightsResponse = { summary?: { parentCollaboration?: AnalysisParentCollaborationSummary | null } };
type HeatmapResponse = { data?: { items?: AnalysisHeatItem[] } };
type AlertsResponse = { data?: { alerts?: AnalysisAlertItem[]; summary?: AnalysisAlertSummary | null } };
type CausalityResponse = {
  data?: {
    summary?: AnalysisInterventionCausalitySummary | null;
    items?: AnalysisInterventionCausalityItem[];
  };
};
type StudentsResponse = { data?: AnalysisStudentItem[] };
type FavoritesResponse = { data?: AnalysisFavoriteItem[] };
type AlertImpactResponse = { data?: AnalysisAlertImpactData };
type AlertActionResponse = { data?: { result?: { message?: string } } };
type ReportResponse = { data?: AnalysisReportData | null };

export function useTeacherAnalysisPage() {
  const didInitRef = useRef(false);
  const skipNextClassEffectRef = useRef<string | null>(null);
  const skipNextStudentEffectRef = useRef<string | null>(null);
  const previousClassIdRef = useRef("");
  const classScopedRequestIdRef = useRef(0);
  const favoritesRequestIdRef = useRef(0);
  const studentIdRef = useRef("");
  const [classes, setClasses] = useState<AnalysisClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [heatmap, setHeatmap] = useState<AnalysisHeatItem[]>([]);
  const [report, setReport] = useState<AnalysisReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [students, setStudents] = useState<AnalysisStudentItem[]>([]);
  const [studentId, setStudentId] = useState("");
  const [favorites, setFavorites] = useState<AnalysisFavoriteItem[]>([]);
  const [alerts, setAlerts] = useState<AnalysisAlertItem[]>([]);
  const [alertSummary, setAlertSummary] = useState<AnalysisAlertSummary | null>(null);
  const [parentCollaboration, setParentCollaboration] = useState<AnalysisParentCollaborationSummary | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [actingAlertKey, setActingAlertKey] = useState<string | null>(null);
  const [alertActionMessage, setAlertActionMessage] = useState<string | null>(null);
  const [impactByAlertId, setImpactByAlertId] = useState<Record<string, AnalysisAlertImpactData>>({});
  const [loadingImpactId, setLoadingImpactId] = useState<string | null>(null);
  const [causalitySummary, setCausalitySummary] = useState<AnalysisInterventionCausalitySummary | null>(null);
  const [causalityItems, setCausalityItems] = useState<AnalysisInterventionCausalityItem[]>([]);
  const [causalityLoading, setCausalityLoading] = useState(false);
  const [causalityDays, setCausalityDays] = useState(14);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    studentIdRef.current = studentId;
  }, [studentId]);

  const resetScopedData = useCallback(() => {
    classScopedRequestIdRef.current += 1;
    favoritesRequestIdRef.current += 1;
    setHeatmap([]);
    setReport(null);
    setReportError(null);
    setStudents([]);
    setStudentId("");
    setFavorites([]);
    setAlerts([]);
    setAlertSummary(null);
    setParentCollaboration(null);
    setAlertActionMessage(null);
    setImpactByAlertId({});
    setCausalitySummary(null);
    setCausalityItems([]);
  }, []);

  const clearAnalysisPageState = useCallback(() => {
    previousClassIdRef.current = "";
    skipNextClassEffectRef.current = null;
    skipNextStudentEffectRef.current = null;
    studentIdRef.current = "";
    setClasses([]);
    setClassId("");
    resetScopedData();
    setReport(null);
    setReportError(null);
    setAcknowledgingAlertId(null);
    setActingAlertKey(null);
    setAlertActionMessage(null);
    setLoadingImpactId(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [resetScopedData]);

  const handleAuthRequired = useCallback(() => {
    clearAnalysisPageState();
    setAuthRequired(true);
  }, [clearAnalysisPageState]);

  const handleMissingClassSelection = useCallback(
    (missingClassId: string) => {
      const nextClasses = classes.filter((item) => item.id !== missingClassId);
      const nextClassId = nextClasses[0]?.id ?? "";

      previousClassIdRef.current = "";
      setClasses(nextClasses);
      setClassId(nextClassId);
      resetScopedData();
      setLastLoadedAt(new Date().toISOString());
    },
    [classes, resetScopedData]
  );

  const loadFavorites = useCallback(async (targetStudentId: string, silent = false) => {
    const requestId = ++favoritesRequestIdRef.current;
    if (!targetStudentId) {
      setFavorites([]);
      return null;
    }

    try {
      const payload = await requestJson<FavoritesResponse>(
        `/api/teacher/favorites?studentId=${encodeURIComponent(targetStudentId)}`
      );
      if (favoritesRequestIdRef.current !== requestId) {
        return null;
      }
      setFavorites(payload.data ?? []);
      setAuthRequired(false);
      return null;
    } catch (nextError) {
      if (favoritesRequestIdRef.current !== requestId) {
        return null;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "登录状态已失效，请重新登录后查看学生收藏";
      }
      const errorMessage = getTeacherAnalysisFavoritesRequestMessage(nextError, "加载学生收藏失败");
      if (!silent) {
        setPageError(errorMessage);
      }
      setFavorites([]);
      return errorMessage;
    }
  }, [handleAuthRequired]);

  const loadClassScopedData = useCallback(
    async (targetClassId: string, days: number, preferredStudentId?: string) => {
      const requestId = ++classScopedRequestIdRef.current;
      if (!targetClassId) {
        resetScopedData();
        return;
      }

      setHeatmapLoading(true);
      setCausalityLoading(true);
      setPageError(null);

      const [heatmapResult, alertsResult, insightsResult, causalityResult, studentsResult] = await Promise.allSettled([
        requestJson<HeatmapResponse>(
          `/api/teacher/insights/heatmap?classId=${encodeURIComponent(targetClassId)}`
        ),
        requestJson<AlertsResponse>(
          `/api/teacher/alerts?classId=${encodeURIComponent(targetClassId)}&includeAcknowledged=true`
        ),
        requestJson<TeacherInsightsResponse>("/api/teacher/insights"),
        requestJson<CausalityResponse>(
          `/api/teacher/insights/intervention-causality?classId=${encodeURIComponent(targetClassId)}&days=${days}`
        ),
        requestJson<StudentsResponse>(`/api/teacher/classes/${encodeURIComponent(targetClassId)}/students`)
      ]);

      if (classScopedRequestIdRef.current !== requestId) {
        return;
      }

      const authFailure = [heatmapResult, alertsResult, insightsResult, causalityResult, studentsResult].find(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (authFailure) {
        handleAuthRequired();
        setHeatmapLoading(false);
        setCausalityLoading(false);
        return;
      }

      const classMissingError = [heatmapResult, alertsResult, causalityResult, studentsResult].find(
        (result) => result.status === "rejected" && isMissingTeacherAnalysisClassError(result.reason)
      );
      if (classMissingError && classMissingError.status === "rejected") {
        setAuthRequired(false);
        handleMissingClassSelection(targetClassId);
        setPageError(getTeacherAnalysisClassRequestMessage(classMissingError.reason, "加载失败"));
        setHeatmapLoading(false);
        setCausalityLoading(false);
        return;
      }

      const scopedErrors: string[] = [];

      if (heatmapResult.status === "fulfilled") {
        setHeatmap(heatmapResult.value.data?.items ?? []);
      } else {
        setHeatmap([]);
        scopedErrors.push(
          `知识热力图加载失败：${getTeacherAnalysisClassRequestMessage(heatmapResult.reason, "加载失败")}`
        );
      }

      if (alertsResult.status === "fulfilled") {
        setAlerts(alertsResult.value.data?.alerts ?? []);
        setAlertSummary(alertsResult.value.data?.summary ?? null);
      } else {
        setAlerts([]);
        setAlertSummary(null);
        scopedErrors.push(
          `班级预警加载失败：${getTeacherAnalysisClassRequestMessage(alertsResult.reason, "加载失败")}`
        );
      }

      if (insightsResult.status === "fulfilled") {
        setParentCollaboration(insightsResult.value.summary?.parentCollaboration ?? null);
      } else {
        setParentCollaboration(null);
        scopedErrors.push(
          `家校协同数据加载失败：${getTeacherAnalysisRequestMessage(insightsResult.reason, "加载失败")}`
        );
      }

      if (causalityResult.status === "fulfilled") {
        setCausalitySummary(causalityResult.value.data?.summary ?? null);
        setCausalityItems(causalityResult.value.data?.items ?? []);
      } else {
        setCausalitySummary(null);
        setCausalityItems([]);
        scopedErrors.push(
          `干预因果数据加载失败：${getTeacherAnalysisClassRequestMessage(causalityResult.reason, "加载失败")}`
        );
      }

      let nextStudentId = "";
      if (studentsResult.status === "fulfilled") {
        const nextStudents = studentsResult.value.data ?? [];
        nextStudentId =
          preferredStudentId && nextStudents.some((item) => item.id === preferredStudentId)
            ? preferredStudentId
            : nextStudents[0]?.id ?? "";

        setStudents(nextStudents);
      } else {
        setStudents([]);
        setStudentId("");
        favoritesRequestIdRef.current += 1;
        setFavorites([]);
        scopedErrors.push(
          `班级学生列表加载失败：${getTeacherAnalysisClassRequestMessage(studentsResult.reason, "加载失败")}`
        );
      }

      setAuthRequired(false);

      if (nextStudentId) {
        if (nextStudentId !== studentIdRef.current) {
          skipNextStudentEffectRef.current = nextStudentId;
          setStudentId(nextStudentId);
        }
        const favoritesError = await loadFavorites(nextStudentId, true);
        if (classScopedRequestIdRef.current !== requestId) {
          return;
        }
        if (favoritesError) {
          scopedErrors.push(`学生收藏加载失败：${favoritesError}`);
        }
      } else {
        setStudentId("");
        favoritesRequestIdRef.current += 1;
        setFavorites([]);
      }

      setLastLoadedAt(new Date().toISOString());
      if (scopedErrors.length) {
        setPageError(scopedErrors.join("；"));
      }
      setHeatmapLoading(false);
      setCausalityLoading(false);
    },
    [handleAuthRequired, handleMissingClassSelection, loadFavorites, resetScopedData]
  );

  const loadBootstrap = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const payload = await requestJson<TeacherClassesResponse>("/api/teacher/classes");
        const nextClasses = payload.data ?? [];
        setClasses(nextClasses);
        setAuthRequired(false);

        if (!nextClasses.length) {
          setClassId("");
          setAuthRequired(false);
          resetScopedData();
          setLastLoadedAt(new Date().toISOString());
          return;
        }

        const nextClassId = nextClasses.some((item) => item.id === classId) ? classId : nextClasses[0].id;
        if (nextClassId !== classId) {
          skipNextClassEffectRef.current = nextClassId;
          setClassId(nextClassId);
        }
        await loadClassScopedData(nextClassId, causalityDays, studentIdRef.current);
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else {
          setPageError(getTeacherAnalysisRequestMessage(nextError, "加载教师分析看板失败"));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [causalityDays, classId, handleAuthRequired, loadClassScopedData, resetScopedData]
  );

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!didInitRef.current) return;
    if (!classId) {
      previousClassIdRef.current = "";
      return;
    }
    const classChanged = previousClassIdRef.current !== classId;
    previousClassIdRef.current = classId;
    if (skipNextClassEffectRef.current === classId) {
      skipNextClassEffectRef.current = null;
      return;
    }
    if (classChanged) {
      resetScopedData();
    }
    void loadClassScopedData(classId, causalityDays, studentIdRef.current);
  }, [causalityDays, classId, loadClassScopedData, resetScopedData]);

  useEffect(() => {
    if (!studentId) {
      favoritesRequestIdRef.current += 1;
      setFavorites([]);
      return;
    }
    if (skipNextStudentEffectRef.current === studentId) {
      skipNextStudentEffectRef.current = null;
      return;
    }
    void loadFavorites(studentId);
  }, [loadFavorites, studentId]);

  useEffect(() => {
    if (report?.classId && classId && report.classId !== classId) {
      setReport(null);
      setReportError(null);
    }
  }, [classId, report?.classId]);

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
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
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherAnalysisAlertError(nextError)) {
          setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(nextError, "确认预警失败"));
          if (classId) {
            await loadClassScopedData(classId, causalityDays, studentIdRef.current);
          }
        } else {
          setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(nextError, "确认预警失败"));
        }
      } finally {
        setAcknowledgingAlertId(null);
      }
    },
    [causalityDays, classId, handleAuthRequired, loadClassScopedData]
  );

  const loadAlertImpact = useCallback(
    async (alertId: string, force = false) => {
      if (!force && impactByAlertId[alertId]) return;
      setLoadingImpactId(alertId);
      try {
        const payload = await requestJson<AlertImpactResponse>(`/api/teacher/alerts/${alertId}/impact`);
        if (payload.data) {
          setImpactByAlertId((prev) => ({ ...prev, [alertId]: payload.data as AnalysisAlertImpactData }));
        }
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherAnalysisAlertError(nextError)) {
          setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(nextError, "加载效果追踪失败"));
          if (classId) {
            await loadClassScopedData(classId, causalityDays, studentIdRef.current);
          }
        } else {
          setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(nextError, "加载效果追踪失败"));
        }
      } finally {
        setLoadingImpactId(null);
      }
    },
    [causalityDays, classId, handleAuthRequired, impactByAlertId, loadClassScopedData]
  );

  const runAlertAction = useCallback(
    async (alertId: string, actionType: TeacherAlertActionType) => {
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
      } catch (nextError) {
        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingTeacherAnalysisAlertError(nextError)) {
          setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(nextError, "执行失败"));
          if (classId) {
            await loadClassScopedData(classId, causalityDays, studentIdRef.current);
          }
        } else {
          setAlertActionMessage(getTeacherAnalysisAlertRequestMessage(nextError, "执行失败"));
        }
      } finally {
        setActingAlertKey(null);
      }
    },
    [causalityDays, classId, handleAuthRequired, loadAlertImpact, loadClassScopedData]
  );

  const generateReport = useCallback(async () => {
    if (!classId) return;
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
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else if (classId && isMissingTeacherAnalysisClassError(nextError)) {
        const nextMessage = getTeacherAnalysisClassRequestMessage(nextError, "学情报告生成失败");
        handleMissingClassSelection(classId);
        setPageError(nextMessage);
        setReportError(nextMessage);
      } else {
        setReportError(getTeacherAnalysisClassRequestMessage(nextError, "学情报告生成失败"));
      }
    } finally {
      setReportLoading(false);
    }
  }, [classId, handleAuthRequired, handleMissingClassSelection]);

  const sortedHeatmap = useMemo(() => heatmap.slice(0, 40), [heatmap]);
  const showHeatmapSkeleton = heatmapLoading && sortedHeatmap.length === 0;
  const showReportSkeleton = reportLoading && !report;
  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) ?? null, [classId, classes]);
  const activeAlertCount = useMemo(
    () => alerts.filter((item) => item.status === "active").length,
    [alerts]
  );
  const weakestKnowledgePoint = useMemo(
    () =>
      [...sortedHeatmap].sort((left, right) => {
        if (left.ratio !== right.ratio) return left.ratio - right.ratio;
        return right.total - left.total;
      })[0] ?? null,
    [sortedHeatmap]
  );

  return {
    classes,
    classId,
    setClassId,
    heatmap: sortedHeatmap,
    report,
    loading,
    refreshing,
    heatmapLoading,
    reportLoading,
    reportError,
    students,
    studentId,
    setStudentId,
    favorites,
    alerts,
    alertSummary,
    parentCollaboration,
    acknowledgingAlertId,
    actingAlertKey,
    alertActionMessage,
    impactByAlertId,
    loadingImpactId,
    causalitySummary,
    causalityItems,
    causalityLoading,
    causalityDays,
    setCausalityDays,
    pageError,
    authRequired,
    lastLoadedAt,
    showHeatmapSkeleton,
    showReportSkeleton,
    selectedClass,
    activeAlertCount,
    weakestKnowledgePoint,
    loadBootstrap,
    acknowledgeAlert,
    runAlertAction,
    loadAlertImpact,
    generateReport
  };
}
