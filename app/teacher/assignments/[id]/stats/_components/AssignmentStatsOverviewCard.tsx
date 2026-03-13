import Link from "next/link";
import Card from "@/components/Card";
import type { AssignmentStatsData } from "../types";

type AssignmentStatsOverviewCardProps = {
  assignmentId: string;
  summary: AssignmentStatsData["summary"];
  completionRate: number;
  lowScoreCount: number;
  watchQuestionCount: number;
};

export default function AssignmentStatsOverviewCard({
  assignmentId,
  summary,
  completionRate,
  lowScoreCount,
  watchQuestionCount
}: AssignmentStatsOverviewCardProps) {
  return (
    <Card title="验证面板" tag="Validate">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">完成率</div>
          <div className="workflow-summary-value">{completionRate}%</div>
          <div className="workflow-summary-helper">已完成 {summary.completed} / {summary.students}</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">待收口</div>
          <div className="workflow-summary-value">{summary.pending}</div>
          <div className="workflow-summary-helper">
            {summary.overdue ? `其中逾期 ${summary.overdue} 人` : "当前没有逾期学生"}
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">平均分</div>
          <div className="workflow-summary-value">{summary.avgScore}%</div>
          <div className="workflow-summary-helper">
            最高 {summary.maxScore}% · 最低 {summary.minScore}%
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">风险信号</div>
          <div className="workflow-summary-value">{Math.max(lowScoreCount, watchQuestionCount)}</div>
          <div className="workflow-summary-helper">
            {lowScoreCount ? `低于 60 分 ${lowScoreCount} 人` : `${watchQuestionCount} 道题低于 80% 正确率`}
          </div>
        </div>
      </div>

      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">学生 {summary.students} 人</span>
        <span className="pill">待交 {summary.pending} 人</span>
        <span className="pill">逾期 {summary.overdue} 人</span>
        <span className="pill">低于 60 分 {lowScoreCount} 人</span>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        先看完成率和待收口人数，确认统计是否可靠；再看均分和风险信号，决定下一步是回执行页还是继续做更高层验证。
      </div>

      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button ghost" href={`/teacher/assignments/${assignmentId}`}>
          回作业详情
        </Link>
        <Link className="button secondary" href="/teacher/gradebook">
          去成绩册
        </Link>
      </div>
    </Card>
  );
}
