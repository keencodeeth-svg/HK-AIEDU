"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ClassItem,
  CurrentUser,
  Reply,
  Topic
} from "./types";
import { getDiscussionsDerivedState } from "./utils";

export function useDiscussionsPageState() {
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
  const [title, setTitleState] = useState("");
  const [content, setContentState] = useState("");
  const [pinned, setPinnedState] = useState(false);
  const [replyText, setReplyTextState] = useState("");
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
        setReplyTextState("");
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

  const handleAuthRequired = useCallback(() => {
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

  const derivedState = useMemo(
    () =>
      getDiscussionsDerivedState({
        user,
        classes,
        classId,
        topics,
        activeTopic,
        keyword,
        pinnedOnly,
        loading
      }),
    [activeTopic, classId, classes, keyword, loading, pinnedOnly, topics, user]
  );

  const setTitle = useCallback(
    (value: string) => {
      clearActionNotices();
      setTitleState(value);
    },
    [clearActionNotices]
  );

  const setContent = useCallback(
    (value: string) => {
      clearActionNotices();
      setContentState(value);
    },
    [clearActionNotices]
  );

  const setPinned = useCallback(
    (value: boolean) => {
      clearActionNotices();
      setPinnedState(value);
    },
    [clearActionNotices]
  );

  const setReplyText = useCallback(
    (value: string) => {
      clearActionNotices();
      setReplyTextState(value);
    },
    [clearActionNotices]
  );

  return {
    detailSectionRef,
    replyInputRef,
    initialLoadRef,
    sessionRequestIdRef,
    topicListRequestIdRef,
    topicDetailRequestIdRef,
    classesRef,
    classIdRef,
    topicsRef,
    activeTopicIdRef,
    activeTopicRef,
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
    setUser,
    setAuthRequired,
    setKeyword,
    setPinnedOnly,
    setPageError,
    setActionError,
    setActionMessage,
    setLoading,
    setRefreshing,
    setListLoading,
    setDetailLoading,
    setCreating,
    setReplySubmitting,
    setLastLoadedAt,
    setTitleState,
    setContentState,
    setPinnedState,
    setReplyTextState,
    applyClasses,
    applyClassId,
    applyTopics,
    applyActiveTopicId,
    applyActiveTopic,
    applyReplies,
    clearActionNotices,
    clearTopicFilters,
    clearTopicDetailState,
    clearDiscussionData,
    handleAuthRequired,
    scrollDetailIntoView,
    setTitle,
    setContent,
    setPinned,
    setReplyText,
    ...derivedState
  };
}
