"use client";

import Link from "next/link";
import Card from "@/components/Card";
import MathViewControls from "@/components/MathViewControls";
import StatePanel from "@/components/StatePanel";
import AssignmentReviewAiCard from "./_components/AssignmentReviewAiCard";
import AssignmentReviewExecutionLoopCard from "./_components/AssignmentReviewExecutionLoopCard";
import AssignmentReviewFormCard from "./_components/AssignmentReviewFormCard";
import AssignmentReviewOverviewCard from "./_components/AssignmentReviewOverviewCard";
import AssignmentReviewSubmissionTextCard from "./_components/AssignmentReviewSubmissionTextCard";
import AssignmentReviewUploadsCard from "./_components/AssignmentReviewUploadsCard";
import AssignmentReviewWorkbenchCard from "./_components/AssignmentReviewWorkbenchCard";
import type { TeacherAssignmentReviewRouteParams } from "./types";
import { useTeacherAssignmentReviewPageView } from "./useTeacherAssignmentReviewPageView";

export default function TeacherAssignmentReviewPage({
  params
}: {
  params: TeacherAssignmentReviewRouteParams;
}) {
  const reviewPage = useTeacherAssignmentReviewPageView(params);

  if (reviewPage.authRequired) {
    return (
      <Card title="作业批改">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看作业批改"
          description="登录教师账号后即可查看学生提交证据、AI 结果和 rubric。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (reviewPage.loadError && !reviewPage.data) {
    return (
      <Card title="作业批改">
        <StatePanel
          compact
          tone="error"
          title="作业批改加载失败"
          description={reviewPage.loadError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={reviewPage.reload}>
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

  if (reviewPage.loading && !reviewPage.data) {
    return (
      <Card title="作业批改">
        <StatePanel
          compact
          tone="loading"
          title="作业批改加载中"
          description="正在同步学生提交内容、AI 结果和 rubric。"
        />
      </Card>
    );
  }

  const data = reviewPage.data;
  if (!data) {
    return null;
  }

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...reviewPage.mathViewStyle }}>
      <div className="section-head">
        <div>
          <h2>作业批改</h2>
          <div className="section-sub">{reviewPage.subtitle}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">学生：{data.student.name}</span>
          <span className="chip">错题 {reviewPage.wrongQuestionsCount}</span>
          <span className="chip">素材 {reviewPage.evidenceCount}</span>
          <span className="chip">Rubric {reviewPage.rubricsCount}</span>
          {reviewPage.hasAiReview ? <span className="chip">AI 已生成</span> : reviewPage.canAiReview ? <span className="chip">可生成 AI</span> : null}
          {reviewPage.saveMessage ? <span className="chip">已保存</span> : null}
        </div>
      </div>

      <MathViewControls {...reviewPage.mathViewControlsProps} />

      {reviewPage.loadError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${reviewPage.loadError}`}
          action={
            <button className="button secondary" type="button" onClick={reviewPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {reviewPage.executionLoopCardProps ? <AssignmentReviewExecutionLoopCard {...reviewPage.executionLoopCardProps} /> : null}

      <div className="review-top-grid">
        {reviewPage.overviewCardProps ? <AssignmentReviewOverviewCard {...reviewPage.overviewCardProps} /> : null}
        <AssignmentReviewWorkbenchCard {...reviewPage.workbenchCardProps} />
      </div>

      <div id="review-evidence" className="review-evidence-grid">
        {reviewPage.uploadsCardProps ? <AssignmentReviewUploadsCard {...reviewPage.uploadsCardProps} /> : null}
        {reviewPage.submissionTextCardProps ? <AssignmentReviewSubmissionTextCard {...reviewPage.submissionTextCardProps} /> : null}
        <AssignmentReviewAiCard {...reviewPage.aiCardProps} />
      </div>

      <div id="review-form">
        {reviewPage.formCardProps ? <AssignmentReviewFormCard {...reviewPage.formCardProps} /> : null}
      </div>
    </div>
  );
}
