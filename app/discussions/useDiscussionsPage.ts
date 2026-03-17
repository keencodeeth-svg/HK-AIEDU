"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  AuthMeResponse,
  ClassItem,
  ClassesResponse,
  CurrentUser,
  Reply,
  Topic,
  TopicDetailResponse,
  TopicsResponse
} from "./types";
import {
  getDiscussionCreateRequestMessage,
  getDiscussionReplyRequestMessage,
  getDiscussionStageCopy,
  getDiscussionTopicDetailRequestMessage,
  getDiscussionTopicListRequestMessage,
  isMissingDiscussionClassError,
  isMissingDiscussionTopicError,
  resolveDiscussionsClassId,
  resolveDiscussionTopicId
} from "./utils";

type DiscussionLoadStatus = "loaded" | "auth" | "error" | "stale" | "empty";

export function useDiscussionsPage() {
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadRef = useRef(false);
  const sessionRequestIdRef = useRef(0);
  const topicListRequestIdRef = useRef(0);
  const topicDetailRequestIdRef = useRef(0);
  const classesRef = useRef<ClassItem[]>([]);
  const classIdRef = useRef("");
  const topicsRef = useRef<Topic[]>([]);
  const activeTopicIdRef = useRef("");
  const activeTopicRef = useRef<Topic | null>(null);
  const repliesRef = useRef<Reply[]>([]);

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

  const applyClasses = useCallback((nextClasses: ClassItem[]) => {
    classesRef.current = nextClasses;
    setClasses(nextClasses);
  }, []);

  const applyClassId = useCallback((nextClassId: string) => {
    classIdRef.current = nextClassId;
    setClassId(nextClassId);
  }, []);

  const applyTopics = useCallback((nextTopics: Topic[]) => {
    topicsRef.current = nextTopics;
    setTopics(nextTopics);
  }, []);

  const applyActiveTopicId = useCallback((nextTopicId: string) => {
    activeTopicIdRef.current = nextTopicId;
    setActiveTopicId(nextTopicId);
  }, []);

  const applyActiveTopic = useCallback((nextTopic: Topic | null) => {
    activeTopicRef.current = nextTopic;
    setActiveTopic(nextTopic);
  }, []);

  const applyReplies = useCallback((nextReplies: Reply[]) => {
    repliesRef.current = nextReplies;
    setReplies(nextReplies);
  }, []);

  const clearActionNotices = useCallback(() => {
    setActionError(null);
    setActionMessage(null);
  }, []);

  const scrollDetailIntoView = useCallback((focusReply = false) => {
    requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusReply) {
        replyInputRef.current?.focus();
      }
    });
  }, []);

  const clearTopicFilters = useCallback(() => {
    setKeyword("");
    setPinnedOnly(false);
  }, []);

  const clearTopicDetailState = useCallback(
    (options?: { invalidate?: boolean; clearReplyDraft?: boolean }) => {
      if (options?.invalidate !== false) {
        topicDetailRequestIdRef.current += 1;
      }
      applyActiveTopicId("");
      applyActiveTopic(null);
      applyReplies([]);
      setDetailLoading(false);
      if (options?.clearReplyDraft !== false) {
        setReplyText("");
      }
    },
    [applyActiveTopic, applyActiveTopicId, applyReplies]
  );

  const clearDiscussionData = useCallback(() => {
    setUser(null);
    applyClasses([]);
    applyClassId("");
    applyTopics([]);
    clearTopicDetailState();
    clearActionNotices();
    setPageError(null);
    setLastLoadedAt(null);
  }, [applyClassId, applyClasses, applyTopics, clearActionNotices, clearTopicDetailState]);

  const activateAuthRequired = useCallback(() => {
    sessionRequestIdRef.current += 1;
    topicListRequestIdRef.current += 1;
    topicDetailRequestIdRef.current += 1;
    clearDiscussionData();
    setLoading(false);
    setRefreshing(false);
    setListLoading(false);
    setDetailLoading(false);
    setCreating(false);
    setReplySubmitting(false);
    setAuthRequired(true);
  }, [clearDiscussionData]);

  const loadTopicDetail = useCallback(
    async function loadTopicDetail(
      topicId: string,
      options?: { showLoading?: boolean; preserveCurrentDetail?: boolean; clearVisibleDetail?: boolean }
    ): Promise<DiscussionLoadStatus> {
      const requestId = topicDetailRequestIdRef.current + 1;
      topicDetailRequestIdRef.current = requestId;

      if (!topicId) {
        clearTopicDetailState();
        return "empty";
      }

      const currentTopicMatches = activeTopicRef.current?.id === topicId;
      const shouldPreserveCurrentDetail = options?.preserveCurrentDetail ?? currentTopicMatches;
      const shouldClearVisibleDetail = options?.clearVisibleDetail ?? !shouldPreserveCurrentDetail;

      if (options?.showLoading !== false) {
        setDetailLoading(true);
      }
      if (shouldClearVisibleDetail) {
        applyActiveTopic(null);
        applyReplies([]);
      }

      try {
        const data = await requestJson<TopicDetailResponse>(`/api/discussions/${topicId}`);
        if (topicDetailRequestIdRef.current !== requestId) {
          return "stale";
        }

        setAuthRequired(false);
        applyActiveTopicId(topicId);
        applyActiveTopic(data.topic ?? null);
        applyReplies(data.replies ?? []);
        return "loaded";
      } catch (error) {
        if (topicDetailRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(error)) {
          activateAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        const nextErrorMessage = getDiscussionTopicDetailRequestMessage(error, "加载话题详情失败");

        if (isMissingDiscussionTopicError(error)) {
          const nextTopics = topicsRef.current.filter((item) => item.id !== topicId);
          const nextActiveTopicId = resolveDiscussionTopicId(
            nextTopics,
            activeTopicIdRef.current === topicId ? "" : activeTopicIdRef.current
          );

          applyTopics(nextTopics);
          setPageError(nextErrorMessage);

          if (!nextActiveTopicId) {
            clearTopicDetailState();
            return "error";
          }

          applyActiveTopicId(nextActiveTopicId);
          setReplyText("");
          return loadTopicDetail(nextActiveTopicId, {
            showLoading: false,
            preserveCurrentDetail: false,
            clearVisibleDetail: true
          });
        }

        setPageError(nextErrorMessage);
        if (!shouldPreserveCurrentDetail) {
          applyActiveTopic(null);
          applyReplies([]);
        }
        return "error";
      } finally {
        if (options?.showLoading !== false && topicDetailRequestIdRef.current === requestId) {
          setDetailLoading(false);
        }
      }
    },
    [activateAuthRequired, applyActiveTopic, applyActiveTopicId, applyReplies, applyTopics, clearTopicDetailState]
  );

  const loadTopicsForClass = useCallback(
    async (
      nextClassId: string,
      options?: { preferredTopicId?: string; showLoading?: boolean }
    ): Promise<DiscussionLoadStatus> => {
      const requestId = topicListRequestIdRef.current + 1;
      const previousClassId = classIdRef.current;
      const classChanged = nextClassId !== previousClassId;

      topicListRequestIdRef.current = requestId;
      applyClassId(nextClassId);
      setPageError(null);
      setActionError(null);

      if (!nextClassId) {
        applyTopics([]);
        clearTopicDetailState();
        setListLoading(false);
        return "empty";
      }

      if (classChanged) {
        applyTopics([]);
        clearTopicDetailState();
      }

      if (options?.showLoading !== false) {
        setListLoading(true);
        setDetailLoading(true);
      }

      try {
        const data = await requestJson<TopicsResponse>(`/api/discussions?classId=${encodeURIComponent(nextClassId)}`);
        if (topicListRequestIdRef.current !== requestId) {
          return "stale";
        }

        const nextTopics = data.data ?? [];
        const currentActiveTopicId = activeTopicIdRef.current;
        const resolvedTopicId = resolveDiscussionTopicId(
          nextTopics,
          options?.preferredTopicId,
          currentActiveTopicId
        );
        const topicChanged = resolvedTopicId !== currentActiveTopicId;

        setAuthRequired(false);
        applyTopics(nextTopics);

        if (topicChanged) {
          applyActiveTopicId(resolvedTopicId);
          setReplyText("");
        }

        if (!resolvedTopicId) {
          clearTopicDetailState({ clearReplyDraft: false });
          setLastLoadedAt(new Date().toISOString());
          return "loaded";
        }

        const detailResult = await loadTopicDetail(resolvedTopicId, {
          showLoading: false,
          preserveCurrentDetail: !topicChanged && activeTopicRef.current?.id === resolvedTopicId,
          clearVisibleDetail: topicChanged || activeTopicRef.current?.id !== resolvedTopicId
        });
        if (topicListRequestIdRef.current !== requestId) {
          return "stale";
        }
        if (detailResult === "auth" || detailResult === "stale") {
          return detailResult;
        }

        setLastLoadedAt(new Date().toISOString());
        return detailResult;
      } catch (error) {
        if (topicListRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(error)) {
          activateAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        setPageError(getDiscussionTopicListRequestMessage(error, "加载讨论话题失败"));
        if (classChanged) {
          applyTopics([]);
          clearTopicDetailState();
        }
        return "error";
      } finally {
        if (options?.showLoading !== false && topicListRequestIdRef.current === requestId) {
          setListLoading(false);
          setDetailLoading(false);
        }
      }
    },
    [activateAuthRequired, applyActiveTopicId, applyClassId, applyTopics, clearTopicDetailState, loadTopicDetail]
  );

  const loadSession = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<DiscussionLoadStatus> => {
      const requestId = sessionRequestIdRef.current + 1;
      const previousClassId = classIdRef.current;
      const previousActiveTopicId = activeTopicIdRef.current;

      sessionRequestIdRef.current = requestId;
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
        if (sessionRequestIdRef.current !== requestId) {
          return "stale";
        }

        const nextUser = meData.user ?? meData.data?.user ?? null;
        const nextClasses = classData.data ?? [];
        const nextClassId = resolveDiscussionsClassId(nextClasses, previousClassId);

        setUser(nextUser);
        setAuthRequired(false);
        applyClasses(nextClasses);
        applyClassId(nextClassId);

        if (!nextClassId) {
          applyTopics([]);
          clearTopicDetailState();
          return "empty";
        }

        const topicLoadResult = await loadTopicsForClass(nextClassId, {
          preferredTopicId: nextClassId === previousClassId ? previousActiveTopicId : undefined,
          showLoading: false
        });
        if (topicLoadResult === "auth" || topicLoadResult === "stale") {
          return topicLoadResult;
        }
        if (sessionRequestIdRef.current !== requestId) {
          return "stale";
        }

        return topicLoadResult;
      } catch (error) {
        if (sessionRequestIdRef.current !== requestId) {
          return "stale";
        }
        if (isAuthError(error)) {
          activateAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        setPageError(getDiscussionTopicListRequestMessage(error, "加载讨论区失败"));
        return "error";
      } finally {
        if (sessionRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
          setListLoading(false);
          setDetailLoading(false);
        }
      }
    },
    [activateAuthRequired, applyClassId, applyClasses, applyTopics, clearTopicDetailState, loadTopicsForClass]
  );

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }
    initialLoadRef.current = true;
    void loadSession("initial");
  }, [loadSession]);

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
  const stageCopy = getDiscussionStageCopy({
    loading,
    classesCount: classes.length,
    topicsCount: topics.length,
    activeTopic,
    teacherMode
  });
  const hasDiscussionData = Boolean(user || classes.length || topics.length || activeTopic);

  const updateTitle = useCallback(
    (value: string) => {
      clearActionNotices();
      setTitle(value);
    },
    [clearActionNotices]
  );

  const updateContent = useCallback(
    (value: string) => {
      clearActionNotices();
      setContent(value);
    },
    [clearActionNotices]
  );

  const updatePinned = useCallback(
    (value: boolean) => {
      clearActionNotices();
      setPinned(value);
    },
    [clearActionNotices]
  );

  const updateReplyText = useCallback(
    (value: string) => {
      clearActionNotices();
      setReplyText(value);
    },
    [clearActionNotices]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classIdRef.current || !title.trim() || !content.trim()) {
      setActionError("请先补全班级、标题和话题内容。");
      return;
    }

    setCreating(true);
    clearActionNotices();

    try {
      const payload = await requestJson<{ data?: Topic }>("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classIdRef.current,
          title: title.trim(),
          content: content.trim(),
          pinned
        })
      });

      const createdTopicId = payload.data?.id ?? "";
      setTitle("");
      setContent("");
      setPinned(false);

      const refreshResult = await loadTopicsForClass(classIdRef.current, {
        preferredTopicId: createdTopicId,
        showLoading: true
      });
      if (refreshResult === "auth") {
        return;
      }

      if (refreshResult === "error") {
        setActionMessage("话题已发布，但最新列表同步失败，请稍后重试。");
      } else if (refreshResult === "stale") {
        setActionMessage("话题已发布，讨论区正在同步最新内容。");
      } else {
        setActionMessage("话题已发布，并已自动打开详情，方便继续查看学生回复。");
        scrollDetailIntoView();
      }
    } catch (error) {
      if (isAuthError(error)) {
        activateAuthRequired();
      } else {
        setAuthRequired(false);
        if (isMissingDiscussionClassError(error)) {
          const nextClasses = classesRef.current.filter((item) => item.id !== classIdRef.current);
          const nextClassId = resolveDiscussionsClassId(nextClasses, "");

          applyClasses(nextClasses);
          applyClassId(nextClassId);
          if (nextClassId) {
            void loadTopicsForClass(nextClassId, { showLoading: true });
          } else {
            applyTopics([]);
            clearTopicDetailState();
          }
        }
        setActionError(getDiscussionCreateRequestMessage(error, "发布失败"));
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const replyingTopicId = activeTopicIdRef.current;
    if (!replyingTopicId || !replyText.trim()) {
      setActionError("请输入回复内容后再发送。");
      return;
    }

    setReplySubmitting(true);
    clearActionNotices();

    try {
      await requestJson(`/api/discussions/${replyingTopicId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() })
      });

      setReplyText("");
      const refreshResult = await loadTopicsForClass(classIdRef.current, {
        preferredTopicId: replyingTopicId,
        showLoading: false
      });
      if (refreshResult === "auth") {
        return;
      }

      if (refreshResult === "error") {
        setActionMessage("回复已发送，但讨论记录同步失败，请稍后重试。");
      } else if (refreshResult === "stale") {
        setActionMessage("回复已发送，讨论区正在同步最新内容。");
      } else {
        setActionMessage("回复已发送，讨论记录已经更新。");
      }
    } catch (error) {
      if (isAuthError(error)) {
        activateAuthRequired();
      } else {
        setAuthRequired(false);
        const nextErrorMessage = getDiscussionReplyRequestMessage(error, "回复失败");

        if (isMissingDiscussionTopicError(error)) {
          const refreshResult = await loadTopicsForClass(classIdRef.current, { showLoading: false });
          if (refreshResult === "auth") {
            return;
          }
          setPageError(nextErrorMessage);
        } else {
          setActionError(nextErrorMessage);
        }
      }
    } finally {
      setReplySubmitting(false);
    }
  }

  const handleClassChange = useCallback(
    async (nextClassId: string) => {
      clearActionNotices();
      await loadTopicsForClass(nextClassId, { showLoading: true });
    },
    [clearActionNotices, loadTopicsForClass]
  );

  const handleSelectTopic = useCallback(
    async (topicId: string) => {
      const topicChanged = topicId !== activeTopicIdRef.current;

      clearActionNotices();
      setPageError(null);
      if (topicChanged) {
        applyActiveTopicId(topicId);
        setReplyText("");
      }

      const result = await loadTopicDetail(topicId, {
        showLoading: true,
        preserveCurrentDetail: !topicChanged && activeTopicRef.current?.id === topicId,
        clearVisibleDetail: topicChanged || activeTopicRef.current?.id !== topicId
      });
      if (result === "loaded") {
        scrollDetailIntoView();
      }
    },
    [applyActiveTopicId, clearActionNotices, loadTopicDetail, scrollDetailIntoView]
  );

  const refreshSession = useCallback(async () => {
    await loadSession("refresh");
  }, [loadSession]);

  return {
    detailSectionRef,
    replyInputRef,
    user,
    authRequired,
    classes,
    classId,
    topics,
    activeTopicId,
    activeTopic,
    replies,
    keyword,
    pinnedOnly,
    title,
    content,
    pinned,
    replyText,
    pageError,
    actionError,
    actionMessage,
    loading,
    refreshing,
    listLoading,
    detailLoading,
    creating,
    replySubmitting,
    lastLoadedAt,
    teacherMode,
    currentClass,
    pinnedTopicCount,
    filteredTopics,
    hasTopicFilters,
    stageCopy,
    hasDiscussionData,
    setKeyword,
    setPinnedOnly,
    setTitle: updateTitle,
    setContent: updateContent,
    setPinned: updatePinned,
    setReplyText: updateReplyText,
    clearTopicFilters,
    scrollDetailIntoView,
    loadSession,
    refreshSession,
    handleCreate,
    handleReply,
    handleClassChange,
    handleSelectTopic
  };
}
