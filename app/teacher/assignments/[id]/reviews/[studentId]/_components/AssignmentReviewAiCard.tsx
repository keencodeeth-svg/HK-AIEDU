import Card from "@/components/Card";
import type { TeacherAssignmentAiReviewResult } from "../types";

type AssignmentReviewAiCardProps = {
  aiLoading: boolean;
  canAiReview: boolean;
  aiReview: TeacherAssignmentAiReviewResult | null;
  error?: string | null;
  onGenerate: () => void;
};

export default function AssignmentReviewAiCard({
  aiLoading,
  canAiReview,
  aiReview,
  error,
  onGenerate
}: AssignmentReviewAiCardProps) {
  return (
    <Card title="AI 批改" tag="AI">
      <div className="cta-row">
        <button className="button primary" type="button" onClick={onGenerate} disabled={aiLoading || !canAiReview}>
          {aiLoading ? "批改中..." : "生成 AI 批改"}
        </button>
      </div>
      {!canAiReview ? <p style={{ marginTop: 8, color: "var(--ink-1)" }}>学生尚未提交作业内容。</p> : null}
      {error ? <p style={{ marginTop: 8, color: "#b42318" }}>{error}</p> : null}
      {aiReview ? (
        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          <div className="card">
            <div className="section-title">综合评分</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{aiReview.score ?? 0} 分</div>
            <p style={{ marginTop: 8 }}>{aiReview.summary ?? "暂无总结。"}</p>
          </div>
          {aiReview.strengths?.length ? (
            <div className="card">
              <div className="section-title">优点</div>
              <ul style={{ margin: "6px 0 0 16px" }}>
                {aiReview.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {aiReview.issues?.length ? (
            <div className="card">
              <div className="section-title">问题</div>
              <ul style={{ margin: "6px 0 0 16px" }}>
                {aiReview.issues.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {aiReview.suggestions?.length ? (
            <div className="card">
              <div className="section-title">改进建议</div>
              <ul style={{ margin: "6px 0 0 16px" }}>
                {aiReview.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {aiReview.rubric?.length ? (
            <div className="card">
              <div className="section-title">评分维度</div>
              <div className="grid" style={{ gap: 8, marginTop: 6 }}>
                {aiReview.rubric.map((item) => (
                  <div key={item.item}>
                    {item.item}：{item.score} 分 · {item.comment}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {aiReview.writing ? (
            <div className="card">
              <div className="section-title">写作评分</div>
              <div className="pill-list" style={{ marginTop: 8 }}>
                <span className="pill">结构 {aiReview.writing.scores?.structure ?? 0}</span>
                <span className="pill">语法 {aiReview.writing.scores?.grammar ?? 0}</span>
                <span className="pill">词汇 {aiReview.writing.scores?.vocab ?? 0}</span>
              </div>
              <p style={{ marginTop: 8 }}>{aiReview.writing.summary ?? "暂无写作总结。"}</p>
              {aiReview.writing.strengths?.length ? (
                <div style={{ marginTop: 8 }}>
                  <div className="section-title">写作优点</div>
                  <ul style={{ margin: "6px 0 0 16px" }}>
                    {aiReview.writing.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aiReview.writing.improvements?.length ? (
                <div style={{ marginTop: 8 }}>
                  <div className="section-title">改进建议</div>
                  <ul style={{ margin: "6px 0 0 16px" }}>
                    {aiReview.writing.improvements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aiReview.writing.corrected ? (
                <div style={{ marginTop: 8 }}>
                  <div className="section-title">修改示例</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{aiReview.writing.corrected}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p style={{ marginTop: 8, color: "var(--ink-1)" }}>暂无 AI 批改结果。</p>
      )}
    </Card>
  );
}
