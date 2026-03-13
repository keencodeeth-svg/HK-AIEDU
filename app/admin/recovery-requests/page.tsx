"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";

type RecoveryRole = "student" | "teacher" | "parent" | "admin" | "school_admin";
type RecoveryIssueType = "forgot_password" | "forgot_account" | "account_locked";
type RecoveryStatus = "pending" | "in_progress" | "resolved" | "rejected";
type RecoveryPriority = "urgent" | "high" | "normal";
type RecoverySlaState = "healthy" | "at_risk" | "overdue" | "closed";
type RecoveryFilterStatus = RecoveryStatus | "all";

type RecoveryItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RecoveryStatus;
  role: RecoveryRole;
  email: string;
  name?: string;
  issueType: RecoveryIssueType;
  note?: string;
  studentEmail?: string;
  schoolName?: string;
  matchedUserId?: string | null;
  matchedUserRole?: string | null;
  handledByAdminId?: string | null;
  handledAt?: string | null;
  adminNote?: string;
  isOverdue: boolean;
  waitingHours: number;
  priority: RecoveryPriority;
  priorityReason: string;
  slaState: RecoverySlaState;
  targetBy: string | null;
  nextActionLabel: string;
  isUnassigned: boolean;
};

type RecoverySummary = {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  urgent: number;
  highPriority: number;
  unassigned: number;
};

type RecoveryListResponse = {
  data?: {
    items?: RecoveryItem[];
    summary?: RecoverySummary;
  };
};

type RecoveryActionResponse = {
  message?: string;
  data?: RecoveryItem;
};

const statusOptions: Array<{ value: RecoveryFilterStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "resolved", label: "已解决" },
  { value: "rejected", label: "无法核验" }
];

const roleLabels: Record<RecoveryRole, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
  school_admin: "学校管理员"
};

const issueLabels: Record<RecoveryIssueType, string> = {
  forgot_password: "忘记密码",
  forgot_account: "找回账号",
  account_locked: "账号锁定"
};

const statusLabels: Record<RecoveryStatus, string> = {
  pending: "待处理",
  in_progress: "处理中",
  resolved: "已解决",
  rejected: "无法核验"
};

const statusTones: Record<RecoveryStatus, "info" | "success" | "error"> = {
  pending: "info",
  in_progress: "info",
  resolved: "success",
  rejected: "error"
};

const priorityLabels: Record<RecoveryPriority, string> = {
  urgent: "紧急",
  high: "高优先",
  normal: "常规"
};

const slaLabels: Record<RecoverySlaState, string> = {
  healthy: "SLA 充足",
  at_risk: "SLA 临近",
  overdue: "SLA 超时",
  closed: "已闭环"
};

const priorityTones: Record<RecoveryPriority, "error" | "info" | "success"> = {
  urgent: "error",
  high: "info",
  normal: "success"
};

function formatWaitingHours(value: number) {
  if (value < 1) {
    return `${Math.max(1, Math.round(value * 60))} 分钟`;
  }
  if (value >= 10) {
    return `${Math.round(value)} 小时`;
  }
  return `${value.toFixed(1)} 小时`;
}

function formatTargetBy(value: string | null) {
  if (!value) return "--";
  return formatLoadedTime(value);
}

