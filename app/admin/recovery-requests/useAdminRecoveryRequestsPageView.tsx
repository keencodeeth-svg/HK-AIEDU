"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import { AdminRecoveryRequestsDetailCard } from "./_components/AdminRecoveryRequestsDetailCard";
import { AdminRecoveryRequestsListCard } from "./_components/AdminRecoveryRequestsListCard";
import { AdminRecoveryRequestsServiceCard } from "./_components/AdminRecoveryRequestsServiceCard";
import { useAdminRecoveryRequestsPage } from "./useAdminRecoveryRequestsPage";

export function useAdminRecoveryRequestsPageView() {
  const page = useAdminRecoveryRequestsPage();

  const serviceCardProps: ComponentProps<typeof AdminRecoveryRequestsServiceCard> = {
    summary: page.summary,
    itemsCount: page.items.length
  };

  const listCardProps: ComponentProps<typeof AdminRecoveryRequestsListCard> = {
    statusFilter: page.statusFilter,
    searchInput: page.searchInput,
    appliedQuery: page.appliedQuery,
    items: page.items,
    selectedItemId: page.selectedItem?.id ?? null,
    onStatusFilterChange: page.setStatusFilter,
    onSearchInputChange: page.setSearchInput,
    onApplySearch: page.applySearch,
    onSelectItem: page.setSelectedId,
    onClearFilters: page.clearFilters
  };

  const detailCardProps: ComponentProps<typeof AdminRecoveryRequestsDetailCard> = {
    selectedItem: page.selectedItem,
    actionNote: page.actionNote,
    actionMessage: page.actionMessage,
    actionError: page.actionError,
    actingStatus: page.actingStatus,
    onActionNoteChange: page.setActionNote,
    onPerformAction: (status) => {
      void page.performAction(status);
    }
  };

  return {
    loading: page.loading,
    refreshing: page.refreshing,
    pageError: page.pageError,
    authRequired: page.authRequired,
    hasItems: page.items.length > 0,
    hasOverdueItems: (page.summary?.overdue ?? 0) > 0,
    hasPriorityQueue:
      !((page.summary?.overdue ?? 0) > 0) &&
      ((page.summary?.urgent ?? 0) > 0 || (page.summary?.highPriority ?? 0) > 0),
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    overdueCount: page.summary?.overdue ?? 0,
    urgentCount: page.summary?.urgent ?? 0,
    highPriorityCount: page.summary?.highPriority ?? 0,
    serviceCardProps,
    listCardProps,
    detailCardProps,
    reload: () => {
      void page.load("refresh");
    },
    loadInitial: () => {
      void page.load("initial");
    },
    stepUpDialog: page.stepUpDialog
  };
}
