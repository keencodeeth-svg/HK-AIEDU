"use client";

import Link from "next/link";
import Card from "@/components/Card";
import MathViewControls from "@/components/MathViewControls";
import StatePanel from "@/components/StatePanel";
import ExamExecutionLoopCard from "./_components/ExamExecutionLoopCard";
import ExamDetailOpsCard from "./_components/ExamDetailOpsCard";
import ExamOverviewCard from "./_components/ExamOverviewCard";
import ExamQuestionsCard from "./_components/ExamQuestionsCard";
import ExamStudentsCard from "./_components/ExamStudentsCard";
import { useTeacherExamDetailPageView } from "./useTeacherExamDetailPageView";

export default function TeacherExamDetailPage({ params }: { params: { id: string } }) {
  const detailPage = useTeacherExamDetailPageView(params.id);

  if (detailPage.authRequired) {
    return (
      <Card title="考试详情">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看考试详情"
          description="登录教师账号后即可查看考试概览、学生风险和复盘发布状态。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (detailPage.loading && !detailPage.data) {
    return (
      <Card title="考试详情">
        <StatePanel
          compact
          tone="loading"
          title="考试详情加载中"
          description="正在读取考试概览、学生风险和复盘发布状态。"
        />
      </Card>
    );
  }

  if (detailPage.loadError && !detailPage.data) {
    return (
      <Card title="考试详情">
        <StatePanel
          compact
          tone="error"
          title="考试详情加载失败"
          description={detailPage.loadError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={detailPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/teacher/exams">
                返回考试列表
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  if (!detailPage.data) {
    return null;
  }

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...detailPage.mathViewStyle }}>
      <div className="section-head">
        <div>
          <h2>{detailPage.data.exam.title}</h2>
          <div className="section-sub">{detailPage.subtitle}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{detailPage.data.exam.status === "closed" ? "已关闭" : "进行中"}</span>
          <span className="chip">{detailPage.dueRelativeLabel}</span>
          <span className="chip">提交 {detailPage.data.summary.submitted}/{detailPage.data.summary.assigned}</span>
          <span className="chip">高风险 {detailPage.data.summary.highRiskCount}</span>
          <span className="chip">均分 {detailPage.data.summary.avgScore}%</span>
          {detailPage.lastLoadedAtLabel ? <span className="chip">更新于 {detailPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={detailPage.refresh}
            disabled={detailPage.refreshDisabled}
          >
            {detailPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>
      <MathViewControls {...detailPage.mathViewControlsProps} />

      {detailPage.executionLoopCardProps ? <ExamExecutionLoopCard {...detailPage.executionLoopCardProps} /> : null}

      <div className="teacher-exam-detail-top-grid">
        {detailPage.overviewCardProps ? <ExamOverviewCard {...detailPage.overviewCardProps} /> : null}
        {detailPage.opsCardProps ? <ExamDetailOpsCard {...detailPage.opsCardProps} /> : null}
      </div>

      <ExamStudentsCard {...detailPage.studentsCardProps} />
      <ExamQuestionsCard {...detailPage.questionsCardProps} />
    </div>
  );
}
