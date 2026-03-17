"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  NotificationItem,
  NotificationMutationResponse,
  NotificationsResponse,
  ReadFilter
} from "./types";
import {
  getNotificationActionRequestMessage,
  getNotificationTypeLabel,
  getNotificationsRequestMessage,
  isMissingNotificationError,
  resolveNotificationsTypeFilter
} from "./utils";

type LoadNotificationsStatus = "ok" | "auth" | "error" | "stale";

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

  const loadNotifications = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<LoadNotificationsStatus> => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      const isRefresh = mode === "refresh";

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        if (!hasNotificationsSnapshotRef.current) {
          setList([]);
        }
      }
      setError(null);

      try {
        const data = await requestJson<NotificationsResponse>("/api/notifications");
        if (requestId !== loadRequestIdRef.current) {
          return "stale";
        }

        const nextList = Array.isArray(data.data) ? data.data : [];
        const nextTypeFilter = resolveNotificationsTypeFilter(nextList, typeFilterRef.current);

        setAuthRequired(false);
        hasNotificationsSnapshotRef.current = true;
        setList(nextList);
        if (nextTypeFilter !== typeFilterRef.current) {
          typeFilterRef.current = nextTypeFilter;
          setTypeFilter(nextTypeFilter);
        }
        setLastLoadedAt(new Date().toISOString());
        return "ok";
      } catch (nextError) {
        if (requestId !== loadRequestIdRef.current) {
          return "stale";
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return "auth";
        } else {
          if (!hasNotificationsSnapshotRef.current) {
            clearNotificationsState();
          }
          setAuthRequired(false);
          setError(getNotificationsRequestMessage(nextError, "加载失败"));
          return "error";
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [clearNotificationsState, handleAuthRequired]
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => list.filter((item) => !item.readAt).length, [list]);
  const readCount = Math.max(0, list.length - unreadCount);
  const typeOptions = useMemo(() => Array.from(new Set(list.map((item) => item.type))), [list]);
  const hasActiveFilters = readFilter !== "all" || typeFilter !== "all" || keyword.trim().length > 0;

  const filteredList = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();

    return list.filter((item) => {
      if (readFilter === "unread" && item.readAt) return false;
      if (readFilter === "read" && !item.readAt) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!keywordLower) return true;

      return [item.title, item.content, getNotificationTypeLabel(item.type)]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [keyword, list, readFilter, typeFilter]);

  const markRead = useCallback(
    async (id: string) => {
      if (actingKeyRef.current) {
        return;
      }

      const requestId = actionRequestIdRef.current + 1;
      const activeLoadRequestId = loadRequestIdRef.current;
      actionRequestIdRef.current = requestId;
      applyActingKey(id);
      setError(null);

      try {
        const data = await requestJson<NotificationMutationResponse>("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        if (requestId !== actionRequestIdRef.current || activeLoadRequestId !== loadRequestIdRef.current) {
          return;
        }

        const updated = data.data;
        hasNotificationsSnapshotRef.current = true;
        setAuthRequired(false);
        setList((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  readAt: updated?.readAt ?? new Date().toISOString()
                }
              : item
          )
        );
        setLastLoadedAt(new Date().toISOString());
      } catch (nextError) {
        if (requestId !== actionRequestIdRef.current || activeLoadRequestId !== loadRequestIdRef.current) {
          return;
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
        } else if (isMissingNotificationError(nextError)) {
          await loadNotifications("refresh");
        } else {
          setAuthRequired(false);
          setError(getNotificationActionRequestMessage(nextError, "操作失败"));
        }
      } finally {
        if (requestId === actionRequestIdRef.current) {
          applyActingKey(null);
        }
      }
    },
    [applyActingKey, handleAuthRequired, loadNotifications]
  );

  const markAllRead = useCallback(async () => {
    const unreadIds = list.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length || actingKeyRef.current) {
      return;
    }

    const requestId = actionRequestIdRef.current + 1;
    const activeLoadRequestId = loadRequestIdRef.current;
    actionRequestIdRef.current = requestId;
    applyActingKey("all");
    setError(null);

    try {
      const results = await Promise.allSettled(
        unreadIds.map((id) =>
          requestJson<NotificationMutationResponse>("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          })
        )
      );

      if (requestId !== actionRequestIdRef.current || activeLoadRequestId !== loadRequestIdRef.current) {
        return;
      }

      const rejectedResults = results.filter((item): item is PromiseRejectedResult => item.status === "rejected");
      if (rejectedResults.length) {
        const authRejected = rejectedResults.find((item) => isAuthError(item.reason));
        if (authRejected) {
          handleAuthRequired();
          return;
        }

        const refreshStatus = await loadNotifications("refresh");
        if (refreshStatus === "auth" || refreshStatus === "stale") {
          return;
        }

        const firstRejected = rejectedResults[0]?.reason;
        if (refreshStatus !== "error" && firstRejected && !isMissingNotificationError(firstRejected)) {
          setError(getNotificationActionRequestMessage(firstRejected, "部分通知标记失败，请稍后再试"));
        }
        return;
      }

      const readAt = new Date().toISOString();
      hasNotificationsSnapshotRef.current = true;
      setAuthRequired(false);
      setList((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt })));
      setLastLoadedAt(readAt);
    } catch (nextError) {
      if (requestId !== actionRequestIdRef.current || activeLoadRequestId !== loadRequestIdRef.current) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setError(getNotificationActionRequestMessage(nextError, "批量操作失败"));
      }
    } finally {
      if (requestId === actionRequestIdRef.current) {
        applyActingKey(null);
      }
    }
  }, [applyActingKey, handleAuthRequired, list, loadNotifications]);

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

  const refreshNotifications = useCallback(async () => {
    await loadNotifications("refresh");
  }, [loadNotifications]);

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
