"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
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
  AnalysisStudentItem
} from "./types";
import {
  getTeacherAnalysisClassRequestMessage,
  getTeacherAnalysisFavoritesRequestMessage,
  getTeacherAnalysisRequestMessage,
  isMissingTeacherAnalysisClassError,
  resolveTeacherAnalysisClassId,
  resolveTeacherAnalysisStudentId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

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

type TeacherAnalysisLoadersOptions = {
  classId: string;
  causalityDays: number;
  classScopedRequestIdRef: MutableRefObject<number>;
  favoritesRequestIdRef: MutableRefObject<number>;
  skipNextClassEffectRef: MutableRefObject<string | null>;
  skipNextStudentEffectRef: MutableRefObject<string | null>;
  studentIdRef: MutableRefObject<string>;
  handleAuthRequired: () => void;
  handleMissingClassSelection: (missingClassId: string) => void;
  resetScopedData: () => void;
  applyStudentId: (nextStudentId: string) => void;
  setClasses: Setter<AnalysisClassItem[]>;
  setClassId: Setter<string>;
  setHeatmap: Setter<AnalysisHeatItem[]>;
  setStudents: Setter<AnalysisStudentItem[]>;
  setFavorites: Setter<AnalysisFavoriteItem[]>;
  setAlerts: Setter<AnalysisAlertItem[]>;
  setAlertSummary: Setter<AnalysisAlertSummary | null>;
  setParentCollaboration: Setter<AnalysisParentCollaborationSummary | null>;
  setImpactByAlertId: Setter<Record<string, AnalysisAlertImpactData>>;
  setCausalitySummary: Setter<AnalysisInterventionCausalitySummary | null>;
  setCausalityItems: Setter<AnalysisInterventionCausalityItem[]>;
  setHeatmapLoading: Setter<boolean>;
  setCausalityLoading: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
};

export function useTeacherAnalysisLoaders({
  classId,
  causalityDays,
  classScopedRequestIdRef,
  favoritesRequestIdRef,
  skipNextClassEffectRef,
  skipNextStudentEffectRef,
  studentIdRef,
  handleAuthRequired,
  handleMissingClassSelection,
  resetScopedData,
  applyStudentId,
  setClasses,
  setClassId,
  setHeatmap,
  setStudents,
  setFavorites,
  setAlerts,
  setAlertSummary,
  setParentCollaboration,
  setImpactByAlertId,
  setCausalitySummary,
  setCausalityItems,
  setHeatmapLoading,
  setCausalityLoading,
  setPageError,
  setAuthRequired,
  setLastLoadedAt,
  setLoading,
  setRefreshing
}: TeacherAnalysisLoadersOptions) {
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
    } catch (error) {
      if (favoritesRequestIdRef.current !== requestId) {
        return null;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return "登录状态已失效，请重新登录后查看学生收藏";
      }
      const errorMessage = getTeacherAnalysisFavoritesRequestMessage(error, "加载学生收藏失败");
      if (!silent) {
        setPageError(errorMessage);
      }
      setFavorites([]);
      return errorMessage;
    }
  }, [
    favoritesRequestIdRef,
    handleAuthRequired,
    setAuthRequired,
    setFavorites,
    setPageError
  ]);

  const loadClassScopedData = useCallback(async (
    targetClassId: string,
    days: number,
    preferredStudentId?: string
  ) => {
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
      setImpactByAlertId({});
      scopedErrors.push(
        `知识热力图加载失败：${getTeacherAnalysisClassRequestMessage(heatmapResult.reason, "加载失败")}`
      );
    }

    if (alertsResult.status === "fulfilled") {
      setAlerts(alertsResult.value.data?.alerts ?? []);
      setAlertSummary(alertsResult.value.data?.summary ?? null);
      setImpactByAlertId((previous) => {
        const activeAlertIds = new Set((alertsResult.value.data?.alerts ?? []).map((item) => item.id));
        let changed = false;
        const nextImpactByAlertId = Object.fromEntries(
          Object.entries(previous).filter(([alertId]) => {
            const keep = activeAlertIds.has(alertId);
            if (!keep) {
              changed = true;
            }
            return keep;
          })
        ) as Record<string, AnalysisAlertImpactData>;
        return changed ? nextImpactByAlertId : previous;
      });
    } else {
      setAlerts([]);
      setAlertSummary(null);
      setImpactByAlertId({});
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
      nextStudentId = resolveTeacherAnalysisStudentId(
        studentIdRef.current,
        nextStudents,
        preferredStudentId
      );
      setStudents(nextStudents);
    } else {
      setStudents([]);
      applyStudentId("");
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
        applyStudentId(nextStudentId);
      }
      const favoritesError = await loadFavorites(nextStudentId, true);
      if (classScopedRequestIdRef.current !== requestId) {
        return;
      }
      if (favoritesError) {
        scopedErrors.push(`学生收藏加载失败：${favoritesError}`);
      }
    } else {
      applyStudentId("");
      favoritesRequestIdRef.current += 1;
      setFavorites([]);
    }

    setLastLoadedAt(new Date().toISOString());
    if (scopedErrors.length) {
      setPageError(scopedErrors.join("；"));
    }
    setHeatmapLoading(false);
    setCausalityLoading(false);
  }, [
    applyStudentId,
    classScopedRequestIdRef,
    favoritesRequestIdRef,
    handleAuthRequired,
    handleMissingClassSelection,
    loadFavorites,
    resetScopedData,
    setAlertSummary,
    setAlerts,
    setAuthRequired,
    setCausalityItems,
    setCausalityLoading,
    setCausalitySummary,
    setFavorites,
    setHeatmap,
    setHeatmapLoading,
    setImpactByAlertId,
    setLastLoadedAt,
    setPageError,
    setParentCollaboration,
    setStudents,
    skipNextStudentEffectRef,
    studentIdRef
  ]);

  const loadBootstrap = useCallback(async (mode: "initial" | "refresh" = "initial") => {
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

      const nextClassId = resolveTeacherAnalysisClassId(classId, nextClasses);
      if (nextClassId !== classId) {
        skipNextClassEffectRef.current = nextClassId;
        setClassId(nextClassId);
      }
      await loadClassScopedData(nextClassId, causalityDays, studentIdRef.current);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setPageError(getTeacherAnalysisRequestMessage(error, "加载教师分析看板失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    causalityDays,
    classId,
    handleAuthRequired,
    loadClassScopedData,
    resetScopedData,
    setAuthRequired,
    setClasses,
    setClassId,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setRefreshing,
    skipNextClassEffectRef,
    studentIdRef
  ]);

  return {
    loadFavorites,
    loadClassScopedData,
    loadBootstrap
  };
}
