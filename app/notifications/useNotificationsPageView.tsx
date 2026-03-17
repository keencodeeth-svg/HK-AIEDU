"use client";

import type { ComponentProps } from "react";
import NotificationsFiltersCard from "./_components/NotificationsFiltersCard";
import NotificationsHeader from "./_components/NotificationsHeader";
import NotificationsListCard from "./_components/NotificationsListCard";
import NotificationsOverviewCard from "./_components/NotificationsOverviewCard";
import { useNotificationsPage } from "./useNotificationsPage";

export function useNotificationsPageView() {
  const page = useNotificationsPage();

  const headerProps: ComponentProps<typeof NotificationsHeader> = {
    unreadCount: page.unreadCount,
    totalCount: page.list.length,
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    disabled: page.actingKey !== null,
    onRefresh: () => {
      void page.refreshNotifications();
    }
  };

  const overviewProps: ComponentProps<typeof NotificationsOverviewCard> = {
    totalCount: page.list.length,
    unreadCount: page.unreadCount,
    readCount: page.readCount,
    typeCount: page.typeOptions.length
  };

  const filtersProps: ComponentProps<typeof NotificationsFiltersCard> = {
    readFilter: page.readFilter,
    typeFilter: page.typeFilter,
    typeOptions: page.typeOptions,
    keyword: page.keyword,
    hasActiveFilters: page.hasActiveFilters,
    filteredCount: page.filteredList.length,
    unreadCount: page.unreadCount,
    actingKey: page.actingKey,
    onReadFilterChange: page.setReadFilter,
    onTypeFilterChange: page.updateTypeFilter,
    onKeywordChange: page.setKeyword,
    onClearFilters: page.clearFilters,
    onMarkAllRead: () => {
      void page.markAllRead();
    }
  };

  const listProps: ComponentProps<typeof NotificationsListCard> = {
    list: page.list,
    filteredList: page.filteredList,
    actingKey: page.actingKey,
    onMarkRead: (id) => {
      void page.markRead(id);
    },
    onClearFilters: page.clearFilters
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasNotifications: page.list.length > 0,
    error: page.error,
    reload: () => {
      void page.refreshNotifications();
    },
    headerProps,
    overviewProps,
    filtersProps,
    listProps
  };
}
