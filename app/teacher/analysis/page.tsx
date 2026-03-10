"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorkspacePage, { WorkspaceAuthState, WorkspaceEmptyState, WorkspaceErrorState, WorkspaceLoadingState, buildStaleDataNotice } from "@/components/WorkspacePage";
import { getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import AnalysisAlertsCard from "./_components/AnalysisAlertsCard";
import AnalysisCausalityCard from "./_components/AnalysisCausalityCard";
import AnalysisFavoritesCard from "./_components/AnalysisFavoritesCard";
import AnalysisFiltersCard from "./_components/AnalysisFiltersCard";
import AnalysisHeatmapCard from "./_components/AnalysisHeatmapCard";
import AnalysisReportCard from "./_components/AnalysisReportCard";
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

export default function TeacherAnalysisPage() {
  const didInitRef = useRef(false);
  const skipNextClassEffectRef = useRef<string | null>(null);
  const skipNextStudentEffectRef = useRef<string | null>(null);
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

  const loadFavorites = useCallback(async (targetStudentId: string, silent = false) => {
    if (!targetStudentId) {
      setFavorites([]);
      return;
    }

    try {
      const payload = await requestJson<FavoritesResponse>(
        `/api/teacher/favorites?studentId=${encodeURIComponent(targetStudentId)}`
      );
      setFavorites(payload.data ?? []);
      setAuthRequired(false);
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setFavorites([]);
        return;
      }
      if (!silent) {
        setPageError(getRequestErrorMessage(nextError, "加载学生收藏失败"));
      }
      setFavorites([]);
    }
  }, []);

  const loadClassScopedData = useCallback(
    async (targetClassId: string, days: number, preferredStudentId?: string) => {
      if (!targetClassId) {
        resetScopedData();
        return;
      }

      setHeatmapLoading(true);
      setCausalityLoading(true);
      setPageError(null);

      try {
        const [heatmapPayload, alertsPayload, insightsPayload, causalityPayload, studentsPayload] = await Promise.all([
          requestJson<HeatmapResponse>(`/api/teacher/insights/heatmap?classId=${encodeURIComponent(targetClassId)}`),
          requestJson<AlertsResponse>(
            `/api/teacher/alerts?classId=${encodeURIComponent(targetClassId)}&includeAcknowledged=true`
          ),
          requestJson<TeacherInsightsResponse>("/api/teacher/insights"),
          requestJson<CausalityResponse>(
            `/api/teacher/insights/intervention-causality?classId=${encodeURIComponent(targetClassId)}&days=${days}`
          ),
          requestJson<StudentsResponse>(`/api/teacher/classes/${encodeURIComponent(targetClassId)}/students`)
        ]);

        const nextStudents = studentsPayload.data ?? [];
        const nextStudentId =
          preferredStudentId && nextStudents.some((item) => item.id === preferredStudentId)
            ? preferredStudentId
            : nextStudents[0]?.id ?? "";

        setHeatmap(heatmapPayload.data?.items ?? []);
        setAlerts(alertsPayload.data?.alerts ?? []);
        setAlertSummary(alertsPayload.data?.summary ?? null);
        setParentCollaboration(insightsPayload.summary?.parentCollaboration ?? null);
        setCausalitySummary(causalityPayload.data?.summary ?? null);
        setCausalityItems(causalityPayload.data?.items ?? []);
        setStudents(nextStudents);
        setAuthRequired(false);

        if (nextStudentId) {
          if (nextStudentId !== studentIdRef.current) {
            skipNextStudentEffectRef.current = nextStudentId;
            setStudentId(nextStudentId);
          }
          await loadFavorites(nextStudentId, true);
        } else {
          setStudentId("");
          setFavorites([]);
        }

        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          resetScopedData();
        } else {
          setPageError(getRequestErrorMessage(nextError, "加载班级学情失败"));
        }
      } finally {
        setHeatmapLoading(false);
        setCausalityLoading(false);
      }
    },
    [loadFavorites, resetScopedData]
  );

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
        setAuthRequired(true);
        setClasses([]);
        setClassId("");
        resetScopedData();
      } else {
        setPageError(getRequestErrorMessage(nextError, "加载教师分析看板失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [causalityDays, classId, loadClassScopedData, resetScopedData]);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!didInitRef.current || !classId) return;
    if (skipNextClassEffectRef.current === classId) {
      skipNextClassEffectRef.current = null;
      return;
    }
    void loadClassScopedData(classId, causalityDays, studentIdRef.current);
  }, [causalityDays, classId, loadClassScopedData]);

  useEffect(() => {
    if (!studentId) {
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

  async function acknowledgeAlert(alertId: string) {
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
        setAuthRequired(true);
      } else {
        setAlertActionMessage(getRequestErrorMessage(nextError, "确认预警失败"));
      }
    } finally {
      setAcknowledgingAlertId(null);
    }
  }

  async function runAlertAction(alertId: string, actionType: TeacherAlertActionType) {
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
        setAuthRequired(true);
      } else {
        setAlertActionMessage(getRequestErrorMessage(nextError, "执行失败"));
      }
    } finally {
      setActingAlertKey(null);
    }
  }

  async function loadAlertImpact(alertId: string, force = false) {
    if (!force && impactByAlertId[alertId]) return;
    setLoadingImpactId(alertId);
    try {
      const payload = await requestJson<AlertImpactResponse>(`/api/teacher/alerts/${alertId}/impact`);
      if (payload.data) {
        setImpactByAlertId((prev) => ({ ...prev, [alertId]: payload.data as AnalysisAlertImpactData }));
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
      } else {
        setAlertActionMessage(getRequestErrorMessage(nextError, "加载效果追踪失败"));
      }
    } finally {
      setLoadingImpactId(null);
    }
  }

  async function generateReport() {
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
        setAuthRequired(true);
      } else {
        setReportError(getRequestErrorMessage(nextError, "学情报告生成失败"));
      }
    } finally {
      setReportLoading(false);
    }
  }

  const sortedHeatmap = useMemo(() => heatmap.slice(0, 40), [heatmap]);
  const showHeatmapSkeleton = heatmapLoading && sortedHeatmap.length === 0;
  const showReportSkeleton = reportLoading && !report;

  if (loading && !classes.length && !authRequired) {
    return <WorkspaceLoadingState title="教师分析看板加载中" description="正在汇总班级、预警、热力图和家长协同数据。" />;
  }

  if (authRequired) {
    return <WorkspaceAuthState title="需要教师账号登录" description="请使用教师账号登录后查看班级学情分析。" />;
  }

  if (pageError && !classes.length) {
    return <WorkspaceErrorState title="教师分析看板加载失败" description={pageError} onRetry={() => void loadBootstrap()} />;
  }

  if (!loading && !classes.length) {
    return (
      <WorkspaceEmptyState
        title="暂无班级数据"
        description="请先在教师端创建或加入班级后，再查看学情分析。"
        action={
          <Link className="button secondary" href="/teacher">
            前往教师工作台
          </Link>
        }
      />
    );
  }

  return (
    <WorkspacePage
      title="班级学情分析"
      subtitle="掌握热力图、预警闭环、家长协同与学情报告统一收敛。"
      lastLoadedAt={lastLoadedAt}
      chips={[<span key="analysis-data" className="chip">数据面板</span>]}
      actions={
        <button className="button secondary" type="button" onClick={() => void loadBootstrap("refresh")} disabled={loading || refreshing}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      }
      notices={
        pageError
          ? [
              buildStaleDataNotice(
                pageError,
                <button className="button secondary" type="button" onClick={() => void loadBootstrap("refresh")}>
                  再试一次
                </button>
              )
            ]
          : undefined
      }
    >

      <AnalysisFiltersCard classes={classes} classId={classId} onClassChange={setClassId} />
      <AnalysisAlertsCard
        alerts={alerts}
        alertActionMessage={alertActionMessage}
        alertSummary={alertSummary}
        parentCollaboration={parentCollaboration}
        actingAlertKey={actingAlertKey}
        acknowledgingAlertId={acknowledgingAlertId}
        loadingImpactId={loadingImpactId}
        impactByAlertId={impactByAlertId}
        onRunAlertAction={runAlertAction}
        onAcknowledgeAlert={acknowledgeAlert}
        onLoadAlertImpact={loadAlertImpact}
      />
      <AnalysisCausalityCard
        causalityDays={causalityDays}
        causalitySummary={causalitySummary}
        causalityItems={causalityItems}
        causalityLoading={causalityLoading}
        onCausalityDaysChange={setCausalityDays}
      />
      <AnalysisHeatmapCard items={sortedHeatmap} showHeatmapSkeleton={showHeatmapSkeleton} />
      <AnalysisReportCard
        classId={classId}
        report={report}
        reportLoading={reportLoading}
        reportError={reportError}
        showReportSkeleton={showReportSkeleton}
        onGenerateReport={generateReport}
      />
      <AnalysisFavoritesCard
        studentId={studentId}
        students={students}
        favorites={favorites}
        onStudentChange={setStudentId}
      />
    </WorkspacePage>
  );
}
