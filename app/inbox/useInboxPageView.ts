"use client";

import type { ComponentProps } from "react";
import InboxComposerCard from "./_components/InboxComposerCard";
import InboxHeader from "./_components/InboxHeader";
import InboxOverviewCard from "./_components/InboxOverviewCard";
import InboxThreadDetailCard from "./_components/InboxThreadDetailCard";
import InboxThreadsCard from "./_components/InboxThreadsCard";
import { useInboxPage } from "./useInboxPage";

export function useInboxPageView() {
  const page = useInboxPage();

  const headerProps: ComponentProps<typeof InboxHeader> = {
    threadsCount: page.threads.length,
    unreadCount: page.unreadCount,
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    disabled: page.refreshing || page.actionLoading || page.detailLoading,
    onRefresh: () => {
      void page.refreshInbox();
    }
  };

  const overviewProps: ComponentProps<typeof InboxOverviewCard> = {
    threadsCount: page.threads.length,
    unreadCount: page.unreadCount,
    activeThreadSubject: page.activeThread?.subject ?? null,
    classesCount: page.classes.length
  };

  const composerProps: ComponentProps<typeof InboxComposerCard> = {
    role: page.user?.role ?? null,
    classes: page.classes,
    classId: page.classId,
    subject: page.subject,
    content: page.content,
    includeParents: page.includeParents,
    currentClass: page.currentClass,
    message: page.composeMessage,
    error: page.composeError,
    actionLoading: page.actionLoading,
    onClassChange: page.setClassId,
    onSubjectChange: page.setSubject,
    onContentChange: page.setContent,
    onIncludeParentsChange: page.setIncludeParents,
    onSubmit: page.handleCreate
  };

  const threadsCardProps: ComponentProps<typeof InboxThreadsCard> = {
    keyword: page.keyword,
    unreadOnly: page.unreadOnly,
    filteredThreads: page.filteredThreads,
    threadsCount: page.threads.length,
    unreadCount: page.unreadCount,
    activeThreadId: page.activeThreadId,
    onKeywordChange: page.setKeyword,
    onToggleUnreadOnly: page.toggleUnreadOnly,
    onClearFilters: page.clearFilters,
    onSelectThread: (threadId) => {
      void page.selectThread(threadId);
    }
  };

  const detailCardProps: ComponentProps<typeof InboxThreadDetailCard> = {
    detailLoading: page.detailLoading,
    threadDetail: page.threadDetail,
    activeUnreadCount: page.activeThread?.unreadCount ?? 0,
    currentUserId: page.user?.id ?? null,
    replyText: page.replyText,
    message: page.replyMessage,
    error: page.replyError,
    actionLoading: page.actionLoading,
    onReplyTextChange: page.setReplyText,
    onSubmitReply: page.handleReply
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    pageError: page.pageError,
    hasInboxData: page.hasInboxData,
    requestedThreadMatched: page.requestedThreadMatched,
    reloadInbox: () => {
      void page.refreshInbox();
    },
    headerProps,
    overviewProps,
    composerProps,
    threadsCardProps,
    detailCardProps
  };
}
