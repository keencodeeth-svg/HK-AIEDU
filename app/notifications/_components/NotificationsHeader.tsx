import { formatLoadedTime } from "@/lib/client-request";

type NotificationsHeaderProps = {
  unreadCount: number;
  totalCount: number;
  lastLoadedAt: string | null;
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
};

export default function NotificationsHeader({
  unreadCount,
  totalCount,
  lastLoadedAt,
  refreshing,
  disabled,
  onRefresh
}: NotificationsHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>通知中心</h2>
        <div className="section-sub">作业、班级与学习提醒，支持筛选、搜索、刷新与批量已读。</div>
      </div>
      <div className="workflow-toolbar">
        <span className="chip">提醒</span>
        <span className="chip">未读 {unreadCount}</span>
        <span className="chip">总计 {totalCount}</span>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={refreshing || disabled}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
