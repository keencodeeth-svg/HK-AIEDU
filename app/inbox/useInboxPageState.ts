"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ClassItem,
  ThreadDetail,
  ThreadSummary,
  UserSession
} from "./types";
import { getInboxDerivedState } from "./utils";

export function useInboxPageState(requestedThreadId: string) {
  const didInitRef = useRef(false);
  const sessionRequestIdRef = useRef(0);
  const threadListRequestIdRef = useRef(0);
  const threadDetailRequestIdRef = useRef(0);
  const classesRef = useRef<ClassItem[]>([]);
  const threadsRef = useRef<ThreadSummary[]>([]);
  const classIdRef = useRef("");
  const activeThreadIdRef = useRef("");
  const threadDetailRef = useRef<ThreadDetail | null>(null);

  const [user, setUser] = useState<UserSession | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [subject, setSubjectState] = useState("");
  const [content, setContentState] = useState("");
  const [replyText, setReplyTextState] = useState("");
  const [includeParents, setIncludeParentsState] = useState(false);
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
        setReplyTextState("");
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
    setReplyTextState("");
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

  const derivedState = useMemo(
    () =>
      getInboxDerivedState({
        user,
        classes,
        classId,
        threads,
        activeThreadId,
        threadDetail,
        keyword,
        unreadOnly,
        requestedThreadId
      }),
    [activeThreadId, classId, classes, keyword, requestedThreadId, threadDetail, threads, unreadOnly, user]
  );

  const setClassIdWithFeedback = useCallback(
    (nextClassId: string) => {
      clearComposeFeedback();
      applyClassId(nextClassId);
    },
    [applyClassId, clearComposeFeedback]
  );

  const setSubject = useCallback(
    (value: string) => {
      clearComposeFeedback();
      setSubjectState(value);
    },
    [clearComposeFeedback]
  );

  const setContent = useCallback(
    (value: string) => {
      clearComposeFeedback();
      setContentState(value);
    },
    [clearComposeFeedback]
  );

  const setIncludeParents = useCallback(
    (value: boolean) => {
      clearComposeFeedback();
      setIncludeParentsState(value);
    },
    [clearComposeFeedback]
  );

  const setReplyText = useCallback(
    (value: string) => {
      clearReplyFeedback();
      setReplyTextState(value);
    },
    [clearReplyFeedback]
  );

  const clearFilters = useCallback(() => {
    setKeyword("");
    setUnreadOnly(false);
  }, []);

  return {
    didInitRef,
    sessionRequestIdRef,
    threadListRequestIdRef,
    threadDetailRequestIdRef,
    classesRef,
    threadsRef,
    classIdRef,
    activeThreadIdRef,
    threadDetailRef,
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
    setUser,
    setAuthRequired,
    setPageError,
    setLoading,
    setRefreshing,
    setDetailLoading,
    setActionLoading,
    setKeyword,
    setUnreadOnly,
    setLastLoadedAt,
    setSubjectState,
    setContentState,
    setReplyTextState,
    setIncludeParentsState,
    setComposeMessage,
    setComposeError,
    setReplyMessage,
    setReplyError,
    applyClasses,
    applyClassId,
    applyThreads,
    applyActiveThreadId,
    applyThreadDetail,
    clearComposeFeedback,
    clearReplyFeedback,
    clearThreadDetailState,
    clearInboxState,
    handleAuthRequired,
    setClassId: setClassIdWithFeedback,
    setSubject,
    setContent,
    setReplyText,
    setIncludeParents,
    clearFilters,
    toggleUnreadOnly: () => setUnreadOnly((prev) => !prev),
    ...derivedState
  };
}
