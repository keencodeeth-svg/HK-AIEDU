"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  NotificationItem,
  NotificationLoadMode,
  NotificationLoadStatus,
  NotificationsResponse
} from "./types";
import {
  getNotificationsRequestMessage,
  resolveNotificationsTypeFilter
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type NotificationsLoadersOptions = {
  loadRequestIdRef: MutableRefObject<number>;
  hasNotificationsSnapshotRef: MutableRefObject<boolean>;
  typeFilterRef: MutableRefObject<string>;
  clearNotificationsState: () => void;
  handleAuthRequired: () => void;
  setList: Setter<NotificationItem[]>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setTypeFilter: Setter<string>;
  setLastLoadedAt: Setter<string | null>;
};

export function useNotificationsLoaders({
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
}: NotificationsLoadersOptions) {
  const loadNotifications = useCallback(
    async (mode: NotificationLoadMode = "initial"): Promise<NotificationLoadStatus> => {
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
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) {
          return "stale";
        }

        if (isAuthError(error)) {
          handleAuthRequired();
          return "auth";
        }

        if (!hasNotificationsSnapshotRef.current) {
          clearNotificationsState();
        }
        setAuthRequired(false);
        setError(getNotificationsRequestMessage(error, "加载失败"));
        return "error";
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      clearNotificationsState,
      handleAuthRequired,
      hasNotificationsSnapshotRef,
      loadRequestIdRef,
      setAuthRequired,
      setError,
      setLastLoadedAt,
      setList,
      setLoading,
      setRefreshing,
      setTypeFilter,
      typeFilterRef
    ]
  );

  const refreshNotifications = useCallback(async () => {
    await loadNotifications("refresh");
  }, [loadNotifications]);

  return {
    loadNotifications,
    refreshNotifications
  };
}
