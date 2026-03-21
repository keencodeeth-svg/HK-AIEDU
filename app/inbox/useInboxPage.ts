"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useInboxActions } from "./useInboxActions";
import { useInboxLoaders } from "./useInboxLoaders";
import { useInboxPageState } from "./useInboxPageState";

export function useInboxPage() {
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("threadId")?.trim() ?? "";
  const pageState = useInboxPageState(requestedThreadId);

  const { loadThreadDetail, loadThreads, loadSession } = useInboxLoaders({
    requestedThreadId,
    sessionRequestIdRef: pageState.sessionRequestIdRef,
    threadListRequestIdRef: pageState.threadListRequestIdRef,
    threadDetailRequestIdRef: pageState.threadDetailRequestIdRef,
    classIdRef: pageState.classIdRef,
    activeThreadIdRef: pageState.activeThreadIdRef,
    threadsRef: pageState.threadsRef,
    threadDetailRef: pageState.threadDetailRef,
    handleAuthRequired: pageState.handleAuthRequired,
    applyClasses: pageState.applyClasses,
    applyClassId: pageState.applyClassId,
    applyThreads: pageState.applyThreads,
    applyActiveThreadId: pageState.applyActiveThreadId,
    applyThreadDetail: pageState.applyThreadDetail,
    clearReplyFeedback: pageState.clearReplyFeedback,
    clearThreadDetailState: pageState.clearThreadDetailState,
    setUser: pageState.setUser,
    setAuthRequired: pageState.setAuthRequired,
    setReplyText: pageState.setReplyTextState,
    setPageError: pageState.setPageError,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setDetailLoading: pageState.setDetailLoading,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  const { selectThread, handleCreate, handleReply } = useInboxActions({
    subject: pageState.subject,
    content: pageState.content,
    replyText: pageState.replyText,
    includeParents: pageState.includeParents,
    classesRef: pageState.classesRef,
    classIdRef: pageState.classIdRef,
    activeThreadIdRef: pageState.activeThreadIdRef,
    threadDetailRef: pageState.threadDetailRef,
    handleAuthRequired: pageState.handleAuthRequired,
    clearComposeFeedback: pageState.clearComposeFeedback,
    clearReplyFeedback: pageState.clearReplyFeedback,
    applyClasses: pageState.applyClasses,
    applyClassId: pageState.applyClassId,
    applyActiveThreadId: pageState.applyActiveThreadId,
    clearThreadDetailState: pageState.clearThreadDetailState,
    loadThreadDetail,
    loadThreads,
    setAuthRequired: pageState.setAuthRequired,
    setSubject: pageState.setSubjectState,
    setContent: pageState.setContentState,
    setReplyText: pageState.setReplyTextState,
    setIncludeParents: pageState.setIncludeParentsState,
    setComposeMessage: pageState.setComposeMessage,
    setComposeError: pageState.setComposeError,
    setReplyMessage: pageState.setReplyMessage,
    setReplyError: pageState.setReplyError,
    setPageError: pageState.setPageError,
    setActionLoading: pageState.setActionLoading
  });

  useEffect(() => {
    if (pageState.didInitRef.current) return;
    pageState.didInitRef.current = true;
    void loadSession();
  }, [loadSession, pageState.didInitRef]);

  useEffect(() => {
    if (!requestedThreadId) {
      return;
    }
    if (
      pageState.threads.some((thread) => thread.id === requestedThreadId) &&
      pageState.activeThreadId !== requestedThreadId
    ) {
      void selectThread(requestedThreadId);
    }
  }, [pageState.activeThreadId, pageState.threads, requestedThreadId, selectThread]);

  const refreshInbox = useCallback(async () => {
    await loadSession("refresh");
  }, [loadSession]);

  return {
    user: pageState.user,
    classes: pageState.classes,
    classId: pageState.classId,
    threads: pageState.threads,
    activeThreadId: pageState.activeThreadId,
    threadDetail: pageState.threadDetail,
    subject: pageState.subject,
    content: pageState.content,
    replyText: pageState.replyText,
    includeParents: pageState.includeParents,
    composeMessage: pageState.composeMessage,
    composeError: pageState.composeError,
    replyMessage: pageState.replyMessage,
    replyError: pageState.replyError,
    pageError: pageState.pageError,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    detailLoading: pageState.detailLoading,
    actionLoading: pageState.actionLoading,
    authRequired: pageState.authRequired,
    keyword: pageState.keyword,
    unreadOnly: pageState.unreadOnly,
    lastLoadedAt: pageState.lastLoadedAt,
    requestedThreadMatched: pageState.requestedThreadMatched,
    activeThread: pageState.activeThread,
    currentClass: pageState.currentClass,
    unreadCount: pageState.unreadCount,
    filteredThreads: pageState.filteredThreads,
    hasInboxData: pageState.hasInboxData,
    setClassId: pageState.setClassId,
    selectThread,
    setSubject: pageState.setSubject,
    setContent: pageState.setContent,
    setReplyText: pageState.setReplyText,
    setIncludeParents: pageState.setIncludeParents,
    setKeyword: pageState.setKeyword,
    toggleUnreadOnly: pageState.toggleUnreadOnly,
    handleCreate,
    handleReply,
    refreshInbox,
    clearFilters: pageState.clearFilters
  };
}
