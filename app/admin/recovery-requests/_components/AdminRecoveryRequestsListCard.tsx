import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import type { RecoveryFilterStatus, RecoveryItem } from "../types";
import {
  formatWaitingHours,
  issueLabels,
  priorityLabels,
  priorityTones,
  roleLabels,
  slaLabels,
  statusLabels,
  statusOptions,
  statusTones
} from "../utils";

type AdminRecoveryRequestsListCardProps = {
  statusFilter: RecoveryFilterStatus;
  searchInput: string;
  appliedQuery: string;
  items: RecoveryItem[];
  selectedItemId: string | null;
  onStatusFilterChange: (value: RecoveryFilterStatus) => void;
  onSearchInputChange: (value: string) => void;
  onApplySearch: () => void;
  onSelectItem: (id: string) => void;
  onClearFilters: () => void;
};

export function AdminRecoveryRequestsListCard({
  statusFilter,
  searchInput,
  appliedQuery,
  items,
  selectedItemId,
  onStatusFilterChange,
  onSearchInputChange,
  onApplySearch,
  onSelectItem,
  onClearFilters
}: AdminRecoveryRequestsListCardProps) {
  return (
    <Card title="工单列表" tag="分诊">
      <div className="grid" style={{ gap: 12 }}>
        <div className="grid" style={{ gap: 10, gridTemplateColumns: "180px minmax(0, 1fr) auto" }}>
          <label className="form-field" style={{ marginBottom: 0 }}>
            <div className="section-title">状态筛选</div>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as RecoveryFilterStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <form
            className="form-field"
            style={{ marginBottom: 0 }}
            onSubmit={(event) => {
              event.preventDefault();
              onApplySearch();
            }}
          >
            <div className="section-title">搜索</div>
            <input
              className="form-control"
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder="邮箱、姓名、学校、工单号"
            />
          </form>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button secondary" type="button" onClick={onApplySearch}>
              搜索
            </button>
          </div>
        </div>

        {appliedQuery ? <div className="status-note info">当前搜索：{appliedQuery}</div> : null}
        <div className="status-note info">当前列表已按优先级、接单状态和等待时长自动排序。</div>

        {!items.length ? (
          <StatePanel
            compact
            tone="empty"
            title="当前没有匹配工单"
            description="试试切换状态筛选，或清空关键词查看全部恢复请求。"
            action={
              appliedQuery || statusFilter !== "all" ? (
                <button className="button secondary" type="button" onClick={onClearFilters}>
                  清空筛选
                </button>
              ) : null
            }
          />
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="card"
                onClick={() => onSelectItem(item.id)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  border: item.id === selectedItemId ? "1px solid rgba(47,109,246,0.5)" : "1px solid rgba(15,23,42,0.08)",
                  boxShadow: item.id === selectedItemId ? "0 8px 24px rgba(47,109,246,0.12)" : undefined
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div className="section-title">{item.name || item.email}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-1)" }}>{item.email}</div>
                  </div>
                  <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                    <span className={`status-note ${statusTones[item.status]}`} style={{ margin: 0 }}>
                      {statusLabels[item.status]}
                    </span>
                    <span className={`status-note ${priorityTones[item.priority]}`} style={{ margin: 0 }}>
                      {priorityLabels[item.priority]}
                    </span>
                  </div>
                </div>
                <div className="pill-list" style={{ marginTop: 10 }}>
                  <span className="pill">{roleLabels[item.role]}</span>
                  <span className="pill">{issueLabels[item.issueType]}</span>
                  <span className="pill">{slaLabels[item.slaState]}</span>
                  {item.isUnassigned ? <span className="pill">待接单</span> : null}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>
                  提交于 {formatLoadedTime(item.createdAt)} · 等待 {formatWaitingHours(item.waitingHours)}
                </div>
                <div style={{ marginTop: 8, color: "var(--ink-1)", fontSize: 13 }}>{item.priorityReason}</div>
                {item.note ? <div style={{ marginTop: 8, color: "var(--ink-1)", fontSize: 13 }}>{item.note}</div> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
