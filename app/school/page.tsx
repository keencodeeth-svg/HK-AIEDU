"use client";

import WorkspacePage, { WorkspaceAuthState, WorkspaceEmptyState, WorkspaceErrorState, WorkspaceLoadingState } from "@/components/WorkspacePage";
import { SchoolAttentionClassesCard } from "./_components/SchoolAttentionClassesCard";
import { SchoolClassSnapshotCard } from "./_components/SchoolClassSnapshotCard";
import { SchoolDashboardOverviewCard } from "./_components/SchoolDashboardOverviewCard";
import { SchoolHealthMetricsCard } from "./_components/SchoolHealthMetricsCard";
import { SchoolMemberSnapshotCard } from "./_components/SchoolMemberSnapshotCard";
import { SchoolPriorityActionsCard } from "./_components/SchoolPriorityActionsCard";
import { useSchoolPageView } from "./useSchoolPageView";

export default function SchoolPage() {
  const {
    loading,
    authRequired,
    hasOverview,
    pageError,
    reload,
    workspacePageProps,
    overviewCardProps,
    healthMetricsCardProps,
    priorityActionsCardProps,
    attentionClassesCardProps,
    classSnapshotCardProps,
    memberSnapshotCardProps
  } = useSchoolPageView();

  if (loading && !hasOverview && !authRequired) {
    return <WorkspaceLoadingState title="学校控制台加载中" description="正在汇总学校组织、班级和成员数据。" />;
  }

  if (authRequired) {
    return <WorkspaceAuthState title="需要学校管理员权限" description="请使用学校管理员或平台主管账号登录后查看学校控制台。" />;
  }

  if (pageError && !hasOverview) {
    return <WorkspaceErrorState title="学校控制台加载失败" description={pageError} onRetry={reload} />;
  }

  if (!hasOverview) {
    return <WorkspaceEmptyState title="暂无学校数据" description="当前租户还没有生成学校概览数据，请稍后再试。" />;
  }

  return (
    <WorkspacePage {...workspacePageProps}>
      <SchoolDashboardOverviewCard {...overviewCardProps} />

      <SchoolHealthMetricsCard {...healthMetricsCardProps} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <SchoolPriorityActionsCard {...priorityActionsCardProps} />

        <SchoolAttentionClassesCard {...attentionClassesCardProps} />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <SchoolClassSnapshotCard {...classSnapshotCardProps} />

        <SchoolMemberSnapshotCard {...memberSnapshotCardProps} />
      </div>
    </WorkspacePage>
  );
}
