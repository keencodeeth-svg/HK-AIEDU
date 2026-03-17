import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { RecoveryItem, RecoveryStatus } from "../types";
import {
  formatTargetBy,
  issueLabels,
  priorityLabels,
  priorityTones,
  roleLabels,
  slaLabels,
  statusLabels
} from "../utils";

type AdminRecoveryRequestsDetailCardProps = {
  selectedItem: RecoveryItem | null;
  actionNote: string;
  actionMessage: string | null;
  actionError: string | null;
  actingStatus: RecoveryStatus | null;
  onActionNoteChange: (value: string) => void;
  onPerformAction: (status: RecoveryStatus) => void;
};

export function AdminRecoveryRequestsDetailCard({
  selectedItem,
  actionNote,
  actionMessage,
  actionError,
  actingStatus,
  onActionNoteChange,
  onPerformAction
}: AdminRecoveryRequestsDetailCardProps) {
  return (
    <Card title="工单详情" tag={selectedItem ? statusLabels[selectedItem.status] : "空"}>
      {!selectedItem ? (
        <StatePanel compact tone="empty" title="请选择一条恢复工单" description="从左侧列表选择工单后，可查看详情并执行处理动作。" />
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="pill-list">
            <span className="pill">工单号 {selectedItem.id}</span>
            <span className="pill">{roleLabels[selectedItem.role]}</span>
            <span className="pill">{issueLabels[selectedItem.issueType]}</span>
            <span className="pill">{statusLabels[selectedItem.status]}</span>
            <span className="pill">{priorityLabels[selectedItem.priority]}</span>
            <span className="pill">{slaLabels[selectedItem.slaState]}</span>
          </div>

          <div className="grid" style={{ gap: 8 }}>
            <div><strong>注册邮箱：</strong>{selectedItem.email}</div>
            <div><strong>姓名：</strong>{selectedItem.name || "--"}</div>
            <div><strong>学校名称：</strong>{selectedItem.schoolName || "--"}</div>
            <div><strong>绑定学生邮箱：</strong>{selectedItem.studentEmail || "--"}</div>
            <div><strong>账号匹配：</strong>{selectedItem.matchedUserId ? `${selectedItem.matchedUserRole || "用户"} / ${selectedItem.matchedUserId}` : "未匹配到现有账号"}</div>
            <div><strong>提交时间：</strong>{formatLoadedTime(selectedItem.createdAt)}</div>
            <div><strong>最近处理：</strong>{selectedItem.handledAt ? `${formatLoadedTime(selectedItem.handledAt)} · ${selectedItem.handledByAdminId ?? "--"}` : "尚未处理"}</div>
            <div><strong>SLA 截止：</strong>{formatTargetBy(selectedItem.targetBy)}</div>
            <div><strong>下一步动作：</strong>{selectedItem.nextActionLabel}</div>
          </div>

          <div className={`status-note ${priorityTones[selectedItem.priority]}`}>优先级判断：{selectedItem.priorityReason}</div>
          {selectedItem.note ? <div className="status-note info">用户说明：{selectedItem.note}</div> : null}
          {selectedItem.isOverdue ? <div className="status-note error">该工单已超过 1 个工作日 SLA，建议优先处理。</div> : null}
          {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}
          {actionError ? <div className="status-note error">{actionError}</div> : null}

          <label className="form-field" style={{ marginBottom: 0 }}>
            <div className="section-title">处理备注</div>
            <textarea
              className="form-control"
              rows={5}
              value={actionNote}
              onChange={(event) => onActionNoteChange(event.target.value)}
              placeholder="记录核验结果、联系渠道、重置说明或驳回原因"
              disabled={actingStatus !== null}
            />
          </label>

          <div className="cta-row" style={{ flexWrap: "wrap", gap: 10 }}>
            {selectedItem.status !== "in_progress" ? (
              <button className="button secondary" type="button" onClick={() => onPerformAction("in_progress")} disabled={actingStatus !== null}>
                {actingStatus === "in_progress" ? "处理中..." : "开始处理"}
              </button>
            ) : null}
            {selectedItem.status !== "resolved" ? (
              <button className="button primary" type="button" onClick={() => onPerformAction("resolved")} disabled={actingStatus !== null}>
                {actingStatus === "resolved" ? "提交中..." : "标记已解决"}
              </button>
            ) : null}
            {selectedItem.status !== "rejected" ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => onPerformAction("rejected")}
                disabled={actingStatus !== null || !actionNote.trim()}
              >
                {actingStatus === "rejected" ? "提交中..." : "标记无法核验"}
              </button>
            ) : null}
            {selectedItem.status !== "pending" ? (
              <button className="button ghost" type="button" onClick={() => onPerformAction("pending")} disabled={actingStatus !== null}>
                回到待处理
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
