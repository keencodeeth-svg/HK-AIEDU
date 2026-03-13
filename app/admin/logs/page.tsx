"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import { parseAdminAuditDetail } from "@/lib/admin-audit";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";

type AdminLog = {
  id: string;
  adminId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: string | null;
  createdAt: string;
};

function formatAuditJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedAction, setAppliedAction] = useState("");
  const [appliedEntityType, setAppliedEntityType] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

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
        params.set("limit", "100");
        if (appliedAction.trim()) {
          params.set("action", appliedAction.trim());
        }
        if (appliedEntityType.trim()) {
          params.set("entityType", appliedEntityType.trim());
        }
        if (appliedQuery.trim()) {
          params.set("query", appliedQuery.trim());
        }

        const payload = await requestJson<{ data?: AdminLog[] }>(`/api/admin/logs?${params.toString()}`);
        setLogs(payload.data ?? []);
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        setAuthRequired(isAuthError(error));
        setPageError(getRequestErrorMessage(error, "加载管理日志失败"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedAction, appliedEntityType, appliedQuery]
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>管理操作日志</h2>
          <div className="section-sub">记录管理端关键操作。</div>
        </div>
        <div className="cta-row" style={{ alignItems: "center", gap: 8 }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">安全</span>
          <button className="button secondary" type="button" onClick={() => void load("refresh")} disabled={refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <Card title="筛选与检索" tag="过滤">
        <div className="grid grid-3" style={{ gap: 12 }}>
          <label>
            <div className="section-title">操作类型</div>
            <input
              value={actionInput}
              onChange={(event) => setActionInput(event.target.value)}
              placeholder="如 update_ai_quality_calibration"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">资源类型</div>
            <input
              value={entityTypeInput}
              onChange={(event) => setEntityTypeInput(event.target.value)}
              placeholder="如 ai_quality_calibration"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">关键字</div>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="支持工单号、管理员、详情关键字"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: 10, gap: 8 }}>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setAppliedAction(actionInput);
              setAppliedEntityType(entityTypeInput);
              setAppliedQuery(searchInput);
            }}
            disabled={loading || refreshing}
          >
            查询
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              setActionInput("");
              setEntityTypeInput("");
              setSearchInput("");
              setAppliedAction("");
              setAppliedEntityType("");
              setAppliedQuery("");
            }}
            disabled={loading || refreshing}
          >
            清空
          </button>
        </div>
      </Card>

      <Card title="操作日志" tag="审计">
        {loading ? <p>加载中...</p> : null}
        {!loading && authRequired ? <div style={{ color: "#b42318", fontSize: 13 }}>需要管理员登录后查看日志。</div> : null}
        {!loading && !authRequired && pageError ? <div style={{ color: "#b42318", fontSize: 13 }}>{pageError}</div> : null}
        {!loading && !pageError && logs.length === 0 ? <p>暂无匹配日志。</p> : null}
        <div className="grid" style={{ gap: 10 }}>
          {logs.map((log) => {
            const auditDetail = parseAdminAuditDetail(log.detail);
            return (
              <div className="card" key={log.id}>
                <div className="section-title">{log.action}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {new Date(log.createdAt).toLocaleString("zh-CN")} · 管理员 {log.adminId ?? "-"}
                </div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {log.entityType} · {log.entityId ?? "-"}
                </div>
                {auditDetail ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <div>{auditDetail.summary}</div>
                    {auditDetail.reason ? (
                      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>原因：{auditDetail.reason}</div>
                    ) : null}
                    {auditDetail.changedFields?.length ? (
                      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        变更字段：{auditDetail.changedFields.join("、")}
                      </div>
                    ) : null}
                    {auditDetail.before ? (
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 12 }}>变更前</summary>
                        <pre style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap" }}>{formatAuditJson(auditDetail.before)}</pre>
                      </details>
                    ) : null}
                    {auditDetail.after ? (
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 12 }}>变更后</summary>
                        <pre style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap" }}>{formatAuditJson(auditDetail.after)}</pre>
                      </details>
                    ) : null}
                    {auditDetail.meta ? (
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 12 }}>附加信息</summary>
                        <pre style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap" }}>{formatAuditJson(auditDetail.meta)}</pre>
                      </details>
                    ) : null}
                  </div>
                ) : log.detail ? (
                  <div style={{ marginTop: 6 }}>{log.detail}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
