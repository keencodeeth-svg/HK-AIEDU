"use client";

import Link from "next/link";
import {
  default as WorkspacePage,
  WorkspaceAuthState,
  WorkspaceEmptyState,
  WorkspaceErrorState,
  WorkspaceLoadingState
} from "@/components/WorkspacePage";
import AnalysisAlertsCard from "./_components/AnalysisAlertsCard";
import AnalysisCausalityCard from "./_components/AnalysisCausalityCard";
import AnalysisDecisionLoopCard from "./_components/AnalysisDecisionLoopCard";
import AnalysisFavoritesCard from "./_components/AnalysisFavoritesCard";
import AnalysisFiltersCard from "./_components/AnalysisFiltersCard";
import AnalysisHeatmapCard from "./_components/AnalysisHeatmapCard";
import AnalysisReportCard from "./_components/AnalysisReportCard";
import { useTeacherAnalysisPageView } from "./useTeacherAnalysisPageView";

export default function TeacherAnalysisPage() {
  const analysisPage = useTeacherAnalysisPageView();

  if (analysisPage.loading && !analysisPage.hasClasses && !analysisPage.authRequired) {
    return <WorkspaceLoadingState title="教师分析看板加载中" description="正在汇总班级、预警、热力图和家长协同数据。" />;
  }

  if (analysisPage.authRequired) {
    return <WorkspaceAuthState title="需要教师账号登录" description="请使用教师账号登录后查看班级学情分析。" />;
  }

  if (analysisPage.pageError && !analysisPage.hasClasses) {
    return (
      <WorkspaceErrorState
        title="教师分析看板加载失败"
        description={analysisPage.pageError}
        onRetry={analysisPage.reload}
      />
    );
  }

  if (!analysisPage.loading && !analysisPage.hasClasses) {
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
    <WorkspacePage {...analysisPage.workspacePageProps}>
      <div className="analysis-top-grid">
        <AnalysisFiltersCard {...analysisPage.filtersCardProps} />
        <AnalysisDecisionLoopCard {...analysisPage.decisionLoopCardProps} />
      </div>

      <div className="analysis-main-grid">
        <div id="analysis-alerts">
          <AnalysisAlertsCard {...analysisPage.alertsCardProps} />
        </div>
        <div id="analysis-causality">
          <AnalysisCausalityCard {...analysisPage.causalityCardProps} />
        </div>
      </div>

      <div className="analysis-bottom-grid">
        <div id="analysis-heatmap">
          <AnalysisHeatmapCard {...analysisPage.heatmapCardProps} />
        </div>
        <div className="analysis-side-stack">
          <div id="analysis-report">
            <AnalysisReportCard {...analysisPage.reportCardProps} />
          </div>
          <div id="analysis-favorites">
            <AnalysisFavoritesCard {...analysisPage.favoritesCardProps} />
          </div>
        </div>
      </div>
    </WorkspacePage>
  );
}
