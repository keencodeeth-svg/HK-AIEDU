import Card from "@/components/Card";
import MathText from "@/components/MathText";
import type { ExamQuestion } from "../types";

type ExamQuestionsCardProps = {
  questions: ExamQuestion[];
};

export default function ExamQuestionsCard({ questions }: ExamQuestionsCardProps) {
  const totalScore = questions.reduce((sum, question) => sum + question.score, 0);

  return (
    <Card title="题目清单" tag="Paper">
      <div id="exam-questions">
        {questions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无题目</p>
            <p>该考试暂未生成题目。</p>
          </div>
        ) : (
          <>
            <div className="workflow-card-meta">
              <span className="pill">题目 {questions.length} 道</span>
              <span className="pill">总分 {totalScore}</span>
            </div>

            <div className="meta-text" style={{ marginTop: 12 }}>
              题目清单是考试讲评的最后落点。前面看的是学生行为和风险，这里看的是卷面结构本身。
            </div>

            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              {questions
                .slice()
                .sort((left, right) => left.orderIndex - right.orderIndex)
                .map((question, index) => (
                  <div className="card" key={question.id}>
                    <div className="section-title">
                      {index + 1}. <MathText text={question.stem} showCopyActions />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                      分值：{question.score} · 题号：{question.orderIndex + 1}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
