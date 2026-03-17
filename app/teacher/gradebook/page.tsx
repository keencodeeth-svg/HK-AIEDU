"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import GradebookDistributionCard from "./_components/GradebookDistributionCard";
import GradebookExecutionLoopCard from "./_components/GradebookExecutionLoopCard";
import GradebookFiltersCard from "./_components/GradebookFiltersCard";
import GradebookSummaryCard from "./_components/GradebookSummaryCard";
import GradebookTableCard from "./_components/GradebookTableCard";
import GradebookTrendCard from "./_components/GradebookTrendCard";
import { useTeacherGradebookPageView } from "./useTeacherGradebookPageView";

export default function TeacherGradebookPage() {
  const gradebookPage = useTeacherGradebookPageView();

  if (gradebookPage.authRequired) {
    return (
      <Card title="成绩册">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看成绩册"
          description="登录教师账号后即可查看班级完成率、成绩走势和学生跟进情况。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (!gradebookPage.data && !gradebookPage.error && gradebookPage.loading) {
    return (
      <Card title="成绩册">
        <StatePanel
          compact
          tone="loading"
          title="成绩册加载中"
          description="正在同步班级作业、学生进度和趋势分布。"
        />
      </Card>
    );
  }

  if (!gradebookPage.data && gradebookPage.error) {
    return (
      <Card title="成绩册">
        <StatePanel
          compact
          tone="error"
          title="成绩册加载失败"
          description={gradebookPage.error}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={gradebookPage.reload}>
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
          <h2>成绩册</h2>
          <div className="section-sub">先收口作业与学生跟进，再回看完成率和成绩走势。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">Gradebook</span>
          {gradebookPage.selectedClass ? <span className="chip">{gradebookPage.selectedClass.name}</span> : null}
          {gradebookPage.followUpStudentCount ? <span className="chip">待跟进学生 {gradebookPage.followUpStudentCount}</span> : null}
          {gradebookPage.overdueStudentCount ? <span className="chip">逾期学生 {gradebookPage.overdueStudentCount}</span> : null}
          {gradebookPage.urgentAssignmentCount ? <span className="chip">48h 内需收口作业 {gradebookPage.urgentAssignmentCount}</span> : null}
        </div>
      </div>

      <GradebookExecutionLoopCard {...gradebookPage.executionLoopCardProps} />

      <div className="gradebook-top-grid">
        <div id="gradebook-filters">
          <GradebookFiltersCard {...gradebookPage.filtersCardProps} />
        </div>
        <div id="gradebook-summary">
          <GradebookSummaryCard {...gradebookPage.summaryCardProps} />
        </div>
      </div>

      <div className="gradebook-insight-grid">
        <div id="gradebook-trend">
          <GradebookTrendCard {...gradebookPage.trendCardProps} />
        </div>
        <div id="gradebook-distribution">
          <GradebookDistributionCard {...gradebookPage.distributionCardProps} />
        </div>
      </div>

      <div id="gradebook-table">
        <GradebookTableCard {...gradebookPage.tableCardProps} />
      </div>
    </div>
  );
}
