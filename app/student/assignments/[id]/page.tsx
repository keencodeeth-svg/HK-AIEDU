"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import MathViewControls from "@/components/MathViewControls";
import { SUBJECT_LABELS } from "@/lib/constants";
import AssignmentFeedbackPanels from "./_components/AssignmentFeedbackPanels";
import AssignmentLessonContextCard from "./_components/AssignmentLessonContextCard";
import AssignmentOverviewCard from "./_components/AssignmentOverviewCard";
import AssignmentSubmissionCard from "./_components/AssignmentSubmissionCard";
import { useStudentAssignmentDetailPageView } from "./useStudentAssignmentDetailPageView";

export default function StudentAssignmentDetailPage({ params }: { params: { id: string } }) {
  const assignmentPage = useStudentAssignmentDetailPageView(params.id);

  if (assignmentPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看作业详情"
        description="登录后即可继续查看题目、上传作业并提交答案。"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (assignmentPage.showLoadErrorState) {
    return (
      <StatePanel
        tone="error"
        title="作业详情暂时不可用"
        description={assignmentPage.loadError ?? undefined}
        action={
          <div className="cta-row">
            <button className="button secondary" type="button" onClick={assignmentPage.reload}>
              重新加载
            </button>
            <Link className="button ghost" href="/student/assignments">
              返回作业中心
            </Link>
          </div>
        }
      />
    );
  }

  if (assignmentPage.showLoadingState) {
    return (
      <StatePanel
        tone="loading"
        title="作业详情加载中"
        description="正在同步题目、提交要求和老师反馈。"
      />
    );
  }

  const data = assignmentPage.data;
  if (!data || !assignmentPage.overviewCardProps || !assignmentPage.submissionCardProps) {
    return null;
  }

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...assignmentPage.mathViewStyle }}>
      <div className="section-head">
        <div>
          <h2>作业详情</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="pill-list">
          <span className="chip">{assignmentPage.statusLabel}</span>
          {data.lessonLink ? <span className="chip">课前预习</span> : null}
          <span className="chip">截止 {assignmentPage.dueDateLabel}</span>
        </div>
      </div>
      {assignmentPage.loadError && assignmentPage.data ? (
        <StatePanel
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${assignmentPage.loadError}`}
          compact
          action={
            <button className="button secondary" type="button" onClick={assignmentPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}
      {assignmentPage.pageNotice ? (
        <StatePanel
          tone="error"
          title="部分信息加载失败"
          description={assignmentPage.pageNotice}
          compact
        />
      ) : null}
      {assignmentPage.lessonLinkCardProps ? <AssignmentLessonContextCard {...assignmentPage.lessonLinkCardProps} /> : null}

      <MathViewControls {...assignmentPage.mathViewProps} />

      <AssignmentOverviewCard {...assignmentPage.overviewCardProps} />

      <div id="assignment-submission">
        <AssignmentSubmissionCard {...assignmentPage.submissionCardProps} />
      </div>

      {assignmentPage.feedbackPanelsProps ? <AssignmentFeedbackPanels {...assignmentPage.feedbackPanelsProps} /> : null}
    </div>
  );
}
