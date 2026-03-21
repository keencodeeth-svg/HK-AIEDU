import { useCallback, useMemo, useRef, useState } from "react";
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
  AnalysisStudentItem
} from "./types";
import {
  getTeacherAnalysisPageDerivedState,
  removeTeacherAnalysisClassSnapshot
} from "./utils";

export function useTeacherAnalysisPageState() {
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

  const applyStudentId = useCallback((nextStudentId: string) => {
    studentIdRef.current = nextStudentId;
    setStudentId(nextStudentId);
  }, []);

  const clearReportState = useCallback(() => {
    setReport(null);
    setReportError(null);
  }, []);

  const clearFavoritesSnapshot = useCallback(() => {
    favoritesRequestIdRef.current += 1;
    setFavorites([]);
  }, []);

  const resetScopedData = useCallback(() => {
    classScopedRequestIdRef.current += 1;
    setHeatmap([]);
    clearReportState();
    setStudents([]);
    applyStudentId("");
    clearFavoritesSnapshot();
    setAlerts([]);
    setAlertSummary(null);
    setParentCollaboration(null);
    setAlertActionMessage(null);
    setImpactByAlertId({});
    setCausalitySummary(null);
    setCausalityItems([]);
  }, [applyStudentId, clearFavoritesSnapshot, clearReportState]);

  const clearAnalysisPageState = useCallback(() => {
    previousClassIdRef.current = "";
    skipNextClassEffectRef.current = null;
    skipNextStudentEffectRef.current = null;
    applyStudentId("");
    setClasses([]);
    setClassId("");
    resetScopedData();
    setAcknowledgingAlertId(null);
    setActingAlertKey(null);
    setAlertActionMessage(null);
    setLoadingImpactId(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [applyStudentId, resetScopedData]);

  const handleAuthRequired = useCallback(() => {
    clearAnalysisPageState();
    setAuthRequired(true);
  }, [clearAnalysisPageState]);

  const handleMissingClassSelection = useCallback((missingClassId: string) => {
    const nextState = removeTeacherAnalysisClassSnapshot(classes, missingClassId);
    previousClassIdRef.current = "";
    setClasses(nextState.classes);
    setClassId(nextState.classId);
    resetScopedData();
    setLastLoadedAt(new Date().toISOString());
  }, [classes, resetScopedData]);

  const derivedState = useMemo(
    () =>
      getTeacherAnalysisPageDerivedState({
        alerts,
        classId,
        classes,
        heatmap,
        heatmapLoading,
        report,
        reportLoading
      }),
    [alerts, classId, classes, heatmap, heatmapLoading, report, reportLoading]
  );

  return {
    didInitRef,
    skipNextClassEffectRef,
    skipNextStudentEffectRef,
    previousClassIdRef,
    classScopedRequestIdRef,
    favoritesRequestIdRef,
    studentIdRef,
    classes,
    classId,
    heatmap: derivedState.heatmap,
    report,
    loading,
    refreshing,
    heatmapLoading,
    reportLoading,
    reportError,
    students,
    studentId,
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
    pageError,
    authRequired,
    lastLoadedAt,
    showHeatmapSkeleton: derivedState.showHeatmapSkeleton,
    showReportSkeleton: derivedState.showReportSkeleton,
    selectedClass: derivedState.selectedClass,
    activeAlertCount: derivedState.activeAlertCount,
    weakestKnowledgePoint: derivedState.weakestKnowledgePoint,
    setClasses,
    setClassId,
    setHeatmap,
    setReport,
    setLoading,
    setRefreshing,
    setHeatmapLoading,
    setReportLoading,
    setReportError,
    setStudents,
    setFavorites,
    setAlerts,
    setAlertSummary,
    setParentCollaboration,
    setAcknowledgingAlertId,
    setActingAlertKey,
    setAlertActionMessage,
    setImpactByAlertId,
    setLoadingImpactId,
    setCausalitySummary,
    setCausalityItems,
    setCausalityLoading,
    setCausalityDays,
    setPageError,
    setAuthRequired,
    setLastLoadedAt,
    applyStudentId,
    clearReportState,
    clearFavoritesSnapshot,
    resetScopedData,
    handleAuthRequired,
    handleMissingClassSelection
  };
}
