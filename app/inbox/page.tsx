"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, requestJson, type RequestError } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";

type UserSession = {
  id: string;
  role: string;
  name: string;
};

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type ThreadSummary = {
  id: string;
  subject: string;
  updatedAt: string;
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessage?: { content: string; createdAt: string } | null;
  unreadCount: number;
};

type ThreadDetail = {
  thread: { id: string; subject: string };
  participants: Array<{ id: string; name: string; role: string }>;
  messages: Array<{ id: string; senderId?: string; content: string; createdAt: string }>;
};

function getComposeHint(role: string | null) {
  if (role === "teacher") {
    return "支持按班级发送给学生，并可选择同步给家长。";
  }
  if (role === "parent") {
    return "按班级发送给任课老师，适合家校沟通与反馈。";
  }
  return "按班级发送给任课老师，适合提问、反馈和沟通学习安排。";
}

export default function InboxPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserSession | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [replyText, setReplyText] = useState("");
  const [includeParents, setIncludeParents] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const didInitRef = useRef(false);
  const requestedThreadId = searchParams.get("threadId")?.trim() ?? "";

  const loadThreads = useCallback(async (preferredThreadId?: string) => {
    const data = await requestJson<{ data?: ThreadSummary[] }>("/api/inbox/threads");
    const nextThreads = data.data ?? [];
    setThreads(nextThreads);
    setActiveThreadId((prev) => {
      const candidate = preferredThreadId || requestedThreadId || prev;
      if (candidate && nextThreads.some((thread) => thread.id === candidate)) {
        return candidate;
      }
      return nextThreads[0]?.id ?? "";
    });
  }, [requestedThreadId]);

  const loadSession = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [authData, classData] = await Promise.all([
        requestJson<{ user?: UserSession }>("/api/auth/me"),
        requestJson<{ data?: ClassItem[] }>("/api/classes")
      ]);
      setAuthRequired(false);
      setUser(authData.user ?? null);
      const nextClasses = classData.data ?? [];
      setClasses(nextClasses);
      setClassId((prev) => {
        if (prev && nextClasses.some((item) => item.id === prev)) {
          return prev;
        }
        return nextClasses[0]?.id ?? "";
      });
      await loadThreads(activeThreadId);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setUser(null);
        setClasses([]);
        setThreads([]);
        setThreadDetail(null);
      } else {
        setError(requestError.message || "加载失败");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeThreadId, loadThreads]);

  async function loadThreadDetail(threadId: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await requestJson<{ data?: ThreadDetail }>(`/api/inbox/threads/${threadId}`);
      setThreadDetail(data.data ?? null);
      setThreads((prev) =>
        prev.map((thread) => (thread.id === threadId ? { ...thread, unreadCount: 0 } : thread))
      );
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setUser(null);
        setThreads([]);
        setThreadDetail(null);
      } else {
        setError(requestError.message || "加载失败");
      }
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!activeThreadId) {
      setThreadDetail(null);
      return;
    }
    void loadThreadDetail(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (!requestedThreadId) {
      return;
    }
    if (threads.some((thread) => thread.id === requestedThreadId) && activeThreadId !== requestedThreadId) {
      setActiveThreadId(requestedThreadId);
    }
  }, [activeThreadId, requestedThreadId, threads]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const currentClass = classes.find((item) => item.id === classId) ?? null;
  const unreadCount = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0),
    [threads]
  );

  const filteredThreads = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return threads.filter((thread) => {
      if (unreadOnly && !thread.unreadCount) return false;
      if (!keywordLower) return true;
      return [thread.subject, thread.lastMessage?.content ?? "", ...thread.participants.map((item) => item.name)]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [keyword, threads, unreadOnly]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      const data = await requestJson<{ data?: { threadId?: string } }>("/api/inbox/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, content, classId, includeParents })
      });
      const nextThreadId = data.data?.threadId ?? "";
      setMessage("消息已发送");
      setSubject("");
      setContent("");
      setIncludeParents(false);
      await loadThreads(nextThreadId);
      if (nextThreadId) {
        await loadThreadDetail(nextThreadId);
      }
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setUser(null);
        setThreads([]);
        setThreadDetail(null);
      } else {
        setError(requestError.message || "发送失败");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!activeThreadId) return;
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      await requestJson(`/api/inbox/threads/${activeThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText })
      });
      setReplyText("");
      setMessage("回复已发送");
      await loadThreads(activeThreadId);
      await loadThreadDetail(activeThreadId);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setUser(null);
        setThreads([]);
        setThreadDetail(null);
      } else {
        setError(requestError.message || "发送失败");
      }
    } finally {
      setActionLoading(false);
    }
  }

  function clearFilters() {
    setKeyword("");
    setUnreadOnly(false);
  }

  if (loading && !threads.length && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="收件箱加载中"
        description="正在同步会话列表、参与人和最新消息。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后使用收件箱"
        description="登录后即可查看会话列表、发送新消息并进行家校沟通。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (error && !threads.length && !threadDetail) {
    return (
      <StatePanel
        tone="error"
        title="收件箱暂时不可用"
        description={error}
        action={
          <button className="button secondary" type="button" onClick={() => void loadSession("refresh")}>
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
          <h2>站内信 / 收件箱</h2>
          <div className="section-sub">与老师、学生和家长保持沟通，支持筛选、未读追踪和快速回复。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">Inbox</span>
          <span className="chip">会话 {threads.length}</span>
          <span className="chip">未读 {unreadCount}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadSession("refresh")} disabled={refreshing || actionLoading || detailLoading}>
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
            <button className="button secondary" type="button" onClick={() => void loadSession("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      {requestedThreadId && activeThreadId === requestedThreadId ? (
        <StatePanel
          compact
          tone="success"
          title="已打开分享会话"
          description="你可以继续在这里回复老师或家长，完成这次拍题沟通闭环。"
        />
      ) : null}

      <Card title="沟通概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">会话总数</div>
            <div className="workflow-summary-value">{threads.length}</div>
            <div className="workflow-summary-helper">已建立的班级与家校沟通会话</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">未读消息</div>
            <div className="workflow-summary-value">{unreadCount}</div>
            <div className="workflow-summary-helper">需要优先查看和处理的消息数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前会话</div>
            <div className="workflow-summary-value">{activeThread ? 1 : 0}</div>
            <div className="workflow-summary-helper">{activeThread ? activeThread.subject : "尚未选中会话"}</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">班级范围</div>
            <div className="workflow-summary-value">{classes.length}</div>
            <div className="workflow-summary-helper">可用于发起沟通的班级数</div>
          </div>
        </div>
      </Card>

      <Card title="发送新消息" tag="新建">
        <div className="feature-card">
          <EduIcon name="board" />
          <p>{getComposeHint(user?.role ?? null)}</p>
        </div>
        {!classes.length ? (
          <StatePanel
            compact
            tone="info"
            title="当前没有可发信的班级"
            description="加入班级或建立教学关系后，这里会自动开放按班级沟通能力。"
          />
        ) : (
          <form onSubmit={handleCreate} className="inbox-compose-form">
            <label>
              <div className="section-title">选择班级</div>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="select-control"
                style={{ width: "100%" }}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">主题</div>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="workflow-search-input"
                placeholder="例如：本周作业安排、请假说明、课堂反馈"
              />
            </label>
            <label>
              <div className="section-title">内容</div>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={4}
                className="inbox-textarea"
                placeholder="输入要发送的消息内容..."
              />
            </label>
            {user?.role === "teacher" ? (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={includeParents} onChange={(event) => setIncludeParents(event.target.checked)} />
                同时抄送家长
              </label>
            ) : null}
            <div className="workflow-card-meta">
              {currentClass ? (
                <span className="pill">
                  发送给：{currentClass.name} · {SUBJECT_LABELS[currentClass.subject] ?? currentClass.subject}
                </span>
              ) : null}
              {user?.role === "teacher" ? <span className="pill">教师可按班级群发</span> : <span className="pill">学生/家长会发送给任课老师</span>}
            </div>
            {message ? <div className="status-note success">{message}</div> : null}
            <button className="button primary" type="submit" disabled={actionLoading || !subject.trim() || !content.trim() || !classId}>
              {actionLoading ? "发送中..." : "发送消息"}
            </button>
          </form>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="会话列表" tag="Threads">
          <div className="toolbar-wrap" style={{ marginBottom: 10 }}>
            <input
              className="workflow-search-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索主题、参与人、消息内容"
              aria-label="搜索会话"
            />
            <button className={unreadOnly ? "button secondary" : "button ghost"} type="button" onClick={() => setUnreadOnly((prev) => !prev)}>
              {unreadOnly ? "仅看未读中" : "仅看未读"}
            </button>
            <button className="button ghost" type="button" onClick={clearFilters} disabled={!keyword.trim() && !unreadOnly}>
              清空筛选
            </button>
          </div>
          <div className="workflow-card-meta">
            <span className="pill">显示 {filteredThreads.length} / {threads.length}</span>
            <span className="pill">未读 {unreadCount}</span>
          </div>
          {!threads.length ? (
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
                <button className="button secondary" type="button" onClick={clearFilters}>
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
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="inbox-thread-header">
                    <div className="section-title">{thread.subject}</div>
                    {thread.unreadCount ? <span className="card-tag">{thread.unreadCount} 未读</span> : <span className="pill">已读</span>}
                  </div>
                  <div className="workflow-summary-helper">
                    {thread.participants.map((p) => p.name).join("、") || "对话"}
                  </div>
                  {thread.lastMessage ? <div className="inbox-thread-preview">{thread.lastMessage.content}</div> : null}
                  <div className="workflow-summary-helper">更新于 {new Date(thread.updatedAt).toLocaleString("zh-CN")}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="会话详情" tag="消息">
          {detailLoading && !threadDetail ? (
            <StatePanel compact tone="loading" title="会话加载中" description="正在同步消息详情与参与人。" />
          ) : threadDetail ? (
            <>
              <div className="inbox-detail-header">
                <div className="section-title">{threadDetail.thread.subject}</div>
                <div className="section-sub">
                  参与人：{threadDetail.participants.map((p) => p.name).join("、") || "-"}
                </div>
                <div className="workflow-card-meta">
                  <span className="pill">参与人 {threadDetail.participants.length}</span>
                  <span className="pill">消息 {threadDetail.messages.length}</span>
                  {activeThread?.unreadCount ? <span className="pill">未读 {activeThread.unreadCount}</span> : <span className="pill">已同步阅读</span>}
                </div>
              </div>
              <div className="inbox-message-list">
                {threadDetail.messages.map((msg) => {
                  const isSelf = msg.senderId && msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`inbox-message-row${isSelf ? " self" : ""}`}>
                      <div className="inbox-message-bubble">
                        <div className="inbox-message-meta">{new Date(msg.createdAt).toLocaleString("zh-CN")}</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleReply} className="inbox-reply-form">
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
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
      </div>
    </div>
  );
}
