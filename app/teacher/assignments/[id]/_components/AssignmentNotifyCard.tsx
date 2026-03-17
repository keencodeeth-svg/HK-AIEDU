import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import type { AssignmentNotifyTarget } from "../types";

type AssignmentNotifyCardProps = {
  pendingStudentsCount: number;
  lowScoreStudentsCount: number;
  notifyPreviewStudentsCount: number;
  notifyTarget: AssignmentNotifyTarget;
  threshold: number;
  notifyMessage: string;
  notifySuccess: string | null;
  notifyError: string | null;
  notifyLoading: boolean;
  onNotifyTargetChange: (target: AssignmentNotifyTarget) => void;
  onThresholdChange: (threshold: number) => void;
  onNotifyMessageChange: (message: string) => void;
  onSend: () => void;
};

export default function AssignmentNotifyCard({
  pendingStudentsCount,
  lowScoreStudentsCount,
  notifyPreviewStudentsCount,
  notifyTarget,
  threshold,
  notifyMessage,
  notifySuccess,
  notifyError,
  notifyLoading,
  onNotifyTargetChange,
  onThresholdChange,
  onNotifyMessageChange,
  onSend
}: AssignmentNotifyCardProps) {
  return (
    <Card title="提醒学生" tag="Message">
      <div id="assignment-notify">
        <div className="feature-card">
          <EduIcon name="rocket" />
          <div>
            <div className="section-title">把提醒当成收口动作，而不是群发通知</div>
            <p>先选目标，再预览人数，最后发送。这样老师在催交或拉回低分学生时，心里有清晰的覆盖范围。</p>
          </div>
        </div>

        <div className="workflow-card-meta">
          <span className="pill">未完成 {pendingStudentsCount} 人</span>
          <span className="pill">低于 60% {lowScoreStudentsCount} 人</span>
          <span className="pill">当前预计触达 {notifyPreviewStudentsCount} 人</span>
          {notifyTarget === "low_score" ? <span className="pill">阈值 {threshold}%</span> : null}
        </div>

        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          <label>
            <div className="section-title">提醒对象</div>
            <select
              value={notifyTarget}
              onChange={(event) => onNotifyTargetChange(event.target.value as AssignmentNotifyTarget)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="missing">未提交作业</option>
              <option value="low_score">得分低于阈值</option>
              <option value="all">全部学生</option>
            </select>
          </label>
          {notifyTarget === "low_score" ? (
            <label>
              <div className="section-title">分数阈值（百分比）</div>
              <input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(event) => onThresholdChange(Number(event.target.value))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          ) : null}
          <label>
            <div className="section-title">提醒文案（可选）</div>
            <textarea
              value={notifyMessage}
              onChange={(event) => onNotifyMessageChange(event.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              placeholder="例如：今晚 8 点前完成提交，明天课上会直接接这份作业。"
            />
          </label>
        </div>

        {notifySuccess ? <div className="status-note success">{notifySuccess}</div> : null}
        {notifyError ? <div className="status-note error">{notifyError}</div> : null}

        <div className="cta-row" style={{ marginTop: 12 }}>
          <button
            className="button primary"
            type="button"
            disabled={notifyLoading || notifyPreviewStudentsCount === 0}
            onClick={onSend}
          >
            {notifyLoading ? "发送中..." : "发送提醒"}
          </button>
        </div>
      </div>
    </Card>
  );
}
