import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ExamStudent } from "../types";

type ExamDetailOpsCardProps = {
  submittedRate: number;
  submittedCount: number;
  assignedCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  totalVisibilityHiddenCount: number;
  totalBlurCount: number;
  questionCount: number;
  totalQuestionScore: number;
  pendingCount: number;
  antiCheatLabel: string;
  publishModeLabel: string;
  durationLabel: string;
  topRiskStudent: ExamStudent | null;
  loadError: string | null;
  onRefresh: () => void;
};

export default function ExamDetailOpsCard({
  submittedRate,
  submittedCount,
  assignedCount,
  highRiskCount,
  mediumRiskCount,
  totalVisibilityHiddenCount,
  totalBlurCount,
  questionCount,
  totalQuestionScore,
  pendingCount,
  antiCheatLabel,
  publishModeLabel,
  durationLabel,
  topRiskStudent,
  loadError,
  onRefresh
}: ExamDetailOpsCardProps) {
  return (
    <Card title="考试指挥台" tag="Ops">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">提交率</div>
          <div className="workflow-summary-value">{submittedRate}%</div>
          <div className="workflow-summary-helper">已提交 {submittedCount} / {assignedCount}</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">高风险学生</div>
          <div className="workflow-summary-value">{highRiskCount}</div>
          <div className="workflow-summary-helper">中风险 {mediumRiskCount} 人</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">异常行为</div>
          <div className="workflow-summary-value">{totalVisibilityHiddenCount + totalBlurCount}</div>
          <div className="workflow-summary-helper">
            离屏 {totalVisibilityHiddenCount} 次 · 切屏 {totalBlurCount} 次
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">卷面规模</div>
          <div className="workflow-summary-value">{questionCount}</div>
          <div className="workflow-summary-helper">总分 {totalQuestionScore} 分</div>
        </div>
      </div>

      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">待提交 {pendingCount} 人</span>
        <span className="pill">防作弊 {antiCheatLabel}</span>
        <span className="pill">发布 {publishModeLabel}</span>
        <span className="pill">时长 {durationLabel}</span>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        {topRiskStudent
          ? `当前最该先处理的是 ${topRiskStudent.name}。先看学生风险，再决定是否直接发布复盘包。`
          : "当前没有明显高风险学生，可以把注意力转向题目讲评和考试收尾。"}
      </div>

      <div className="cta-row" style={{ marginTop: 12 }}>
        <a className="button secondary" href="#exam-students">
          去学生风险区
        </a>
        <a className="button secondary" href="#exam-questions">
          去题目清单
        </a>
      </div>

      {loadError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${loadError}`}
          action={
            <button className="button secondary" type="button" onClick={onRefresh}>
              再试一次
            </button>
          }
        />
      ) : null}
    </Card>
  );
}
