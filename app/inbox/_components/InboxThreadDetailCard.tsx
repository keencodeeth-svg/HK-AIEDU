import type { FormEventHandler } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ThreadDetail } from "../types";

type InboxThreadDetailCardProps = {
  detailLoading: boolean;
  threadDetail: ThreadDetail | null;
  activeUnreadCount: number;
  currentUserId: string | null;
  replyText: string;
  message: string | null;
  error: string | null;
  actionLoading: boolean;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: FormEventHandler<HTMLFormElement>;
};

export default function InboxThreadDetailCard({
  detailLoading,
  threadDetail,
  activeUnreadCount,
  currentUserId,
  replyText,
  message,
  error,
  actionLoading,
  onReplyTextChange,
  onSubmitReply
}: InboxThreadDetailCardProps) {
  return (
    <Card title="会话详情" tag="消息">
      {detailLoading && !threadDetail ? (
        <StatePanel compact tone="loading" title="会话加载中" description="正在同步消息详情与参与人。" />
      ) : threadDetail ? (
        <>
          <div className="inbox-detail-header">
            <div className="section-title">{threadDetail.thread.subject}</div>
            <div className="section-sub">
              参与人：{threadDetail.participants.map((participant) => participant.name).join("、") || "-"}
            </div>
            <div className="workflow-card-meta">
              <span className="pill">参与人 {threadDetail.participants.length}</span>
              <span className="pill">消息 {threadDetail.messages.length}</span>
              {activeUnreadCount ? <span className="pill">未读 {activeUnreadCount}</span> : <span className="pill">已同步阅读</span>}
            </div>
          </div>
          <div className="inbox-message-list">
            {threadDetail.messages.map((message) => {
              const isSelf = message.senderId && message.senderId === currentUserId;
              return (
                <div key={message.id} className={`inbox-message-row${isSelf ? " self" : ""}`}>
                  <div className="inbox-message-bubble">
                    <div className="inbox-message-meta">{new Date(message.createdAt).toLocaleString("zh-CN")}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {error ? <div className="status-note error">{error}</div> : null}
          {message ? <div className="status-note success">{message}</div> : null}
          <form onSubmit={onSubmitReply} className="inbox-reply-form">
            <textarea
              value={replyText}
              onChange={(event) => onReplyTextChange(event.target.value)}
              rows={3}
              placeholder="输入回复..."
              className="inbox-textarea"
            />
            <button className="button primary" type="submit" disabled={actionLoading || !replyText.trim()}>
              {actionLoading ? "发送中..." : "发送回复"}
            </button>
          </form>
        </>
      ) : (
        <StatePanel
          compact
          tone="empty"
          title="请选择一个会话查看详情"
          description="从左侧会话列表中选择一个主题，即可查看完整消息记录并继续回复。"
        />
      )}
    </Card>
  );
}
