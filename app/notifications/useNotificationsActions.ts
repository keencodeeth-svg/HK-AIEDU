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
  NotificationLoadStatus,
  NotificationMutationResponse
} from "./types";
import {
  getNotificationActionRequestMessage,
  isMissingNotificationError,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type NotificationsActionsOptions = {
  list: NotificationItem[];
  loadRequestIdRef: MutableRefObject<number>;
  actionRequestIdRef: MutableRefObject<number>;
  hasNotificationsSnapshotRef: MutableRefObject<boolean>;
  actingKeyRef: MutableRefObject<string | null>;
  applyActingKey: (nextActingKey: string | null) => void;
  handleAuthRequired: () => void;
  loadNotifications: () => Promise<NotificationLoadStatus>;
  setList: Setter<NotificationItem[]>;
  setError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useNotificationsActions({
  list,
  loadRequestIdRef,
  actionRequestIdRef,
  hasNotificationsSnapshotRef,
  actingKeyRef,
  applyActingKey,
  handleAuthRequired,
  loadNotifications,
  setList,
  setError,
  setAuthRequired,
  setLastLoadedAt
}: NotificationsActionsOptions) {
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

        const readAt = data.data?.readAt ?? new Date().toISOString();
        hasNotificationsSnapshotRef.current = true;
        setAuthRequired(false);
        setList((prev) => markNotificationAsRead(prev, id, readAt));
        setLastLoadedAt(new Date().toISOString());
      } catch (error) {
        if (requestId !== actionRequestIdRef.current || activeLoadRequestId !== loadRequestIdRef.current) {
          return;
        }

        if (isAuthError(error)) {
          handleAuthRequired();
        } else if (isMissingNotificationError(error)) {
          await loadNotifications();
        } else {
          setAuthRequired(false);
          setError(getNotificationActionRequestMessage(error, "操作失败"));
        }
      } finally {
        if (requestId === actionRequestIdRef.current) {
          applyActingKey(null);
        }
      }
    },
    [
      actingKeyRef,
      actionRequestIdRef,
      applyActingKey,
      handleAuthRequired,
      hasNotificationsSnapshotRef,
      loadNotifications,
      loadRequestIdRef,
      setAuthRequired,
      setError,
      setLastLoadedAt,
      setList
    ]
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

        const refreshStatus = await loadNotifications();
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
      setList((prev) => markAllNotificationsAsRead(prev, readAt));
      setLastLoadedAt(readAt);
    } catch (error) {
      if (requestId !== actionRequestIdRef.current || activeLoadRequestId !== loadRequestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setError(getNotificationActionRequestMessage(error, "批量操作失败"));
      }
    } finally {
      if (requestId === actionRequestIdRef.current) {
        applyActingKey(null);
      }
    }
  }, [
    actingKeyRef,
    actionRequestIdRef,
    applyActingKey,
    handleAuthRequired,
    hasNotificationsSnapshotRef,
    list,
    loadNotifications,
    loadRequestIdRef,
    setAuthRequired,
    setError,
    setLastLoadedAt,
    setList
  ]);

  return {
    markRead,
    markAllRead
  };
}
