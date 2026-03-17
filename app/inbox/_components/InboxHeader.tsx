import { formatLoadedTime } from "@/lib/client-request";

type InboxHeaderProps = {
  threadsCount: number;
  unreadCount: number;
  lastLoadedAt: string | null;
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
};

export default function InboxHeader({
  threadsCount,
  unreadCount,
  lastLoadedAt,
  refreshing,
  disabled,
  onRefresh
}: InboxHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>站内信 / 收件箱</h2>
        <div className="section-sub">与老师、学生和家长保持沟通，支持筛选、未读追踪和快速回复。</div>
      </div>
      <div className="workflow-toolbar">
        <span className="chip">Inbox</span>
        <span className="chip">会话 {threadsCount}</span>
        <span className="chip">未读 {unreadCount}</span>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={disabled}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
