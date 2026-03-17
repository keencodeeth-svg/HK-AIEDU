import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import type { ThreadSummary } from "../types";

type InboxThreadsCardProps = {
  keyword: string;
  unreadOnly: boolean;
  filteredThreads: ThreadSummary[];
  threadsCount: number;
  unreadCount: number;
  activeThreadId: string;
  onKeywordChange: (value: string) => void;
  onToggleUnreadOnly: () => void;
  onClearFilters: () => void;
  onSelectThread: (threadId: string) => void;
};

export default function InboxThreadsCard({
  keyword,
  unreadOnly,
  filteredThreads,
  threadsCount,
  unreadCount,
  activeThreadId,
  onKeywordChange,
  onToggleUnreadOnly,
  onClearFilters,
  onSelectThread
}: InboxThreadsCardProps) {
  return (
    <Card title="会话列表" tag="Threads">
      <div className="toolbar-wrap" style={{ marginBottom: 10 }}>
        <input
          className="workflow-search-input"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="搜索主题、参与人、消息内容"
          aria-label="搜索会话"
        />
        <button className={unreadOnly ? "button secondary" : "button ghost"} type="button" onClick={onToggleUnreadOnly}>
          {unreadOnly ? "仅看未读中" : "仅看未读"}
        </button>
        <button className="button ghost" type="button" onClick={onClearFilters} disabled={!keyword.trim() && !unreadOnly}>
          清空筛选
        </button>
      </div>
      <div className="workflow-card-meta">
        <span className="pill">
          显示 {filteredThreads.length} / {threadsCount}
        </span>
        <span className="pill">未读 {unreadCount}</span>
      </div>
      {!threadsCount ? (
        <StatePanel
          compact
          tone="empty"
          title="还没有会话"
          description="发送第一条消息后，会话会沉淀在这里，便于持续跟进。"
        />
      ) : !filteredThreads.length ? (
        <StatePanel
          compact
          tone="empty"
          title="没有匹配的会话"
          description="试试清空筛选，或换个关键词重新搜索。"
          action={
            <button className="button secondary" type="button" onClick={onClearFilters}>
              清空筛选
            </button>
          }
        />
      ) : (
        <div className="inbox-thread-list">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={`inbox-thread-item${thread.id === activeThreadId ? " active" : ""}`}
              onClick={() => onSelectThread(thread.id)}
            >
              <div className="inbox-thread-header">
                <div className="section-title">{thread.subject}</div>
                {thread.unreadCount ? (
                  <span className="card-tag">{thread.unreadCount} 未读</span>
                ) : (
                  <span className="pill">已读</span>
                )}
              </div>
              <div className="workflow-summary-helper">
                {thread.participants.map((participant) => participant.name).join("、") || "对话"}
              </div>
              {thread.lastMessage ? <div className="inbox-thread-preview">{thread.lastMessage.content}</div> : null}
              <div className="workflow-summary-helper">更新于 {new Date(thread.updatedAt).toLocaleString("zh-CN")}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
