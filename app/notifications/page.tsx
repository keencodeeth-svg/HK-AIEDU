"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, requestJson, type RequestError } from "@/lib/client-request";

type Notification = {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  readAt?: string;
};

type ReadFilter = "all" | "unread" | "read";

const TYPE_LABELS: Record<string, string> = {
  assignment: "作业",
  assignment_reminder: "作业提醒",
  review: "批改反馈",
  class: "班级",
  announcement: "公告",
  teacher_alert_action: "教师动作",
  exam_review_pack: "考试复盘",
  exam_review_pack_parent: "家长复盘"
};

function getNotificationTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

export default function NotificationsPage() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  async function load(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await requestJson<{ data?: Notification[] }>("/api/notifications");
      setAuthRequired(false);
      setList(data.data ?? []);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setList([]);
      } else {
        setError(requestError.message || "加载失败");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const unreadCount = useMemo(() => list.filter((item) => !item.readAt).length, [list]);
  const readCount = Math.max(0, list.length - unreadCount);
  const typeOptions = useMemo(() => Array.from(new Set(list.map((item) => item.type))), [list]);
  const hasActiveFilters = readFilter !== "all" || typeFilter !== "all" || keyword.trim().length > 0;

  const filteredList = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return list.filter((item) => {
      if (readFilter === "unread" && item.readAt) return false;
      if (readFilter === "read" && !item.readAt) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!keywordLower) return true;
      return [item.title, item.content, getNotificationTypeLabel(item.type)].join(" ").toLowerCase().includes(keywordLower);
    });
  }, [keyword, list, readFilter, typeFilter]);

  async function markRead(id: string) {
    if (actingKey) return;
    setActingKey(id);
    setError(null);
    try {
      const data = await requestJson<{ data?: Notification }>("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const updated = data.data;
      setList((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                readAt: updated?.readAt ?? new Date().toISOString()
              }
            : item
        )
      );
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setList([]);
      } else {
        setError(requestError.message || "操作失败");
      }
    } finally {
      setActingKey(null);
    }
  }

  async function markAllRead() {
    const unreadIds = list.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length || actingKey) return;

    setActingKey("all");
    setError(null);
    try {
      const results = await Promise.allSettled(
        unreadIds.map((id) =>
          requestJson<{ data?: Notification }>("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          })
        )
      );
      const hasRejected = results.some((item) => item.status === "rejected");
      if (hasRejected) {
        throw new Error("部分通知标记失败，请稍后再试");
      }
      const readAt = new Date().toISOString();
      setList((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt })));
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setList([]);
      } else {
        setError(requestError.message || "批量操作失败");
      }
      await load("refresh");
    } finally {
      setActingKey(null);
    }
  }

  function clearFilters() {
    setReadFilter("all");
    setTypeFilter("all");
    setKeyword("");
  }

  if (loading && !list.length && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="通知中心加载中"
        description="正在同步作业提醒、班级动态和学习反馈。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看通知"
        description="登录后可查看作业、班级和学习相关提醒。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (error && !list.length) {
    return (
      <StatePanel
        tone="error"
        title="通知中心暂时不可用"
        description={error}
        action={
          <button className="button secondary" type="button" onClick={() => void load("refresh")}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>通知中心</h2>
          <div className="section-sub">作业、班级与学习提醒，支持筛选、搜索、刷新与批量已读。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">提醒</span>
          <span className="chip">未读 {unreadCount}</span>
          <span className="chip">总计 {list.length}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void load("refresh")} disabled={refreshing || actingKey !== null}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${error}`}
          action={
            <button className="button secondary" type="button" onClick={() => void load("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      <Card title="通知概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">通知总数</div>
            <div className="workflow-summary-value">{list.length}</div>
            <div className="workflow-summary-helper">当前账号可见的全部通知</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">未读通知</div>
            <div className="workflow-summary-value">{unreadCount}</div>
            <div className="workflow-summary-helper">建议优先处理的最新提醒</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">已读通知</div>
            <div className="workflow-summary-value">{readCount}</div>
            <div className="workflow-summary-helper">已确认或已浏览的消息</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">通知类型</div>
            <div className="workflow-summary-value">{typeOptions.length}</div>
            <div className="workflow-summary-helper">作业、班级、公告等分类提醒</div>
          </div>
        </div>
      </Card>

      <Card title="筛选与操作" tag="筛选">
        <div className="toolbar-wrap" style={{ marginBottom: 10 }}>
          <button className={readFilter === "all" ? "button secondary" : "button ghost"} type="button" onClick={() => setReadFilter("all")}>
            全部
          </button>
          <button className={readFilter === "unread" ? "button secondary" : "button ghost"} type="button" onClick={() => setReadFilter("unread")}>
            仅看未读
          </button>
          <button className={readFilter === "read" ? "button secondary" : "button ghost"} type="button" onClick={() => setReadFilter("read")}>
            仅看已读
          </button>
          <select className="select-control" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
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
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索通知标题、内容或类型"
            aria-label="搜索通知"
          />
          <button className="button ghost" type="button" onClick={clearFilters} disabled={!hasActiveFilters}>
            清空筛选
          </button>
          <button className="button secondary" type="button" onClick={() => void markAllRead()} disabled={!unreadCount || actingKey !== null}>
            {actingKey === "all" ? "处理中..." : "全部标记已读"}
          </button>
        </div>
        <div className="workflow-card-meta">
          <span className="pill">当前显示 {filteredList.length} 条</span>
          <span className="pill">未读 {unreadCount} 条</span>
          <span className="pill">类型 {typeFilter === "all" ? "全部" : getNotificationTypeLabel(typeFilter)}</span>
        </div>
      </Card>

      <Card title="通知列表" tag="消息">
        {!list.length ? (
          <StatePanel
            compact
            tone="empty"
            title="目前没有通知"
            description="当老师发布作业、班级有新动态或系统推送提醒时，这里会第一时间展示。"
          />
        ) : !filteredList.length ? (
          <StatePanel
            compact
            tone="empty"
            title="没有匹配的通知"
            description="试试更换筛选条件或清空关键词。"
            action={
              <button className="button secondary" type="button" onClick={clearFilters}>
                清空筛选
              </button>
            }
          />
        ) : (
          <div className="notification-list">
            {filteredList.map((item) => (
              <div className={`notification-item-card${item.readAt ? "" : " unread"}`} key={item.id}>
                <div className="notification-item-header">
                  <div>
                    <div className="section-title">{item.title}</div>
                    <div className="notification-item-meta">
                      <span className="pill">{getNotificationTypeLabel(item.type)}</span>
                      <span className="pill">{item.readAt ? "已读" : "未读"}</span>
                      <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                  {!item.readAt ? (
                    <button className="button secondary" type="button" onClick={() => void markRead(item.id)} disabled={actingKey !== null}>
                      {actingKey === item.id ? "处理中..." : "标记已读"}
                    </button>
                  ) : null}
                </div>
                <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{item.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
