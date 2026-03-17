import Card from "@/components/Card";

type AssignmentReviewWorkbenchCardProps = {
  wrongQuestionsCount: number;
  evidenceCount: number;
  rubricsCount: number;
  isQuiz: boolean;
  isEssay: boolean;
  canAiReview: boolean;
  hasAiReview: boolean;
  hasSubmissionText: boolean;
  uploadCount: number;
  saveMessage: string | null;
  saveError: string | null;
  aiError: string | null;
};

export default function AssignmentReviewWorkbenchCard({
  wrongQuestionsCount,
  evidenceCount,
  rubricsCount,
  isQuiz,
  isEssay,
  canAiReview,
  hasAiReview,
  hasSubmissionText,
  uploadCount,
  saveMessage,
  saveError,
  aiError
}: AssignmentReviewWorkbenchCardProps) {
  return (
    <Card title="批改工作台" tag="Desk">
      <div className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">复盘重点</div>
          <div className="workflow-summary-value">{wrongQuestionsCount}</div>
          <div className="workflow-summary-helper">
            {isQuiz ? "错误题目数量" : isEssay ? "重点看结构、语言和立意" : "重点看附件与文字说明"}
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">证据素材</div>
          <div className="workflow-summary-value">{evidenceCount}</div>
          <div className="workflow-summary-helper">附件与文本说明可交叉验证</div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">评分维度</div>
          <div className="workflow-summary-value">{rubricsCount}</div>
          <div className="workflow-summary-helper">
            {rubricsCount ? "人工评分会自动对齐 rubric" : "当前没有 rubric，直接写总体点评"}
          </div>
        </div>
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">当前状态</div>
          <div className="workflow-summary-value">{saveMessage ? "已保存" : "待定稿"}</div>
          <div className="workflow-summary-helper">
            {saveError ? "保存失败，需要重新提交" : aiError ? "AI 生成失败，但不影响人工批改" : "保存后会通知学生"}
          </div>
        </div>
      </div>

      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">AI {hasAiReview ? "已生成" : canAiReview ? "可用" : "不可用"}</span>
        <span className="pill">提交文本 {hasSubmissionText ? "有" : "无"}</span>
        <span className="pill">附件 {uploadCount} 份</span>
      </div>

      <div className="meta-text" style={{ marginTop: 12 }}>
        当前页面已经把证据、AI 和表单拆成同层结构。先看证据，再形成判断，最后保存，不需要在长页面里来回找。
      </div>
    </Card>
  );
}
