"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type Topic = {
  id: string;
  classId: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
};

type Reply = {
  id: string;
  content: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
};

type CurrentUser = {
  id: string;
  role: string;
  name?: string;
};

type AuthMeResponse = {
  user?: CurrentUser;
  data?: {
    user?: CurrentUser;
  };
};

type ClassesResponse = {
  data?: ClassItem[];
};

type TopicsResponse = {
  data?: Topic[];
};

type TopicDetailResponse = {
  topic?: Topic;
  replies?: Reply[];
};

function truncateText(value: string, maxLength = 88) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

export default function DiscussionsPage() {
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const initialLoadRef = useRef(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState("");
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [keyword, setKeyword] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const teacherMode = user?.role === "teacher";
  const currentClass = classes.find((item) => item.id === classId) ?? null;
  const pinnedTopicCount = useMemo(() => topics.filter((item) => item.pinned).length, [topics]);
  const filteredTopics = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return topics.filter((topic) => {
      if (pinnedOnly && !topic.pinned) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [topic.title, topic.content, topic.authorName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [keyword, pinnedOnly, topics]);
  const hasTopicFilters = Boolean(keyword.trim()) || pinnedOnly;

  const stageCopy = (() => {
    if (loading) {
      return {
        title: "正在加载班级讨论区",
        description: "系统正在同步你的班级、话题与回复记录，请稍等。"
      };
    }

    if (!classes.length) {
      return teacherMode
        ? {
            title: "先绑定班级，再发起课堂讨论",
            description: "建立授课班级后，这里会自动开放发布话题、收集回复和班级讨论沉淀。"
          }
        : {
            title: "当前暂无可参与的班级讨论",
            description: "加入班级或等待老师发布讨论后，这里会自动出现可参与的话题。"
          };
    }

    if (activeTopic) {
      return {
        title: `正在查看「${activeTopic.title}」`,
        description: teacherMode
          ? "你可以继续补充教师引导、查看学生回复，或快速发布一个新的置顶话题。"
          : "你可以先读完老师发起的话题，再在下方直接回复，形成完整讨论闭环。"
      };
    }

    if (topics.length) {
      return {
        title: `当前班级已有 ${topics.length} 个讨论话题`,
        description: "可以通过关键词或置顶筛选快速定位，选择后会在右侧展开完整讨论详情。"
      };
    }

    return teacherMode
      ? {
          title: "当前班级还没有讨论话题",
          description: "建议先发布一个明确的问题或任务，引导学生围绕课堂重点展开交流。"
        }
      : {
          title: "老师暂时还没有发布话题",
          description: "等老师发起讨论后，你可以在这里查看说明、参与回复并回顾讨论记录。"
        };
  })();

  function scrollDetailIntoView(focusReply = false) {
    requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusReply) {
        replyInputRef.current?.focus();
      }
    });
  }

  function clearTopicFilters() {
    setKeyword("");
    setPinnedOnly(false);
  }

  const loadTopicDetail = useCallback(async (topicId: string, options?: { showLoading?: boolean }) => {
    if (!topicId) {
      setActiveTopicId("");
      setActiveTopic(null);
      setReplies([]);
      return;
    }

    if (options?.showLoading !== false) {
      setDetailLoading(true);
    }

    try {
      const data = await requestJson<TopicDetailResponse>(`/api/discussions/${topicId}`);
      setActiveTopicId(topicId);
      setActiveTopic(data.topic ?? null);
      setReplies(data.replies ?? []);
      setReplyText("");
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "加载话题详情失败"));
      setActiveTopicId("");
      setActiveTopic(null);
      setReplies([]);
    } finally {
      if (options?.showLoading !== false) {
        setDetailLoading(false);
      }
    }
  }, []);

  const loadTopicsForClass = useCallback(async (nextClassId: string, options?: { preferredTopicId?: string; showLoading?: boolean }) => {
    setClassId(nextClassId);
    setPageError(null);
    setActionError(null);

    if (!nextClassId) {
      setTopics([]);
      setActiveTopicId("");
      setActiveTopic(null);
      setReplies([]);
      setListLoading(false);
      setDetailLoading(false);
      return;
    }

    if (options?.showLoading !== false) {
      setListLoading(true);
      setDetailLoading(true);
    }

    try {
      const data = await requestJson<TopicsResponse>(`/api/discussions?classId=${encodeURIComponent(nextClassId)}`);
      const nextTopics = data.data ?? [];
      setTopics(nextTopics);

      const preferredTopicId = options?.preferredTopicId;
      const resolvedTopicId =
        (preferredTopicId && nextTopics.some((item) => item.id === preferredTopicId) ? preferredTopicId : "") ||
        (activeTopicId && nextTopics.some((item) => item.id === activeTopicId) ? activeTopicId : "") ||
        nextTopics[0]?.id ||
        "";

      if (resolvedTopicId) {
        await loadTopicDetail(resolvedTopicId, { showLoading: false });
      } else {
        setActiveTopicId("");
        setActiveTopic(null);
        setReplies([]);
      }
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      setPageError(getRequestErrorMessage(error, "加载讨论话题失败"));
      setTopics([]);
      setActiveTopicId("");
      setActiveTopic(null);
      setReplies([]);
    } finally {
      if (options?.showLoading !== false) {
        setListLoading(false);
        setDetailLoading(false);
      }
    }
  }, [activeTopicId, loadTopicDetail]);

  const loadSession = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setPageError(null);

    try {
      const [meData, classData] = await Promise.all([
        requestJson<AuthMeResponse>("/api/auth/me"),
        requestJson<ClassesResponse>("/api/classes")
      ]);

      const nextUser = meData.user ?? meData.data?.user ?? null;
      const nextClasses = classData.data ?? [];
      const nextClassId = nextClasses.some((item) => item.id === classId) ? classId : nextClasses[0]?.id ?? "";

      setUser(nextUser);
      setAuthRequired(false);
      setClasses(nextClasses);
      setClassId(nextClassId);

      if (nextClassId) {
        await loadTopicsForClass(nextClassId, {
          preferredTopicId: nextClasses.some((item) => item.id === classId) ? activeTopicId : undefined,
          showLoading: false
        });
      } else {
        setTopics([]);
        setActiveTopicId("");
        setActiveTopic(null);
        setReplies([]);
      }

      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setUser(null);
        setClasses([]);
        setTopics([]);
        setActiveTopicId("");
        setActiveTopic(null);
        setReplies([]);
      } else {
        setPageError(getRequestErrorMessage(error, "加载讨论区失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setListLoading(false);
      setDetailLoading(false);
    }
  }, [activeTopicId, classId, loadTopicsForClass]);

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }
    initialLoadRef.current = true;
    void loadSession("initial");
  }, [loadSession]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId || !title.trim() || !content.trim()) {
      setActionError("请先补全班级、标题和话题内容。");
      return;
    }

    setCreating(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const payload = await requestJson<{ data?: Topic }>("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title: title.trim(), content: content.trim(), pinned })
      });

      const createdTopicId = payload.data?.id ?? "";
      setTitle("");
      setContent("");
      setPinned(false);
      setActionMessage("话题已发布，并已自动打开详情，方便继续查看学生回复。");
      await loadTopicsForClass(classId, { preferredTopicId: createdTopicId, showLoading: true });
      scrollDetailIntoView();
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "发布失败"));
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTopic || !replyText.trim()) {
      setActionError("请输入回复内容后再发送。");
      return;
    }

    setReplySubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await requestJson(`/api/discussions/${activeTopic.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() })
      });

      setReplyText("");
      setActionMessage("回复已发送，讨论记录已经更新。");
      await loadTopicsForClass(classId, { preferredTopicId: activeTopic.id, showLoading: false });
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      setActionError(getRequestErrorMessage(error, "回复失败"));
    } finally {
      setReplySubmitting(false);
    }
  }

  if (loading && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载讨论区"
        description="正在同步班级、话题与回复数据，请稍等片刻。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看讨论区"
        description="登录后即可按身份进入班级讨论，查看老师话题并继续互动。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (pageError && !classes.length && !topics.length) {
    return (
      <StatePanel
        tone="error"
        title="讨论区加载失败"
        description={pageError}
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
          <h2>课程讨论区</h2>
          <div className="section-sub">班级话题、课堂答疑、互动回复与讨论沉淀统一收敛。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">讨论</span>
          <span className="chip">班级 {classes.length}</span>
          <span className="chip">话题 {topics.length}</span>
          <span className="chip">置顶 {pinnedTopicCount}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={() => void loadSession("refresh")}
            disabled={refreshing || listLoading || detailLoading || creating || replySubmitting}
          >
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${pageError}`}
          action={
            <button className="button secondary" type="button" onClick={() => void loadSession("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      {actionError ? <div className="status-note error">{actionError}</div> : null}
      {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}

      <div className="discussion-stage-banner">
        <div className="discussion-stage-kicker">当前阶段</div>
        <div className="discussion-stage-title">{stageCopy.title}</div>
        <p className="discussion-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">{currentClass?.name ?? "未选择班级"}</span>
          <span className="pill">{currentClass ? SUBJECT_LABELS[currentClass.subject] ?? currentClass.subject : "待同步学科"}</span>
          <span className="pill">{currentClass ? getGradeLabel(currentClass.grade) : "待同步年级"}</span>
          <span className="pill">{teacherMode ? "教师视角" : user?.role === "parent" ? "家长视角" : "学生视角"}</span>
          <span className="pill">当前回复 {activeTopic ? replies.length : 0}</span>
        </div>
      </div>

      <Card title="讨论概览" tag="概览">
        <div className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前班级</div>
            <div className="workflow-summary-value">{currentClass ? 1 : 0}</div>
            <div className="workflow-summary-helper">{currentClass ? `${currentClass.name} · ${getGradeLabel(currentClass.grade)}` : "尚未加入可讨论班级"}</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">班级话题</div>
            <div className="workflow-summary-value">{topics.length}</div>
            <div className="workflow-summary-helper">可浏览、筛选并继续参与的讨论话题数</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">置顶话题</div>
            <div className="workflow-summary-value">{pinnedTopicCount}</div>
            <div className="workflow-summary-helper">老师优先希望同学查看和回复的重点讨论</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">当前回复</div>
            <div className="workflow-summary-value">{activeTopic ? replies.length : 0}</div>
            <div className="workflow-summary-helper">{activeTopic ? `围绕「${activeTopic.title}」的讨论进展` : "选择一个话题后查看完整回复"}</div>
          </div>
        </div>
      </Card>

      <Card title="班级与筛选" tag="筛选">
        {!classes.length ? (
          <StatePanel
            compact
            tone="info"
            title="当前没有可进入的班级讨论"
            description={teacherMode ? "先建立授课班级后，再来这里发布讨论话题。" : "加入班级后，这里会自动显示你可参与的话题。"}
          />
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            <label>
              <div className="section-title">选择班级</div>
              <select
                value={classId}
                onChange={(event) => {
                  setActionError(null);
                  setActionMessage(null);
                  void loadTopicsForClass(event.target.value, { showLoading: true });
                }}
                className="select-control"
                style={{ width: "100%" }}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {getGradeLabel(item.grade)}
                  </option>
                ))}
              </select>
            </label>

            <div className="workflow-toolbar" style={{ justifyContent: "flex-start" }}>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="workflow-search-input"
                placeholder="搜索话题标题、正文或发起人"
              />
              <button className={pinnedOnly ? "button secondary" : "button ghost"} type="button" onClick={() => setPinnedOnly((prev) => !prev)}>
                {pinnedOnly ? "只看置顶中" : "只看置顶"}
              </button>
              {hasTopicFilters ? (
                <button className="button ghost" type="button" onClick={clearTopicFilters}>
                  清空筛选
                </button>
              ) : null}
              <span className="chip">显示 {filteredTopics.length} / {topics.length}</span>
            </div>
          </div>
        )}
      </Card>

      {teacherMode ? (
        <Card title="发布新话题" tag="教师">
          <div className="feature-card">
            <EduIcon name="pencil" />
            <p>用明确问题、课堂任务或复盘要求发起讨论，能显著提升学生参与度和回复质量。</p>
          </div>
          {!classes.length ? (
            <StatePanel
              compact
              tone="info"
              title="当前没有可发布的班级"
              description="创建或接入授课班级后，即可在这里发起课堂讨论。"
            />
          ) : (
            <form onSubmit={handleCreate} className="inbox-compose-form">
              <label>
                <div className="section-title">话题标题</div>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="workflow-search-input"
                  placeholder="例如：这道题你会先从哪一步入手？"
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <div className="section-title">话题内容</div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={4}
                  className="inbox-textarea"
                  placeholder="补充讨论背景、题目说明或回复要求，让学生更容易高质量参与。"
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
                <span>置顶话题</span>
                <span className="form-note">置顶后会优先展示在列表顶部，适合课堂重点问题或本周必参与讨论。</span>
              </label>
              <div className="cta-row no-margin">
                <button className="button primary" type="submit" disabled={creating || !classId || !title.trim() || !content.trim()}>
                  {creating ? "发布中..." : "发布话题"}
                </button>
              </div>
            </form>
          )}
        </Card>
      ) : null}

      <div className="grid grid-2">
        <Card title="话题列表" tag="列表">
          {listLoading && !topics.length ? (
            <StatePanel compact tone="loading" title="正在加载话题" description="马上展示当前班级的最新讨论。" />
          ) : !classes.length ? (
            <StatePanel compact tone="empty" title="暂无班级讨论" description="加入班级后，这里会展示可参与的话题列表。" />
          ) : filteredTopics.length === 0 ? (
            <StatePanel
              compact
              tone="empty"
              title={hasTopicFilters ? "当前筛选条件下暂无话题" : "当前班级还没有讨论话题"}
              description={hasTopicFilters ? "可以清空筛选后查看全部话题。" : teacherMode ? "先发布一个课堂讨论，学生就能开始参与。" : "等老师发布新话题后，你可以在这里直接参与回复。"}
              action={
                hasTopicFilters ? (
                  <button className="button secondary" type="button" onClick={clearTopicFilters}>
                    清空筛选
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="inbox-thread-list">
              {filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`inbox-thread-item${topic.id === activeTopicId ? " active" : ""}`}
                  onClick={() => {
                    setActionError(null);
                    setActionMessage(null);
                    setActiveTopicId(topic.id);
                    void loadTopicDetail(topic.id, { showLoading: true });
                    scrollDetailIntoView();
                  }}
                >
                  <div className="inbox-thread-header">
                    <div className="section-title">{topic.title}</div>
                    {topic.pinned ? <span className="card-tag">置顶</span> : <span className="pill">普通</span>}
                  </div>
                  <div className="section-sub">
                    {topic.authorName ?? "老师"} · 发布于 {formatLoadedTime(topic.createdAt)}
                  </div>
                  <div className="inbox-thread-preview">{truncateText(topic.content)}</div>
                  <div className="workflow-card-meta">
                    <span className="pill">更新于 {formatLoadedTime(topic.updatedAt)}</span>
                    {topic.id === activeTopicId ? <span className="pill">当前查看中</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div id="discussion-detail-anchor" ref={detailSectionRef} />
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
                      const isSelf = Boolean(reply.authorId && reply.authorId === user?.id);
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

              <form onSubmit={handleReply} className="inbox-reply-form" style={{ marginTop: 12 }}>
                <textarea
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  rows={3}
                  placeholder={teacherMode ? "补充点评、追问或课堂引导..." : "写下你的想法、解题思路或问题..."}
                  className="inbox-textarea"
                />
                <div className="cta-row no-margin">
                  <button className="button primary" type="submit" disabled={replySubmitting || !replyText.trim()}>
                    {replySubmitting ? "发送中..." : "发送回复"}
                  </button>
                  <button className="button ghost" type="button" onClick={() => replyInputRef.current?.focus()}>
                    快速回复
                  </button>
                </div>
              </form>
            </>
          ) : (
            <StatePanel
              compact
              tone="empty"
              title="请选择一个话题查看详情"
              description="从左侧选择一个班级话题后，这里会展示完整内容和回复区。"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
