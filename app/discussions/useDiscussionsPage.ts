"use client";

import { useCallback, useEffect } from "react";
import { useDiscussionsActions } from "./useDiscussionsActions";
import { useDiscussionsLoaders } from "./useDiscussionsLoaders";
import { useDiscussionsPageState } from "./useDiscussionsPageState";

export function useDiscussionsPage() {
  const pageState = useDiscussionsPageState();

  const { loadTopicDetail, loadTopicsForClass, loadSession } = useDiscussionsLoaders({
    sessionRequestIdRef: pageState.sessionRequestIdRef,
    topicListRequestIdRef: pageState.topicListRequestIdRef,
    topicDetailRequestIdRef: pageState.topicDetailRequestIdRef,
    classIdRef: pageState.classIdRef,
    topicsRef: pageState.topicsRef,
    activeTopicIdRef: pageState.activeTopicIdRef,
    activeTopicRef: pageState.activeTopicRef,
    handleAuthRequired: pageState.handleAuthRequired,
    applyClasses: pageState.applyClasses,
    applyClassId: pageState.applyClassId,
    applyTopics: pageState.applyTopics,
    applyActiveTopicId: pageState.applyActiveTopicId,
    applyActiveTopic: pageState.applyActiveTopic,
    applyReplies: pageState.applyReplies,
    clearTopicDetailState: pageState.clearTopicDetailState,
    setUser: pageState.setUser,
    setAuthRequired: pageState.setAuthRequired,
    setReplyText: pageState.setReplyTextState,
    setPageError: pageState.setPageError,
    setActionError: pageState.setActionError,
    setLoading: pageState.setLoading,
    setRefreshing: pageState.setRefreshing,
    setListLoading: pageState.setListLoading,
    setDetailLoading: pageState.setDetailLoading,
    setLastLoadedAt: pageState.setLastLoadedAt
  });

  useEffect(() => {
    if (pageState.initialLoadRef.current) {
      return;
    }
    pageState.initialLoadRef.current = true;
    void loadSession("initial");
  }, [loadSession, pageState.initialLoadRef]);

  const {
    handleCreate,
    handleReply,
    handleClassChange,
    handleSelectTopic
  } = useDiscussionsActions({
    title: pageState.title,
    content: pageState.content,
    pinned: pageState.pinned,
    replyText: pageState.replyText,
    classesRef: pageState.classesRef,
    classIdRef: pageState.classIdRef,
    activeTopicIdRef: pageState.activeTopicIdRef,
    activeTopicRef: pageState.activeTopicRef,
    handleAuthRequired: pageState.handleAuthRequired,
    clearActionNotices: pageState.clearActionNotices,
    scrollDetailIntoView: pageState.scrollDetailIntoView,
    loadTopicDetail,
    loadTopicsForClass,
    applyClasses: pageState.applyClasses,
    applyClassId: pageState.applyClassId,
    applyTopics: pageState.applyTopics,
    applyActiveTopicId: pageState.applyActiveTopicId,
    clearTopicDetailState: pageState.clearTopicDetailState,
    setAuthRequired: pageState.setAuthRequired,
    setTitle: pageState.setTitleState,
    setContent: pageState.setContentState,
    setPinned: pageState.setPinnedState,
    setReplyText: pageState.setReplyTextState,
    setPageError: pageState.setPageError,
    setActionError: pageState.setActionError,
    setActionMessage: pageState.setActionMessage,
    setCreating: pageState.setCreating,
    setReplySubmitting: pageState.setReplySubmitting
  });

  const refreshSession = useCallback(async () => {
    await loadSession("refresh");
  }, [loadSession]);

  return {
    detailSectionRef: pageState.detailSectionRef,
    replyInputRef: pageState.replyInputRef,
    user: pageState.user,
    authRequired: pageState.authRequired,
    classes: pageState.classes,
    classId: pageState.classId,
    topics: pageState.topics,
    activeTopicId: pageState.activeTopicId,
    activeTopic: pageState.activeTopic,
    replies: pageState.replies,
    keyword: pageState.keyword,
    pinnedOnly: pageState.pinnedOnly,
    title: pageState.title,
    content: pageState.content,
    pinned: pageState.pinned,
    replyText: pageState.replyText,
    pageError: pageState.pageError,
    actionError: pageState.actionError,
    actionMessage: pageState.actionMessage,
    loading: pageState.loading,
    refreshing: pageState.refreshing,
    listLoading: pageState.listLoading,
    detailLoading: pageState.detailLoading,
    creating: pageState.creating,
    replySubmitting: pageState.replySubmitting,
    lastLoadedAt: pageState.lastLoadedAt,
    teacherMode: pageState.teacherMode,
    currentClass: pageState.currentClass,
    pinnedTopicCount: pageState.pinnedTopicCount,
    filteredTopics: pageState.filteredTopics,
    hasTopicFilters: pageState.hasTopicFilters,
    stageCopy: pageState.stageCopy,
    hasDiscussionData: pageState.hasDiscussionData,
    setKeyword: pageState.setKeyword,
    setPinnedOnly: pageState.setPinnedOnly,
    setTitle: pageState.setTitle,
    setContent: pageState.setContent,
    setPinned: pageState.setPinned,
    setReplyText: pageState.setReplyText,
    clearTopicFilters: pageState.clearTopicFilters,
    scrollDetailIntoView: pageState.scrollDetailIntoView,
    loadSession,
    refreshSession,
    handleCreate,
    handleReply,
    handleClassChange,
    handleSelectTopic
  };
}
