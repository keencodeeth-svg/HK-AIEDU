"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { ClassItem, ThreadDetail, ThreadSummary, UserSession } from "./types";
import {
  getInboxCreateRequestMessage,
  getInboxLoadRequestMessage,
  getInboxReplyRequestMessage,
  isInboxThreadDetailCurrent,
  isMissingInboxClassError,
  isMissingInboxThreadError,
  resolveInboxActiveThreadId,
  resolveInboxClassId
} from "./utils";

type InboxLoadStatus = "loaded" | "auth" | "error" | "stale" | "empty";

export function useInboxPage() {
  const searchParams = useSearchParams();
  const didInitRef = useRef(false);
  const sessionRequestIdRef = useRef(0);
  const threadListRequestIdRef = useRef(0);
  const threadDetailRequestIdRef = useRef(0);
  const classesRef = useRef<ClassItem[]>([]);
  const threadsRef = useRef<ThreadSummary[]>([]);
  const classIdRef = useRef("");
  const activeThreadIdRef = useRef("");
  const threadDetailRef = useRef<ThreadDetail | null>(null);
  const requestedThreadId = searchParams.get("threadId")?.trim() ?? "";

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
  const [composeMessage, setComposeMessage] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const applyClasses = useCallback((nextClasses: ClassItem[]) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
  }, []);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const applyThreads = useCallback((nextThreads: ThreadSummary[]) => {
    threadsRef.current = nextThreads;
    setThreads(nextThreads);
  }, []);

  const applyActiveThreadId = useCallback((nextThreadId: string) => {
    activeThreadIdRef.current = nextThreadId;
    setActiveThreadId(nextThreadId);
  }, []);

  const applyThreadDetail = useCallback((nextThreadDetail: ThreadDetail | null) => {
    threadDetailRef.current = nextThreadDetail;
    setThreadDetail(nextThreadDetail);
  }, []);

  const clearComposeFeedback = useCallback(() => {
    setComposeMessage(null);
    setComposeError(null);
  }, []);

  const clearReplyFeedback = useCallback(() => {
    setReplyMessage(null);
    setReplyError(null);
  }, []);

  const clearThreadDetailState = useCallback(
    (options?: { clearReplyDraft?: boolean; clearReplyFeedback?: boolean }) => {
      threadDetailRequestIdRef.current += 1;
      applyActiveThreadId("");
      applyThreadDetail(null);
      setDetailLoading(false);
      if (options?.clearReplyDraft !== false) {
        setReplyText("");
      }
      if (options?.clearReplyFeedback !== false) {
        clearReplyFeedback();
      }
    },
    [applyActiveThreadId, applyThreadDetail, clearReplyFeedback]
  );

  const clearInboxState = useCallback(() => {
    setUser(null);
    applyClasses([]);
    applyClassId("");
    applyThreads([]);
    applyActiveThreadId("");
    applyThreadDetail(null);
    setDetailLoading(false);
    setPageError(null);
    clearComposeFeedback();
    clearReplyFeedback();
    setReplyText("");
    setLastLoadedAt(null);
  }, [
    applyActiveThreadId,
    applyClassId,
    applyClasses,
    applyThreadDetail,
    applyThreads,
    clearComposeFeedback,
    clearReplyFeedback
  ]);

  const handleAuthRequired = useCallback(() => {
    sessionRequestIdRef.current += 1;
    threadListRequestIdRef.current += 1;
    threadDetailRequestIdRef.current += 1;
    clearInboxState();
    setLoading(false);
    setRefreshing(false);
    setActionLoading(false);
    setAuthRequired(true);
  }, [clearInboxState]);

  const loadThreadDetail = useCallback(
    async function loadThreadDetail(
      threadId: string,
      options?: { preserveCurrentDetail?: boolean; clearVisibleDetail?: boolean }
    ): Promise<InboxLoadStatus> {
      const requestId = threadDetailRequestIdRef.current + 1;
      threadDetailRequestIdRef.current = requestId;

      if (!threadId) {
        clearThreadDetailState();
        return "empty";
      }

      const shouldPreserveCurrentDetail =
        options?.preserveCurrentDetail ?? isInboxThreadDetailCurrent(threadDetailRef.current, threadId);
      const shouldClearVisibleDetail =
        options?.clearVisibleDetail ?? !shouldPreserveCurrentDetail;

      setDetailLoading(true);
      if (shouldClearVisibleDetail) {
        applyThreadDetail(null);
      }

      try {
        const data = await requestJson<{ data?: ThreadDetail }>(`/api/inbox/threads/${threadId}`);
        if (threadDetailRequestIdRef.current !== requestId) {
          return "stale";
        }

        const nextThreadDetail = data.data ?? null;
        setAuthRequired(false);
        applyThreadDetail(nextThreadDetail);
        applyThreads(
          threadsRef.current.map((thread) =>
            thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
          )
        );
        return "loaded";
      } catch (nextError) {
        if (threadDetailRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        const nextErrorMessage = getInboxLoadRequestMessage(nextError, "加载会话详情失败");

        if (isMissingInboxThreadError(nextError)) {
          const nextThreads = threadsRef.current.filter((thread) => thread.id !== threadId);
          const nextActiveThreadId = resolveInboxActiveThreadId(
            nextThreads,
            requestedThreadId,
            activeThreadIdRef.current === threadId ? "" : activeThreadIdRef.current
          );

          applyThreads(nextThreads);
          setPageError(nextErrorMessage);

          if (!nextActiveThreadId) {
            clearThreadDetailState();
            return "error";
          }

          applyActiveThreadId(nextActiveThreadId);
          setReplyText("");
          clearReplyFeedback();
          return loadThreadDetail(nextActiveThreadId, {
            preserveCurrentDetail: false,
            clearVisibleDetail: true
          });
        }

        setPageError(nextErrorMessage);
        if (!shouldPreserveCurrentDetail) {
          applyThreadDetail(null);
        }
        return "error";
      } finally {
        if (threadDetailRequestIdRef.current === requestId) {
          setDetailLoading(false);
        }
      }
    },
    [
      applyActiveThreadId,
      applyThreadDetail,
      applyThreads,
      clearReplyFeedback,
      clearThreadDetailState,
      handleAuthRequired,
      requestedThreadId
    ]
  );

  const loadThreads = useCallback(
    async (options?: { preferredThreadId?: string }): Promise<InboxLoadStatus> => {
      const requestId = threadListRequestIdRef.current + 1;
      threadListRequestIdRef.current = requestId;
      setPageError(null);

      try {
        const data = await requestJson<{ data?: ThreadSummary[] }>("/api/inbox/threads");
        if (threadListRequestIdRef.current !== requestId) {
          return "stale";
        }

        const nextThreads = data.data ?? [];
        const currentActiveThreadId = activeThreadIdRef.current;
        const nextActiveThreadId = resolveInboxActiveThreadId(
          nextThreads,
          options?.preferredThreadId,
          requestedThreadId,
          currentActiveThreadId
        );
        const activeChanged = nextActiveThreadId !== currentActiveThreadId;

        setAuthRequired(false);
        applyThreads(nextThreads);

        if (activeChanged) {
          applyActiveThreadId(nextActiveThreadId);
          setReplyText("");
          clearReplyFeedback();
        }

        if (!nextActiveThreadId) {
          clearThreadDetailState({ clearReplyDraft: false, clearReplyFeedback: false });
          setLastLoadedAt(new Date().toISOString());
          return "loaded";
        }

        const detailStatus = await loadThreadDetail(nextActiveThreadId, {
          preserveCurrentDetail:
            !activeChanged && isInboxThreadDetailCurrent(threadDetailRef.current, nextActiveThreadId),
          clearVisibleDetail:
            activeChanged || !isInboxThreadDetailCurrent(threadDetailRef.current, nextActiveThreadId)
        });

        if (threadListRequestIdRef.current !== requestId) {
          return "stale";
        }
        if (detailStatus === "auth" || detailStatus === "stale") {
          return detailStatus;
        }

        setLastLoadedAt(new Date().toISOString());
        return detailStatus;
      } catch (nextError) {
        if (threadListRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        setPageError(getInboxLoadRequestMessage(nextError, "加载会话列表失败"));
        return "error";
      }
    },
    [applyActiveThreadId, applyThreads, clearReplyFeedback, clearThreadDetailState, handleAuthRequired, loadThreadDetail, requestedThreadId]
  );

  const loadSession = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<InboxLoadStatus> => {
      const requestId = sessionRequestIdRef.current + 1;
      sessionRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const [authData, classData] = await Promise.all([
          requestJson<{ user?: UserSession }>("/api/auth/me"),
          requestJson<{ data?: ClassItem[] }>("/api/classes")
        ]);

        if (sessionRequestIdRef.current !== requestId) {
          return "stale";
        }

        const nextClasses = classData.data ?? [];
        const nextClassId = resolveInboxClassId(nextClasses, classIdRef.current);

        setAuthRequired(false);
        setUser(authData.user ?? null);
        applyClasses(nextClasses);
        applyClassId(nextClassId);

        const threadStatus = await loadThreads({
          preferredThreadId: requestedThreadId || activeThreadIdRef.current
        });
        if (threadStatus === "auth" || threadStatus === "stale") {
          return threadStatus;
        }
        if (sessionRequestIdRef.current !== requestId) {
          return "stale";
        }
        return threadStatus;
      } catch (nextError) {
        if (sessionRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        setPageError(getInboxLoadRequestMessage(nextError, "加载收件箱失败"));
        return "error";
      } finally {
        if (sessionRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyClassId, applyClasses, handleAuthRequired, loadThreads, requestedThreadId]
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      setPageError(null);
      if (threadId !== activeThreadIdRef.current) {
        applyActiveThreadId(threadId);
        setReplyText("");
      }
      clearReplyFeedback();

      if (!threadId) {
        clearThreadDetailState();
        return;
      }

      await loadThreadDetail(threadId, {
        preserveCurrentDetail: isInboxThreadDetailCurrent(threadDetailRef.current, threadId),
        clearVisibleDetail: !isInboxThreadDetailCurrent(threadDetailRef.current, threadId)
      });
    },
    [applyActiveThreadId, clearReplyFeedback, clearThreadDetailState, loadThreadDetail]
  );

  const updateClassId = useCallback(
    (nextClassId: string) => {
      clearComposeFeedback();
      applyClassId(nextClassId);
    },
    [applyClassId, clearComposeFeedback]
  );

  const updateSubject = useCallback(
    (value: string) => {
      clearComposeFeedback();
      setSubject(value);
    },
    [clearComposeFeedback]
  );

  const updateContent = useCallback(
    (value: string) => {
      clearComposeFeedback();
      setContent(value);
    },
    [clearComposeFeedback]
  );

  const updateIncludeParents = useCallback(
    (value: boolean) => {
      clearComposeFeedback();
      setIncludeParents(value);
    },
    [clearComposeFeedback]
  );

  const updateReplyText = useCallback(
    (value: string) => {
      clearReplyFeedback();
      setReplyText(value);
    },
    [clearReplyFeedback]
  );

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!requestedThreadId) {
      return;
    }
    if (threads.some((thread) => thread.id === requestedThreadId) && activeThreadId !== requestedThreadId) {
      void selectThread(requestedThreadId);
    }
  }, [activeThreadId, requestedThreadId, selectThread, threads]);

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

  const hasInboxData = Boolean(user || classes.length || threads.length || threadDetail);
  const requestedThreadMatched = Boolean(requestedThreadId && activeThreadId === requestedThreadId);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setActionLoading(true);
    clearComposeFeedback();
    setPageError(null);

    try {
      const data = await requestJson<{ data?: { threadId?: string } }>("/api/inbox/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, content, classId: classIdRef.current, includeParents })
      });

      const nextThreadId = data.data?.threadId ?? "";
      setSubject("");
      setContent("");
      setIncludeParents(false);

      const refreshStatus = await loadThreads({ preferredThreadId: nextThreadId });
      if (refreshStatus === "auth") {
        return;
      }

      if (refreshStatus === "error") {
        setComposeMessage("消息已发送，但会话列表刷新失败，请稍后重试。");
      } else if (refreshStatus === "stale") {
        setComposeMessage("消息已发送，收件箱正在同步最新内容。");
      } else {
        setComposeMessage("消息已发送");
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        if (isMissingInboxClassError(nextError)) {
          const nextClasses = classesRef.current.filter((item) => item.id !== classIdRef.current);
          applyClasses(nextClasses);
          applyClassId(resolveInboxClassId(nextClasses, ""));
        }
        setComposeError(getInboxCreateRequestMessage(nextError, "发送失败"));
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    const replyingThreadId = activeThreadIdRef.current;
    if (!replyingThreadId) return;

    setActionLoading(true);
    clearReplyFeedback();
    setPageError(null);

    try {
      await requestJson(`/api/inbox/threads/${replyingThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText })
      });

      setReplyText("");

      const refreshStatus = await loadThreads({ preferredThreadId: replyingThreadId });
      if (refreshStatus === "auth") {
        return;
      }

      if (refreshStatus === "error") {
        setReplyMessage("回复已发送，但会话刷新失败，请稍后重试。");
      } else if (refreshStatus === "stale") {
        setReplyMessage("回复已发送，收件箱正在同步最新内容。");
      } else {
        setReplyMessage("回复已发送");
      }
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        const nextErrorMessage = getInboxReplyRequestMessage(nextError, "发送失败");

        if (isMissingInboxThreadError(nextError)) {
          const refreshStatus = await loadThreads();
          if (refreshStatus === "auth") {
            return;
          }
          setPageError(nextErrorMessage);
        } else {
          setReplyError(nextErrorMessage);
        }
      }
    } finally {
      setActionLoading(false);
    }
  }

  const refreshInbox = useCallback(async () => {
    await loadSession("refresh");
  }, [loadSession]);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setUnreadOnly(false);
  }, []);

  return {
    user,
    classes,
    classId,
    threads,
    activeThreadId,
    threadDetail,
    subject,
    content,
    replyText,
    includeParents,
    composeMessage,
    composeError,
    replyMessage,
    replyError,
    pageError,
    loading,
    refreshing,
    detailLoading,
    actionLoading,
    authRequired,
    keyword,
    unreadOnly,
    lastLoadedAt,
    requestedThreadMatched,
    activeThread,
    currentClass,
    unreadCount,
    filteredThreads,
    hasInboxData,
    setClassId: updateClassId,
    selectThread,
    setSubject: updateSubject,
    setContent: updateContent,
    setReplyText: updateReplyText,
    setIncludeParents: updateIncludeParents,
    setKeyword,
    toggleUnreadOnly: () => setUnreadOnly((prev) => !prev),
    handleCreate,
    handleReply,
    refreshInbox,
    clearFilters
  };
}
