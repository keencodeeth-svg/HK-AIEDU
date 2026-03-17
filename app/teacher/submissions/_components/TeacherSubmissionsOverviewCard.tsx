import Card from "@/components/Card";

type SubmissionSummary = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
};

type TeacherSubmissionsOverviewCardProps = {
  overallSummary: SubmissionSummary;
  filteredSummary: SubmissionSummary;
  recentSubmittedCount: number;
  uniqueAssignmentCount: number;
};

export default function TeacherSubmissionsOverviewCard({
  overallSummary,
  filteredSummary,
  recentSubmittedCount,
  uniqueAssignmentCount
}: TeacherSubmissionsOverviewCardProps) {
  return (
    <Card title="提交收口概览" tag="Close">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">当前总记录</div>
          <div className="workflow-summary-value">{overallSummary.total}</div>
          <div className="workflow-summary-helper">当前班级范围内可追踪的提交总数</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">待跟进</div>
          <div className="workflow-summary-value">{overallSummary.pending + overallSummary.overdue}</div>
          <div className="workflow-summary-helper">待交与逾期需要优先收口</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">已提交</div>
          <div className="workflow-summary-value">{overallSummary.completed}</div>
          <div className="workflow-summary-helper">已进入可查看或可批改状态</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">近24h 新提交</div>
          <div className="workflow-summary-value">{recentSubmittedCount}</div>
          <div className="workflow-summary-helper">适合优先处理最新上下文</div>
        </div>
      </div>
      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">作业 {uniqueAssignmentCount} 份</span>
        <span className="pill">筛选结果 {filteredSummary.total} 条</span>
        <span className="pill">待提交 {filteredSummary.pending}</span>
        <span className="pill">已逾期 {filteredSummary.overdue}</span>
      </div>
    </Card>
  );
}
