import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { formatDateOnly } from "../utils";
import type { TeacherAssignmentDetailData } from "../types";

type AssignmentOverviewPanelsProps = {
  data: TeacherAssignmentDetailData;
  lessonContext: string | null;
  completedStudentsCount: number;
  reviewReadyStudentsCount: number;
  lowScoreStudentsCount: number;
  completionRate: number;
  pendingStudentsCount: number;
  averagePercent: number | null;
  scoredStudentsCount: number;
  rubricsCount: number;
  rubricLevelCount: number;
};

export default function AssignmentOverviewPanels({
  data,
  lessonContext,
  completedStudentsCount,
  reviewReadyStudentsCount,
  lowScoreStudentsCount,
  completionRate,
  pendingStudentsCount,
  averagePercent,
  scoredStudentsCount,
  rubricsCount,
  rubricLevelCount
}: AssignmentOverviewPanelsProps) {
  return (
    <div className="assignment-detail-top-grid">
      <Card title="作业概览" tag="Overview">
        <div className="feature-card">
          <EduIcon name="board" />
          <div>
            <div className="section-title">{data.assignment.title}</div>
            <p>{data.assignment.description || "暂无作业说明。"}</p>
          </div>
        </div>

        <div className="workflow-card-meta">
          <span className="pill">创建于 {formatDateOnly(data.assignment.createdAt)}</span>
          <span className="pill">截止 {formatDateOnly(data.assignment.dueDate)}</span>
          {data.assignment.gradingFocus ? <span className="pill">批改重点：{data.assignment.gradingFocus}</span> : null}
          {data.module ? <span className="pill">关联模块：{data.module.title}</span> : null}
        </div>

        {lessonContext ? (
          <div className="meta-text" style={{ marginTop: 12 }}>
            关联课次：{lessonContext}
            {data.lessonLink?.focusSummary ? ` · 课堂焦点：${data.lessonLink.focusSummary}` : ""}
            {data.lessonLink?.note ? ` · 老师提醒：${data.lessonLink.note}` : ""}
          </div>
        ) : null}

        <div className="cta-row" style={{ marginTop: 12 }}>
          <Link className="button ghost" href="/teacher/submissions">
            回提交箱
          </Link>
          <Link className="button secondary" href={`/teacher/assignments/${data.assignment.id}/stats`}>
            去统计页
          </Link>
          <Link className="button secondary" href="/teacher">
            返回教师端
          </Link>
        </div>
      </Card>

      <Card title="当前执行面板" tag="Ops">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">完成率</div>
            <div className="workflow-summary-value">{completionRate}%</div>
            <div className="workflow-summary-helper">已提交 {completedStudentsCount} / {data.students.length}</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">待收口</div>
            <div className="workflow-summary-value">{pendingStudentsCount}</div>
            <div className="workflow-summary-helper">优先清掉未提交学生</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">待批改</div>
            <div className="workflow-summary-value">{reviewReadyStudentsCount}</div>
            <div className="workflow-summary-helper">已交但暂无评分结果</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">平均得分</div>
            <div className="workflow-summary-value">{averagePercent === null ? "-" : `${averagePercent}%`}</div>
            <div className="workflow-summary-helper">
              {lowScoreStudentsCount ? `低于 60% 的学生 ${lowScoreStudentsCount} 人` : "当前没有明显低分风险"}
            </div>
          </div>
        </div>

        <div className="pill-list" style={{ marginTop: 12 }}>
          <span className="pill">已评分 {scoredStudentsCount} 人</span>
          <span className="pill">待提醒 {pendingStudentsCount} 人</span>
          <span className="pill">Rubric 维度 {rubricsCount} 个</span>
          <span className="pill">Rubric 分档 {rubricLevelCount} 条</span>
        </div>

        <div className="meta-text" style={{ marginTop: 12 }}>
          当前名单已经按执行优先级处理：未提交学生会排在最前，其次是待批改和低分学生，最后才是稳定完成的学生。
        </div>
      </Card>
    </div>
  );
}
