import Card from "@/components/Card";
import MathText from "@/components/MathText";
import type { AssignmentStatsQuestionStat } from "../types";

type AssignmentStatsQuestionsCardProps = {
  questionStats: AssignmentStatsQuestionStat[];
};

function getQuestionStatus(item: AssignmentStatsQuestionStat) {
  if (item.ratio < 60) {
    return {
      label: "高风险",
      className: "gradebook-pill overdue"
    };
  }
  if (item.ratio < 80) {
    return {
      label: "需关注",
      className: "gradebook-pill pending"
    };
  }
  return {
    label: "稳定",
    className: "gradebook-pill done"
  };
}

export default function AssignmentStatsQuestionsCard({ questionStats }: AssignmentStatsQuestionsCardProps) {
  if (!questionStats.length) {
    return (
      <Card title="题目正确率" tag="Question">
        <p>该作业非在线作答，暂无题目统计。</p>
      </Card>
    );
  }

  const sorted = [...questionStats].sort((left, right) => left.ratio - right.ratio);
  const riskCount = sorted.filter((item) => item.ratio < 60).length;
  const watchCount = sorted.filter((item) => item.ratio >= 60 && item.ratio < 80).length;
  const stableCount = sorted.filter((item) => item.ratio >= 80).length;

  return (
    <Card title="题目正确率" tag="Question">
      <div id="assignment-stats-questions">
        <div className="workflow-card-meta">
          <span className="pill">高风险 {riskCount} 题</span>
          <span className="pill">需关注 {watchCount} 题</span>
          <span className="pill">稳定 {stableCount} 题</span>
        </div>

        <div className="meta-text" style={{ marginTop: 12 }}>
          题目已经按正确率从低到高排序。最前面的题，就是最值得优先拿去重讲、讲评或布置变式练习的题。
        </div>

        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          {sorted.map((item, index) => {
            const status = getQuestionStatus(item);
            return (
              <div className="card assignment-stats-question-card" key={item.id}>
                <div className="assignment-stats-question-head">
                  <div className="section-title">
                    {index + 1}. <MathText text={item.stem} />
                  </div>
                  <span className={status.className}>{status.label}</span>
                </div>
                <div className="assignment-stats-question-meta">
                  正确 {item.correct}/{item.total} · 正确率 {item.ratio}%
                </div>
                <div className="assignment-stats-question-bar">
                  <div className="assignment-stats-question-fill" style={{ width: `${item.ratio}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
