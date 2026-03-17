import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { StageTrailItem } from "../types";

type ExamCreateCommitCardProps = {
  formTitle: string;
  scopeLabel: string;
  targetLabel: string;
  scheduleSummary: string;
  canSubmit: boolean;
  saving: boolean;
  submitMessage: string | null;
  submitError: string | null;
  submitSuggestions: string[];
  stageTrail: StageTrailItem[];
};

export default function ExamCreateCommitCard({
  formTitle,
  scopeLabel,
  targetLabel,
  scheduleSummary,
  canSubmit,
  saving,
  submitMessage,
  submitError,
  submitSuggestions,
  stageTrail
}: ExamCreateCommitCardProps) {
  return (
    <Card title="5. 确认发布" tag="Commit">
      <div className="teacher-exam-create-confirm-grid">
        <div className="teacher-exam-create-confirm-summary">
          <div className="section-title">发布前确认</div>
          <div className="workflow-card-meta">
            <span className="pill">标题：{formTitle || "未填写"}</span>
            <span className="pill">范围：{scopeLabel}</span>
            <span className="pill">对象：{targetLabel}</span>
            <span className="pill">时间：{scheduleSummary}</span>
          </div>
          <div className="meta-text" style={{ marginTop: 12 }}>
            发布成功后会直接进入考试详情页，后续的提交收口、风险识别和复盘发布都会在详情页继续完成。
          </div>
        </div>

        <div className="cta-row">
          <button className="button primary" type="submit" disabled={!canSubmit}>
            {saving ? "发布中..." : "发布考试"}
          </button>
          <Link className="button ghost" href="/teacher/exams">
            返回考试列表
          </Link>
        </div>
      </div>

      {submitMessage ? <div className="status-note success">{submitMessage}</div> : null}
      {submitError ? (
        <StatePanel compact tone="error" title="发布失败" description={submitError}>
          {submitSuggestions.length ? (
            <div className="teacher-exam-create-hint-list">
              {submitSuggestions.map((item) => (
                <div className="teacher-exam-create-hint-item" key={item}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}
          {stageTrail.length ? (
            <div className="teacher-exam-create-stage-trail">
              {stageTrail.map((item) => (
                <div className="teacher-exam-create-stage-item" key={item.stage}>
                  <div className="teacher-exam-create-stage-title">{item.label}</div>
                  <div className="meta-text">
                    可用 {item.activePoolCount} 题 / 总池 {item.totalPoolCount} 题
                    {item.isolatedExcludedCount ? ` · 隔离池排除 ${item.isolatedExcludedCount} 题` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </StatePanel>
      ) : null}
    </Card>
  );
}
