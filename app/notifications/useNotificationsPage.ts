"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  NotificationItem,
  ReadFilter
} from "./types";
import {
  filterNotifications,
  getNotificationCounts,
  getNotificationTypeOptions,
  hasActiveNotificationFilters
} from "./utils";
import { useNotificationsActions } from "./useNotificationsActions";
import { useNotificationsLoaders } from "./useNotificationsLoaders";

export function useNotificationsPage() {
  const loadRequestIdRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const hasNotificationsSnapshotRef = useRef(false);
  const typeFilterRef = useRef("all");
  const actingKeyRef = useRef<string | null>(null);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const applyActingKey = useCallback((nextActingKey: string | null) => {
    actingKeyRef.current = nextActingKey;
    setActingKey(nextActingKey);
  }, []);

  const clearNotificationsState = useCallback(() => {
    hasNotificationsSnapshotRef.current = false;
    setList([]);
    setError(null);
    applyActingKey(null);
    setLastLoadedAt(null);
  }, [applyActingKey]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    actionRequestIdRef.current += 1;
    clearNotificationsState();
    setLoading(false);
    setRefreshing(false);
    setAuthRequired(true);
  }, [clearNotificationsState]);

  const {
    loadNotifications,
    refreshNotifications
  } = useNotificationsLoaders({
    loadRequestIdRef,
    hasNotificationsSnapshotRef,
    typeFilterRef,
    clearNotificationsState,
    handleAuthRequired,
    setList,
    setLoading,
    setRefreshing,
    setError,
    setAuthRequired,
    setTypeFilter,
    setLastLoadedAt
  });

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const {
    unreadCount,
    readCount
  } = useMemo(() => getNotificationCounts(list), [list]);
  const typeOptions = useMemo(() => getNotificationTypeOptions(list), [list]);
  const hasActiveFilters = useMemo(
    () => hasActiveNotificationFilters(readFilter, typeFilter, keyword),
    [keyword, readFilter, typeFilter]
  );
  const filteredList = useMemo(
    () => filterNotifications(list, readFilter, typeFilter, keyword),
    [keyword, list, readFilter, typeFilter]
  );

  const {
    markRead,
    markAllRead
  } = useNotificationsActions({
    list,
    loadRequestIdRef,
    actionRequestIdRef,
    hasNotificationsSnapshotRef,
    actingKeyRef,
    applyActingKey,
    handleAuthRequired,
    loadNotifications: () => loadNotifications("refresh"),
    setList,
    setError,
    setAuthRequired,
    setLastLoadedAt
  });

  const clearFilters = useCallback(() => {
    setReadFilter("all");
    typeFilterRef.current = "all";
    setTypeFilter("all");
    setKeyword("");
  }, []);

  const updateTypeFilter = useCallback((value: string) => {
    typeFilterRef.current = value;
    setTypeFilter(value);
  }, []);

  return {
    list,
    loading,
    refreshing,
    error,
    authRequired,
    actingKey,
    readFilter,
    typeFilter,
    keyword,
    lastLoadedAt,
    unreadCount,
    readCount,
    typeOptions,
    hasActiveFilters,
    filteredList,
    setReadFilter,
    updateTypeFilter,
    setKeyword,
    clearFilters,
    markRead,
    markAllRead,
    refreshNotifications
  };
}
