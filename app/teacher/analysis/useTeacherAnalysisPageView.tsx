"use client";

import type { ComponentProps } from "react";
import WorkspacePage, { buildStaleDataNotice } from "@/components/WorkspacePage";
import AnalysisAlertsCard from "./_components/AnalysisAlertsCard";
import AnalysisCausalityCard from "./_components/AnalysisCausalityCard";
import AnalysisDecisionLoopCard from "./_components/AnalysisDecisionLoopCard";
import AnalysisFavoritesCard from "./_components/AnalysisFavoritesCard";
import AnalysisFiltersCard from "./_components/AnalysisFiltersCard";
import AnalysisHeatmapCard from "./_components/AnalysisHeatmapCard";
import AnalysisReportCard from "./_components/AnalysisReportCard";
import { useTeacherAnalysisPage } from "./useTeacherAnalysisPage";

export function useTeacherAnalysisPageView() {
  const page = useTeacherAnalysisPage();

  const workspacePageProps: Omit<ComponentProps<typeof WorkspacePage>, "children"> = {
    title: "班级学情分析",
    subtitle: "先判断这个班最该先处理哪类风险，再锁定课堂讲评点，最后回看干预证据和班级报告。",
    lastLoadedAt: page.lastLoadedAt,
    chips: [
      <span key="analysis-data" className="chip">
        数据面板
      </span>,
      page.selectedClass ? (
        <span key="analysis-class" className="chip">
          {page.selectedClass.name}
        </span>
      ) : null,
      page.activeAlertCount ? (
        <span key="analysis-alerts" className="chip">
          活跃预警 {page.activeAlertCount}
        </span>
      ) : null,
      page.weakestKnowledgePoint ? (
        <span key="analysis-weak" className="chip">
          最弱点已定位
        </span>
      ) : null,
      page.causalitySummary ? (
        <span key="analysis-evidence" className="chip">
          证据覆盖 {page.causalitySummary.evidenceReadyRate}%
        </span>
      ) : null
    ].filter(Boolean),
    actions: (
      <button
        className="button secondary"
        type="button"
        onClick={() => {
          void page.loadBootstrap("refresh");
        }}
        disabled={page.loading || page.refreshing}
      >
        {page.refreshing ? "刷新中..." : "刷新"}
      </button>
    ),
    notices: page.pageError
      ? [
          buildStaleDataNotice(
            page.pageError,
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                void page.loadBootstrap("refresh");
              }}
            >
              再试一次
            </button>
          )
        ]
      : undefined
  };

  const filtersCardProps: ComponentProps<typeof AnalysisFiltersCard> = {
    classes: page.classes,
    classId: page.classId,
    onClassChange: (nextClassId) => {
      page.setClassId(nextClassId);
    }
  };

  const decisionLoopCardProps: ComponentProps<typeof AnalysisDecisionLoopCard> = {
    selectedClass: page.selectedClass,
    alerts: page.alerts,
    heatmap: page.heatmap,
    causalitySummary: page.causalitySummary,
    parentCollaboration: page.parentCollaboration,
    report: page.report
  };

  const alertsCardProps: ComponentProps<typeof AnalysisAlertsCard> = {
    alerts: page.alerts,
    alertActionMessage: page.alertActionMessage,
    alertSummary: page.alertSummary,
    parentCollaboration: page.parentCollaboration,
    actingAlertKey: page.actingAlertKey,
    acknowledgingAlertId: page.acknowledgingAlertId,
    loadingImpactId: page.loadingImpactId,
    impactByAlertId: page.impactByAlertId,
    onRunAlertAction: (alertId, actionType) => {
      void page.runAlertAction(alertId, actionType);
    },
    onAcknowledgeAlert: (alertId) => {
      void page.acknowledgeAlert(alertId);
    },
    onLoadAlertImpact: (alertId) => {
      void page.loadAlertImpact(alertId);
    }
  };

  const causalityCardProps: ComponentProps<typeof AnalysisCausalityCard> = {
    causalityDays: page.causalityDays,
    causalitySummary: page.causalitySummary,
    causalityItems: page.causalityItems,
    causalityLoading: page.causalityLoading,
    onCausalityDaysChange: page.setCausalityDays
  };

  const heatmapCardProps: ComponentProps<typeof AnalysisHeatmapCard> = {
    items: page.heatmap,
    showHeatmapSkeleton: page.showHeatmapSkeleton
  };

  const reportCardProps: ComponentProps<typeof AnalysisReportCard> = {
    classId: page.classId,
    report: page.report,
    reportLoading: page.reportLoading,
    reportError: page.reportError,
    showReportSkeleton: page.showReportSkeleton,
    onGenerateReport: () => {
      void page.generateReport();
    }
  };

  const favoritesCardProps: ComponentProps<typeof AnalysisFavoritesCard> = {
    studentId: page.studentId,
    students: page.students,
    favorites: page.favorites,
    onStudentChange: page.setStudentId
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasClasses: page.classes.length > 0,
    pageError: page.pageError,
    workspacePageProps,
    filtersCardProps,
    decisionLoopCardProps,
    alertsCardProps,
    causalityCardProps,
    heatmapCardProps,
    reportCardProps,
    favoritesCardProps,
    reload: () => {
      void page.loadBootstrap("refresh");
    }
  };
}
