"use client";

import type { ComponentProps } from "react";
import DiscussionsComposerCard from "./_components/DiscussionsComposerCard";
import DiscussionsDetailCard from "./_components/DiscussionsDetailCard";
import DiscussionsFiltersCard from "./_components/DiscussionsFiltersCard";
import DiscussionsHeader from "./_components/DiscussionsHeader";
import DiscussionsOverviewCard from "./_components/DiscussionsOverviewCard";
import DiscussionsTopicListCard from "./_components/DiscussionsTopicListCard";
import { useDiscussionsPage } from "./useDiscussionsPage";

export function useDiscussionsPageView() {
  const page = useDiscussionsPage();

  const headerProps: ComponentProps<typeof DiscussionsHeader> = {
    classCount: page.classes.length,
    topicsCount: page.topics.length,
    pinnedTopicCount: page.pinnedTopicCount,
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    disabled: page.refreshing || page.listLoading || page.detailLoading || page.creating || page.replySubmitting,
    onRefresh: () => {
      void page.refreshSession();
    }
  };

  const overviewProps: ComponentProps<typeof DiscussionsOverviewCard> = {
    stageCopy: page.stageCopy,
    currentClass: page.currentClass,
    role: page.user?.role,
    topicsCount: page.topics.length,
    pinnedTopicCount: page.pinnedTopicCount,
    activeTopic: page.activeTopic,
    repliesCount: page.replies.length
  };

  const filtersProps: ComponentProps<typeof DiscussionsFiltersCard> = {
    classes: page.classes,
    classId: page.classId,
    keyword: page.keyword,
    pinnedOnly: page.pinnedOnly,
    filteredTopicCount: page.filteredTopics.length,
    totalTopicCount: page.topics.length,
    teacherMode: page.teacherMode,
    hasTopicFilters: page.hasTopicFilters,
    onClassChange: (nextClassId) => {
      void page.handleClassChange(nextClassId);
    },
    onKeywordChange: page.setKeyword,
    onTogglePinnedOnly: () => page.setPinnedOnly((prev) => !prev),
    onClearFilters: page.clearTopicFilters
  };

  const composerProps: ComponentProps<typeof DiscussionsComposerCard> = {
    classes: page.classes,
    classId: page.classId,
    title: page.title,
    content: page.content,
    pinned: page.pinned,
    creating: page.creating,
    onSubmit: page.handleCreate,
    onTitleChange: page.setTitle,
    onContentChange: page.setContent,
    onPinnedChange: page.setPinned
  };

  const topicListProps: ComponentProps<typeof DiscussionsTopicListCard> = {
    listLoading: page.listLoading,
    hasClasses: page.classes.length > 0,
    filteredTopics: page.filteredTopics,
    totalTopicCount: page.topics.length,
    activeTopicId: page.activeTopicId,
    hasTopicFilters: page.hasTopicFilters,
    teacherMode: page.teacherMode,
    onSelectTopic: (topicId) => {
      void page.handleSelectTopic(topicId);
    },
    onClearFilters: page.clearTopicFilters
  };

  const detailProps: ComponentProps<typeof DiscussionsDetailCard> = {
    detailLoading: page.detailLoading,
    activeTopic: page.activeTopic,
    replies: page.replies,
    currentClass: page.currentClass,
    currentUser: page.user,
    teacherMode: page.teacherMode,
    replyText: page.replyText,
    replySubmitting: page.replySubmitting,
    replyInputRef: page.replyInputRef,
    onReplyTextChange: page.setReplyText,
    onReplySubmit: page.handleReply,
    onFocusReply: () => page.replyInputRef.current?.focus()
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasDiscussionData: page.hasDiscussionData,
    teacherMode: page.teacherMode,
    classes: page.classes,
    pageError: page.pageError,
    actionError: page.actionError,
    actionMessage: page.actionMessage,
    detailSectionRef: page.detailSectionRef,
    headerProps,
    overviewProps,
    filtersProps,
    composerProps,
    topicListProps,
    detailProps,
    reload: () => {
      void page.refreshSession();
    }
  };
}
