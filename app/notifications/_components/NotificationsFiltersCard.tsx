import Card from "@/components/Card";
import type { ReadFilter } from "../types";
import { getNotificationTypeLabel } from "../utils";

type NotificationsFiltersCardProps = {
  readFilter: ReadFilter;
  typeFilter: string;
  typeOptions: string[];
  keyword: string;
  hasActiveFilters: boolean;
  filteredCount: number;
  unreadCount: number;
  actingKey: string | null;
  onReadFilterChange: (value: ReadFilter) => void;
  onTypeFilterChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onClearFilters: () => void;
  onMarkAllRead: () => void;
};

export default function NotificationsFiltersCard({
  readFilter,
  typeFilter,
  typeOptions,
  keyword,
  hasActiveFilters,
  filteredCount,
  unreadCount,
  actingKey,
  onReadFilterChange,
  onTypeFilterChange,
  onKeywordChange,
  onClearFilters,
  onMarkAllRead
}: NotificationsFiltersCardProps) {
  return (
    <Card title="筛选与操作" tag="筛选">
      <div className="toolbar-wrap" style={{ marginBottom: 10 }}>
        <button
          className={readFilter === "all" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => onReadFilterChange("all")}
        >
          全部
        </button>
        <button
          className={readFilter === "unread" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => onReadFilterChange("unread")}
        >
          仅看未读
        </button>
        <button
          className={readFilter === "read" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => onReadFilterChange("read")}
        >
          仅看已读
        </button>
        <select className="select-control" value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
          <option value="all">全部类型</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {getNotificationTypeLabel(type)}
            </option>
          ))}
        </select>
        <input
          className="workflow-search-input"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="搜索通知标题、内容或类型"
          aria-label="搜索通知"
        />
        <button className="button ghost" type="button" onClick={onClearFilters} disabled={!hasActiveFilters}>
          清空筛选
        </button>
        <button className="button secondary" type="button" onClick={onMarkAllRead} disabled={!unreadCount || actingKey !== null}>
          {actingKey === "all" ? "处理中..." : "全部标记已读"}
        </button>
      </div>
      <div className="workflow-card-meta">
        <span className="pill">当前显示 {filteredCount} 条</span>
        <span className="pill">未读 {unreadCount} 条</span>
        <span className="pill">类型 {typeFilter === "all" ? "全部" : getNotificationTypeLabel(typeFilter)}</span>
      </div>
    </Card>
  );
}
