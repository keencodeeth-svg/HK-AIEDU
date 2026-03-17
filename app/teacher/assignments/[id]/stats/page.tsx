"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import AssignmentStatsContextCard from "./_components/AssignmentStatsContextCard";
import AssignmentStatsDistributionCard from "./_components/AssignmentStatsDistributionCard";
import AssignmentStatsOverviewCard from "./_components/AssignmentStatsOverviewCard";
import AssignmentStatsQuestionsCard from "./_components/AssignmentStatsQuestionsCard";
import AssignmentStatsValidationLoopCard from "./_components/AssignmentStatsValidationLoopCard";
import type { AssignmentStatsRouteParams } from "./types";
import { useAssignmentStatsPageView } from "./useAssignmentStatsPageView";

export default function AssignmentStatsPage({ params }: { params: AssignmentStatsRouteParams }) {
  const statsPage = useAssignmentStatsPageView(params);

  if (statsPage.authRequired) {
    return (
      <Card title="作业统计">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看作业统计"
          description="登录教师账号后即可查看作业完成率、分布和题目正确率。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (statsPage.loading && !statsPage.data) {
    return (
      <Card title="作业统计">
        <StatePanel
          compact
          tone="loading"
          title="作业统计加载中"
          description="正在同步作业完成情况、成绩分布和题目正确率。"
        />
      </Card>
    );
  }

  if (statsPage.error && !statsPage.data) {
    return (
      <Card title="作业统计">
        <StatePanel
          compact
          tone="error"
          title="作业统计加载失败"
          description={statsPage.error}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={statsPage.onRefresh}>
                重试
              </button>
              <Link className="button ghost" href={`/teacher/assignments/${params.id}`}>
                返回作业详情
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  if (!statsPage.data) {
    return null;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>作业统计验证</h2>
          <div className="section-sub">{statsPage.subtitle}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{statsPage.assignmentTypeLabel}</span>
          <span className="chip">{statsPage.dueRelativeLabel}</span>
          <span className="chip">完成率 {statsPage.completionRate}%</span>
          <span className="chip">待交 {statsPage.data.summary.pending}</span>
          {statsPage.data.summary.overdue ? <span className="chip">逾期 {statsPage.data.summary.overdue}</span> : null}
          <span className="chip">均分 {statsPage.data.summary.avgScore}%</span>
          {statsPage.loadedTimeLabel ? <span className="chip">更新于 {statsPage.loadedTimeLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={statsPage.onRefresh}
            disabled={statsPage.loading || statsPage.refreshing}
          >
            {statsPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {statsPage.validationLoopCardProps ? <AssignmentStatsValidationLoopCard {...statsPage.validationLoopCardProps} /> : null}

      <div className="assignment-stats-top-grid">
        {statsPage.contextCardProps ? <AssignmentStatsContextCard {...statsPage.contextCardProps} /> : null}
        {statsPage.overviewCardProps ? <AssignmentStatsOverviewCard {...statsPage.overviewCardProps} /> : null}
      </div>

      <div className="assignment-stats-main-grid">
        {statsPage.distributionCardProps ? <AssignmentStatsDistributionCard {...statsPage.distributionCardProps} /> : null}
        {statsPage.questionsCardProps ? <AssignmentStatsQuestionsCard {...statsPage.questionsCardProps} /> : null}
      </div>
    </div>
  );
}
