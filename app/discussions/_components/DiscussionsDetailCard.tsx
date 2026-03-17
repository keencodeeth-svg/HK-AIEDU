import type { FormEvent, RefObject } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { ClassItem, CurrentUser, Reply, Topic } from "../types";

type DiscussionsDetailCardProps = {
  detailLoading: boolean;
  activeTopic: Topic | null;
  replies: Reply[];
  currentClass: ClassItem | null;
  currentUser: CurrentUser | null;
  teacherMode: boolean;
  replyText: string;
  replySubmitting: boolean;
  replyInputRef: RefObject<HTMLTextAreaElement>;
  onReplyTextChange: (value: string) => void;
  onReplySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFocusReply: () => void;
};

export default function DiscussionsDetailCard({
  detailLoading,
  activeTopic,
  replies,
  currentClass,
  currentUser,
  teacherMode,
  replyText,
  replySubmitting,
  replyInputRef,
  onReplyTextChange,
  onReplySubmit,
  onFocusReply
}: DiscussionsDetailCardProps) {
  return (
    <Card title="话题详情" tag="详情">
      {detailLoading && !activeTopic ? (
        <StatePanel compact tone="loading" title="正在加载详情" description="正在拉取当前话题与回复内容。" />
      ) : activeTopic ? (
        <>
          <div className="inbox-detail-header">
            <div className="section-title">{activeTopic.title}</div>
            <div className="section-sub">
              {activeTopic.authorName ?? "老师"} · {new Date(activeTopic.createdAt).toLocaleString("zh-CN")}
            </div>
            <div className="workflow-card-meta">
              <span className="pill">{currentClass?.name ?? "当前班级"}</span>
              <span className="pill">回复 {replies.length}</span>
              <span className="pill">更新于 {formatLoadedTime(activeTopic.updatedAt)}</span>
              {activeTopic.pinned ? <span className="pill">置顶话题</span> : null}
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title">话题内容</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--ink-0)" }}>{activeTopic.content}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="section-title">讨论回复</div>
            {replies.length ? (
              <div className="inbox-message-list">
                {replies.map((reply) => {
                  const isSelf = Boolean(reply.authorId && reply.authorId === currentUser?.id);
                  return (
                    <div key={reply.id} className={`inbox-message-row${isSelf ? " self" : ""}`}>
                      <div className="inbox-message-bubble">
                        <div className="inbox-message-meta">
                          {reply.authorName ?? "成员"} · {new Date(reply.createdAt).toLocaleString("zh-CN")}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{reply.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <StatePanel
                  compact
                  tone="empty"
                  title="还没有回复"
                  description={teacherMode ? "你可以先补充引导语，也可以等待学生开始参与讨论。" : "你可以成为第一个回复的人，帮助班级开启讨论。"}
                />
              </div>
            )}
          </div>

          <form onSubmit={onReplySubmit} className="inbox-reply-form" style={{ marginTop: 12 }}>
            <textarea
              ref={replyInputRef}
              value={replyText}
              onChange={(event) => onReplyTextChange(event.target.value)}
              rows={3}
              placeholder={teacherMode ? "补充点评、追问或课堂引导..." : "写下你的想法、解题思路或问题..."}
              className="inbox-textarea"
            />
            <div className="cta-row no-margin">
              <button className="button primary" type="submit" disabled={replySubmitting || !replyText.trim()}>
                {replySubmitting ? "发送中..." : "发送回复"}
              </button>
              <button className="button ghost" type="button" onClick={onFocusReply}>
                快速回复
              </button>
            </div>
          </form>
        </>
      ) : (
        <StatePanel compact tone="empty" title="请选择一个话题查看详情" description="从左侧选择一个班级话题后，这里会展示完整内容和回复区。" />
      )}
    </Card>
  );
}
