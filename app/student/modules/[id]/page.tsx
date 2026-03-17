"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import StudentModuleAssignmentsCard from "./_components/StudentModuleAssignmentsCard";
import StudentModuleOverviewCard from "./_components/StudentModuleOverviewCard";
import StudentModuleResourcesCard from "./_components/StudentModuleResourcesCard";
import StudentModuleStageBanner from "./_components/StudentModuleStageBanner";
import { useStudentModuleDetailPageView } from "./useStudentModuleDetailPageView";

export default function StudentModuleDetailPage({ params }: { params: { id: string } }) {
  const modulePage = useStudentModuleDetailPageView(params.id);

  if (modulePage.loading && !modulePage.authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载模块详情"
        description="正在同步模块资料、任务和进度信息，请稍等。"
      />
    );
  }

  if (modulePage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看模块详情"
        description="登录学生账号后，才能进入对应模块查看资料与作业。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (modulePage.pageError && !modulePage.data) {
    return (
      <StatePanel
        tone="error"
        title="模块详情加载失败"
        description={modulePage.pageError ?? undefined}
        action={
          <button className="button secondary" type="button" onClick={modulePage.reload}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!modulePage.data || !modulePage.stageBannerProps || !modulePage.overviewCardProps || !modulePage.resourcesCardProps || !modulePage.assignmentsCardProps) {
    return (
      <StatePanel
        tone="empty"
        title="模块详情暂不可用"
        description="当前没有可展示的模块数据。"
      />
    );
  }

  const data = modulePage.data;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.module.title}</h2>
          <div className="section-sub">{data.module.description || "模块详情"}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">模块学习</span>
          <span className="chip">{data.classroom.name}</span>
          <span className="chip">进度 {modulePage.overviewCardProps.progressPercent}%</span>
          {modulePage.lastLoadedAtLabel ? <span className="chip">更新于 {modulePage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={modulePage.reload} disabled={modulePage.refreshing}>
            {modulePage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {modulePage.pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${modulePage.pageError}`}
          action={
            <button className="button secondary" type="button" onClick={modulePage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <StudentModuleStageBanner {...modulePage.stageBannerProps} />
      <StudentModuleOverviewCard {...modulePage.overviewCardProps} />
      <StudentModuleResourcesCard {...modulePage.resourcesCardProps} />
      <StudentModuleAssignmentsCard {...modulePage.assignmentsCardProps} />
    </div>
  );
}
