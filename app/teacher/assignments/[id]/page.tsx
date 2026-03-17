"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import AssignmentExecutionLoopCard from "./_components/AssignmentExecutionLoopCard";
import AssignmentNotifyCard from "./_components/AssignmentNotifyCard";
import AssignmentOverviewPanels from "./_components/AssignmentOverviewPanels";
import AssignmentRubricEditorCard from "./_components/AssignmentRubricEditorCard";
import AssignmentStudentRosterCard from "./_components/AssignmentStudentRosterCard";
import { useTeacherAssignmentDetailPageView } from "./useTeacherAssignmentDetailPageView";

export default function TeacherAssignmentDetailPage({ params }: { params: { id: string } }) {
  const assignmentPage = useTeacherAssignmentDetailPageView(params.id);

  if (assignmentPage.authRequired) {
    return (
      <Card title="作业详情">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看作业详情"
          description="登录教师账号后即可查看提交进度、发送提醒和维护评分细则。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (assignmentPage.loadError && !assignmentPage.data) {
    return (
      <Card title="作业详情">
        <StatePanel
          compact
          tone="error"
          title="作业详情加载失败"
          description={assignmentPage.loadError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={assignmentPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/teacher/submissions">
                回提交箱
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  if (assignmentPage.loading && !assignmentPage.data) {
    return (
      <Card title="作业详情">
        <StatePanel
          compact
          tone="loading"
          title="作业详情加载中"
          description="正在同步作业、学生提交与评分细则。"
        />
      </Card>
    );
  }

  const data = assignmentPage.data;
  if (!data) {
    return null;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.assignment.title}</h2>
          <div className="section-sub">{assignmentPage.subtitle}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{assignmentPage.submissionTypeLabel}</span>
          <span className="chip">{assignmentPage.dueRelativeLabel}</span>
          <span className="chip">完成 {assignmentPage.completedStudentsCount}/{assignmentPage.totalStudentsCount}</span>
          {assignmentPage.reviewReadyStudentsCount ? <span className="chip">待批改 {assignmentPage.reviewReadyStudentsCount}</span> : null}
          {assignmentPage.lowScoreStudentsCount ? <span className="chip">低于60% {assignmentPage.lowScoreStudentsCount}</span> : null}
          {assignmentPage.hasLessonLink ? <span className="chip">课前预习</span> : null}
        </div>
      </div>

      {assignmentPage.loadError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${assignmentPage.loadError}`}
          action={
            <button className="button secondary" type="button" onClick={assignmentPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      {assignmentPage.executionLoopCardProps ? <AssignmentExecutionLoopCard {...assignmentPage.executionLoopCardProps} /> : null}

      {assignmentPage.overviewPanelsProps ? <AssignmentOverviewPanels {...assignmentPage.overviewPanelsProps} /> : null}

      {assignmentPage.studentRosterCardProps ? <AssignmentStudentRosterCard {...assignmentPage.studentRosterCardProps} /> : null}

      <AssignmentNotifyCard {...assignmentPage.notifyCardProps} />

      <AssignmentRubricEditorCard {...assignmentPage.rubricEditorCardProps} />
    </div>
  );
}
