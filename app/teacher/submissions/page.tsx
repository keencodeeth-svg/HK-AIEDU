"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import SubmissionExecutionLoopCard from "./_components/SubmissionExecutionLoopCard";
import TeacherSubmissionsFiltersCard from "./_components/TeacherSubmissionsFiltersCard";
import TeacherSubmissionsInboxCard from "./_components/TeacherSubmissionsInboxCard";
import TeacherSubmissionsOverviewCard from "./_components/TeacherSubmissionsOverviewCard";
import { useTeacherSubmissionsPageView } from "./useTeacherSubmissionsPageView";

export default function TeacherSubmissionsPage() {
  const submissionsPage = useTeacherSubmissionsPageView();

  if (submissionsPage.authRequired) {
    return (
      <Card title="提交箱（Submission Inbox）">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看提交箱"
          description="登录教师账号后即可查看待交、逾期和最新已交的学生记录。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (submissionsPage.pageLoading) {
    return (
      <Card title="提交箱（Submission Inbox）">
        <StatePanel
          compact
          tone="loading"
          title="提交箱加载中"
          description="正在同步班级提交进度、学生列表和筛选面板。"
        />
      </Card>
    );
  }

  if (submissionsPage.pageError) {
    return (
      <Card title="提交箱（Submission Inbox）">
        <StatePanel
          compact
          tone="error"
          title="提交箱加载失败"
          description={submissionsPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={submissionsPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/teacher">
                返回教师端
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>提交箱（Submission Inbox）</h2>
          <div className="section-sub">先清未交与逾期，再接最新已交，最后回成绩册和学情分析确认这轮收口效果。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">教师端</span>
          {submissionsPage.selectedClass ? <span className="chip">{submissionsPage.selectedClass.name}</span> : null}
          <span className="chip">待跟进 {submissionsPage.pendingFollowUpCount}</span>
          {submissionsPage.overdueCount ? <span className="chip">已逾期 {submissionsPage.overdueCount}</span> : null}
          {submissionsPage.recentSubmittedCount ? <span className="chip">近24h 新提交 {submissionsPage.recentSubmittedCount}</span> : null}
          <span className="chip">筛选后 {submissionsPage.filteredCount} / {submissionsPage.totalCount} 条</span>
          {submissionsPage.lastLoadedAtLabel ? <span className="chip">更新于 {submissionsPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={submissionsPage.refresh}
            disabled={submissionsPage.refreshDisabled}
          >
            {submissionsPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <SubmissionExecutionLoopCard {...submissionsPage.executionLoopCardProps} />

      <div className="submission-top-grid">
        <TeacherSubmissionsFiltersCard {...submissionsPage.filtersCardProps} />
        <TeacherSubmissionsOverviewCard {...submissionsPage.overviewCardProps} />
      </div>

      <TeacherSubmissionsInboxCard {...submissionsPage.inboxCardProps} />
    </div>
  );
}