export default function AdminRecoveryRequestsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecoveryFilterStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actingStatus, setActingStatus] = useState<RecoveryStatus | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);
      setAuthRequired(false);

      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (appliedQuery.trim()) {
          params.set("query", appliedQuery.trim());
        }

        const payload = await requestJson<RecoveryListResponse>(`/api/admin/recovery-requests?${params.toString()}`);
        const nextItems = payload.data?.items ?? [];
        setItems(nextItems);
        setSummary(payload.data?.summary ?? null);
        setSelectedId((current) => {
          if (current && nextItems.some((item) => item.id === current)) {
            return current;
          }
          return nextItems[0]?.id ?? null;
        });
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        setAuthRequired(isAuthError(error));
        setPageError(getRequestErrorMessage(error, "加载恢复工单失败"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedQuery, statusFilter]
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => {
    setActionMessage(null);
    setActionError(null);
    setActionNote(selectedItem?.adminNote ?? "");
  }, [selectedItem?.adminNote, selectedItem?.id]);

  async function performAction(nextStatus: RecoveryStatus) {
    if (!selectedItem) return;
    const requiresConfirmation = nextStatus === "resolved" || nextStatus === "rejected";
    if (requiresConfirmation) {
      const label = nextStatus === "resolved" ? "标记为已解决" : "标记为无法核验";
      const confirmed = window.confirm(`确认要将该恢复工单${label}吗？此操作会写入管理员处理记录。`);
      if (!confirmed) {
        return;
      }
    }
    setActingStatus(nextStatus);
    setActionMessage(null);
    setActionError(null);

    try {
      await runWithStepUp(
        async () => {
          const payload = await requestJson<RecoveryActionResponse>(`/api/admin/recovery-requests/${selectedItem.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: nextStatus,
              adminNote: actionNote,
              confirmAction: requiresConfirmation || undefined
            })
          });
          setActionMessage(payload.message ?? "恢复工单已更新");
          await load("refresh");
        },
        (error) => {
          setActionError(getRequestErrorMessage(error, "更新恢复工单失败"));
        }
      );
    } finally {
      setActingStatus(null);
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>账号恢复工单台</h2>
          <div className="section-sub">处理忘记密码、找回账号与锁定解封请求，形成完整人工恢复闭环。</div>
        </div>
        <div className="cta-row" style={{ alignItems: "center", gap: 8 }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void load("refresh")} disabled={refreshing || actingStatus !== null}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <Card title="服务水位" tag="恢复中心">
        <div className="pill-list">
          <span className="pill">总工单 {summary?.total ?? items.length}</span>
          <span className="pill">待处理 {summary?.pending ?? 0}</span>
          <span className="pill">处理中 {summary?.inProgress ?? 0}</span>
          <span className="pill">紧急 {summary?.urgent ?? 0}</span>
          <span className="pill">高优先 {summary?.highPriority ?? 0}</span>
          <span className="pill">未接单 {summary?.unassigned ?? 0}</span>
          <span className="pill">超 SLA {summary?.overdue ?? 0}</span>
        </div>
      </Card>

      {!loading && !pageError && (summary?.overdue ?? 0) > 0 ? (
        <StatePanel
          tone="error"
          title={`当前有 ${summary?.overdue ?? 0} 条恢复工单超出 SLA`}
          description="请优先处理超时与账号锁定类工单，避免持续影响用户登录与账号找回。"
        />
      ) : !loading && !pageError && ((summary?.urgent ?? 0) > 0 || (summary?.highPriority ?? 0) > 0) ? (
        <StatePanel
          tone="info"
          title={`优先队列：紧急 ${summary?.urgent ?? 0} 条，高优先 ${summary?.highPriority ?? 0} 条`}
          description="列表已按优先级、状态与等待时长自动排序，建议从上往下处理。"
        />
      ) : null}

      {pageError && items.length ? <div className="status-note error">最新刷新失败：{pageError}</div> : null}

      {loading && !items.length ? (
        <StatePanel title="恢复工单加载中" description="正在同步最近的账号恢复请求与处理状态。" tone="loading" />
      ) : null}

      {!loading && pageError && !items.length ? (
        <StatePanel
          title={authRequired ? "暂无权限查看工单台" : "恢复工单加载失败"}
          description={pageError}
          tone="error"
          action={
            <button className="button secondary" type="button" onClick={() => void load("initial")}>
              重新加载
            </button>
          }
        />
      ) : null}

      {!loading && !pageError ? (
        <div className="grid" style={{ gap: 18, gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)" }}>
          <Card title="工单列表" tag="分诊">
            <div className="grid" style={{ gap: 12 }}>
              <div className="grid" style={{ gap: 10, gridTemplateColumns: "180px minmax(0, 1fr) auto" }}>
                <label className="form-field" style={{ marginBottom: 0 }}>
                  <div className="section-title">状态筛选</div>
                  <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RecoveryFilterStatus)}>
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
                    setAppliedQuery(searchInput.trim());
                  }}
                >
                  <div className="section-title">搜索</div>
                  <input
                    className="form-control"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="邮箱、姓名、学校、工单号"
                  />
                </form>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button className="button secondary" type="button" onClick={() => setAppliedQuery(searchInput.trim())}>
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
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          setSearchInput("");
                          setAppliedQuery("");
                          setStatusFilter("all");
                        }}
                      >
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
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        textAlign: "left",
                        cursor: "pointer",
                        border: item.id === selectedItem?.id ? "1px solid rgba(47,109,246,0.5)" : "1px solid rgba(15,23,42,0.08)",
                        boxShadow: item.id === selectedItem?.id ? "0 8px 24px rgba(47,109,246,0.12)" : undefined
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
                    onChange={(event) => setActionNote(event.target.value)}
                    placeholder="记录核验结果、联系渠道、重置说明或驳回原因"
                    disabled={actingStatus !== null}
                  />
                </label>

                <div className="cta-row" style={{ flexWrap: "wrap", gap: 10 }}>
                  {selectedItem.status !== "in_progress" ? (
                    <button className="button secondary" type="button" onClick={() => void performAction("in_progress")} disabled={actingStatus !== null}>
                      {actingStatus === "in_progress" ? "处理中..." : "开始处理"}
                    </button>
                  ) : null}
                  {selectedItem.status !== "resolved" ? (
                    <button className="button primary" type="button" onClick={() => void performAction("resolved")} disabled={actingStatus !== null}>
                      {actingStatus === "resolved" ? "提交中..." : "标记已解决"}
                    </button>
                  ) : null}
                  {selectedItem.status !== "rejected" ? (
                    <button className="button secondary" type="button" onClick={() => void performAction("rejected")} disabled={actingStatus !== null || !actionNote.trim()}>
                      {actingStatus === "rejected" ? "提交中..." : "标记无法核验"}
                    </button>
                  ) : null}
                  {selectedItem.status !== "pending" ? (
                    <button className="button ghost" type="button" onClick={() => void performAction("pending")} disabled={actingStatus !== null}>
                      回到待处理
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}
      {stepUpDialog}
    </div>
  );
}
