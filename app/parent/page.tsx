"use client";

import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspacePage, {
  WorkspaceAuthState,
  WorkspaceEmptyState,
  WorkspaceErrorState,
  WorkspaceLoadingState
} from "@/components/WorkspacePage";
import ParentSectionHeader from "./_components/ParentSectionHeader";
import ParentAssignmentsCard from "./_components/ParentAssignmentsCard";
import ParentCorrectionsCard from "./_components/ParentCorrectionsCard";
import ParentFavoritesCard from "./_components/ParentFavoritesCard";
import { ParentExecutionSummaryCard, ParentNextStepCard } from "./_components/ParentActionCenterPanels";
import ParentWeakPointsCard from "./_components/ParentWeakPointsCard";
import ParentWeeklyReportCard from "./_components/ParentWeeklyReportCard";
import { useParentPageView } from "./useParentPageView";

export default function ParentPage() {
  const parentPage = useParentPageView();

  if (parentPage.loading && !parentPage.hasParentData && !parentPage.authRequired) {
    return <WorkspaceLoadingState title="家长空间加载中" description="正在同步学情周报、作业提醒、订正任务和收藏题目。" />;
  }

  if (parentPage.authRequired) {
    return <WorkspaceAuthState title="请先使用家长账号登录" description="登录后即可查看孩子的周报、作业提醒、订正任务和监督建议。" />;
  }

  if (parentPage.pageError && !parentPage.hasParentData) {
    return <WorkspaceErrorState title="家长空间暂时不可用" description={parentPage.pageError} onRetry={parentPage.refreshPage} retryLabel="重新加载" />;
  }

  if (!parentPage.hasParentData) {
    return (
      <WorkspaceEmptyState
        title="暂时还没有可查看的家长周报"
        description="当前未生成本周学情数据，可稍后刷新，或等待孩子产生新的学习记录。"
        action={
          <button className="button secondary" type="button" onClick={parentPage.refreshPage}>
            刷新重试
          </button>
        }
      />
    );
  }

  return (
    <WorkspacePage {...parentPage.workspacePageProps}>
      <ParentSectionHeader
        title="今晚先做什么"
        description="先锁定今晚第一步和风险密度，再决定是否去看更完整的周报与分析。"
        chip="Action-first"
      />

      <div id="parent-action-center">
        <ParentNextStepCard {...parentPage.nextStepProps} />
      </div>

      <ParentSectionHeader
        title="今晚要跟进的任务"
        description="把逾期、临近截止和行动卡放在一起看，避免家长在多个区域来回切换。"
        chip="Tonight"
      />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="parent-corrections">
          <ParentCorrectionsCard {...parentPage.correctionsProps} />
        </div>
        <div id="parent-assignments">
          <ParentAssignmentsCard {...parentPage.assignmentsProps} />
        </div>
      </div>

      <ParentSectionHeader
        title="补充判断"
        description="先执行今晚任务，再看整体节奏、课表背景、本周建议和薄弱点，避免首屏并列太多总览卡片。"
        chip="Context"
      />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <ParentExecutionSummaryCard {...parentPage.executionSummaryProps} />
        <RoleScheduleFocusCard {...parentPage.scheduleFocusProps} />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="parent-weekly-report">
          <ParentWeeklyReportCard {...parentPage.weeklyReportProps} />
        </div>
        <div id="parent-weak-points">
          <ParentWeakPointsCard {...parentPage.weakPointsProps} />
        </div>
      </div>

      <ParentSectionHeader
        title="低压力复盘"
        description="没有硬性阻塞项时，再用收藏题做短复盘，而不是先把家长端看成报表页。"
        chip="Review"
      />

      <div id="parent-favorites">
        <ParentFavoritesCard {...parentPage.favoritesProps} />
      </div>
    </WorkspacePage>
  );
}
