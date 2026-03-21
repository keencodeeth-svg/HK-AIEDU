"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ClassItem, InboxLoadStatus, ThreadDetail, ThreadSummary, UserSession } from "./types";
import {
  getInboxNoStoreRequestInit,
  getInboxLoadRequestMessage,
  isInboxThreadDetailCurrent,
  isMissingInboxThreadError,
  resolveInboxActiveThreadId,
  resolveInboxClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ClearThreadDetailState = (options?: { clearReplyDraft?: boolean; clearReplyFeedback?: boolean }) => void;

type InboxLoadersOptions = {
  requestedThreadId: string;
  sessionRequestIdRef: MutableRefObject<number>;
  threadListRequestIdRef: MutableRefObject<number>;
  threadDetailRequestIdRef: MutableRefObject<number>;
  classIdRef: MutableRefObject<string>;
  activeThreadIdRef: MutableRefObject<string>;
  threadsRef: MutableRefObject<ThreadSummary[]>;
  threadDetailRef: MutableRefObject<ThreadDetail | null>;
  handleAuthRequired: () => void;
  applyClasses: (nextClasses: ClassItem[]) => void;
  applyClassId: (nextClassId: string) => void;
  applyThreads: (nextThreads: ThreadSummary[]) => void;
  applyActiveThreadId: (nextThreadId: string) => void;
  applyThreadDetail: (nextThreadDetail: ThreadDetail | null) => void;
  clearReplyFeedback: () => void;
  clearThreadDetailState: ClearThreadDetailState;
  setUser: Setter<UserSession | null>;
  setAuthRequired: Setter<boolean>;
  setReplyText: Setter<string>;
  setPageError: Setter<string | null>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setDetailLoading: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useInboxLoaders({
  requestedThreadId,
  sessionRequestIdRef,
  threadListRequestIdRef,
  threadDetailRequestIdRef,
  classIdRef,
  activeThreadIdRef,
  threadsRef,
  threadDetailRef,
  handleAuthRequired,
  applyClasses,
  applyClassId,
  applyThreads,
  applyActiveThreadId,
  applyThreadDetail,
  clearReplyFeedback,
  clearThreadDetailState,
  setUser,
  setAuthRequired,
  setReplyText,
  setPageError,
  setLoading,
  setRefreshing,
  setDetailLoading,
  setLastLoadedAt
}: InboxLoadersOptions) {
  const loadThreadDetail = useCallback(async (
    threadId: string,
    options?: { preserveCurrentDetail?: boolean; clearVisibleDetail?: boolean }
  ): Promise<InboxLoadStatus> => {
    const requestId = threadDetailRequestIdRef.current + 1;
    threadDetailRequestIdRef.current = requestId;

    if (!threadId) {
      clearThreadDetailState();
      return "empty";
    }

    const shouldPreserveCurrentDetail =
      options?.preserveCurrentDetail ?? isInboxThreadDetailCurrent(threadDetailRef.current, threadId);
    const shouldClearVisibleDetail =
      options?.clearVisibleDetail ?? !shouldPreserveCurrentDetail;

    setDetailLoading(true);
    if (shouldClearVisibleDetail) {
      applyThreadDetail(null);
    }

    try {
      const data = await requestJson<{ data?: ThreadDetail }>(`/api/inbox/threads/${threadId}`);
      if (threadDetailRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextThreadDetail = data.data ?? null;
      setAuthRequired(false);
      applyThreadDetail(nextThreadDetail);
      applyThreads(
        threadsRef.current.map((thread) =>
          thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
        )
      );
      return "loaded";
    } catch (nextError) {
      if (threadDetailRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      const nextErrorMessage = getInboxLoadRequestMessage(nextError, "加载会话详情失败");

      if (isMissingInboxThreadError(nextError)) {
        const nextThreads = threadsRef.current.filter((thread) => thread.id !== threadId);
        const nextActiveThreadId = resolveInboxActiveThreadId(
          nextThreads,
          requestedThreadId,
          activeThreadIdRef.current === threadId ? "" : activeThreadIdRef.current
        );

        applyThreads(nextThreads);
        setPageError(nextErrorMessage);

        if (!nextActiveThreadId) {
          clearThreadDetailState();
          return "error";
        }

        applyActiveThreadId(nextActiveThreadId);
        setReplyText("");
        clearReplyFeedback();
        return loadThreadDetail(nextActiveThreadId, {
          preserveCurrentDetail: false,
          clearVisibleDetail: true
        });
      }

      setPageError(nextErrorMessage);
      if (!shouldPreserveCurrentDetail) {
        applyThreadDetail(null);
      }
      return "error";
    } finally {
      if (threadDetailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, [
    activeThreadIdRef,
    applyActiveThreadId,
    applyThreadDetail,
    applyThreads,
    clearReplyFeedback,
    clearThreadDetailState,
    handleAuthRequired,
    requestedThreadId,
    setAuthRequired,
    setDetailLoading,
    setPageError,
    setReplyText,
    threadDetailRef,
    threadDetailRequestIdRef,
    threadsRef
  ]);

  const loadThreads = useCallback(async (
    options?: { preferredThreadId?: string }
  ): Promise<InboxLoadStatus> => {
    const requestId = threadListRequestIdRef.current + 1;
    threadListRequestIdRef.current = requestId;
    setPageError(null);

    try {
      const data = await requestJson<{ data?: ThreadSummary[] }>("/api/inbox/threads");
      if (threadListRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextThreads = data.data ?? [];
      const currentActiveThreadId = activeThreadIdRef.current;
      const nextActiveThreadId = resolveInboxActiveThreadId(
        nextThreads,
        options?.preferredThreadId,
        requestedThreadId,
        currentActiveThreadId
      );
      const activeChanged = nextActiveThreadId !== currentActiveThreadId;

      setAuthRequired(false);
      applyThreads(nextThreads);

      if (activeChanged) {
        applyActiveThreadId(nextActiveThreadId);
        setReplyText("");
        clearReplyFeedback();
      }

      if (!nextActiveThreadId) {
        clearThreadDetailState({ clearReplyDraft: false, clearReplyFeedback: false });
        setLastLoadedAt(new Date().toISOString());
        return "loaded";
      }

      const detailStatus = await loadThreadDetail(nextActiveThreadId, {
        preserveCurrentDetail:
          !activeChanged && isInboxThreadDetailCurrent(threadDetailRef.current, nextActiveThreadId),
        clearVisibleDetail:
          activeChanged || !isInboxThreadDetailCurrent(threadDetailRef.current, nextActiveThreadId)
      });

      if (threadListRequestIdRef.current !== requestId) {
        return "stale";
      }
      if (detailStatus === "auth" || detailStatus === "stale") {
        return detailStatus;
      }

      setLastLoadedAt(new Date().toISOString());
      return detailStatus;
    } catch (nextError) {
      if (threadListRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      setPageError(getInboxLoadRequestMessage(nextError, "加载会话列表失败"));
      return "error";
    }
  }, [
    activeThreadIdRef,
    applyActiveThreadId,
    applyThreads,
    clearReplyFeedback,
    clearThreadDetailState,
    handleAuthRequired,
    loadThreadDetail,
    requestedThreadId,
    setAuthRequired,
    setLastLoadedAt,
    setPageError,
    setReplyText,
    threadDetailRef,
    threadListRequestIdRef
  ]);

  const loadSession = useCallback(async (
    mode: "initial" | "refresh" = "initial"
  ): Promise<InboxLoadStatus> => {
    const requestId = sessionRequestIdRef.current + 1;
    sessionRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const noStoreRequestInit = getInboxNoStoreRequestInit();
      const [authData, classData] = await Promise.all([
        requestJson<{ user?: UserSession }>("/api/auth/me", noStoreRequestInit),
        requestJson<{ data?: ClassItem[] }>("/api/classes", noStoreRequestInit)
      ]);

      if (sessionRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextClasses = classData.data ?? [];
      const nextClassId = resolveInboxClassId(nextClasses, classIdRef.current);

      setAuthRequired(false);
      setUser(authData.user ?? null);
      applyClasses(nextClasses);
      applyClassId(nextClassId);

      const threadStatus = await loadThreads({
        preferredThreadId: requestedThreadId || activeThreadIdRef.current
      });
      if (threadStatus === "auth" || threadStatus === "stale") {
        return threadStatus;
      }
      if (sessionRequestIdRef.current !== requestId) {
        return "stale";
      }
      return threadStatus;
    } catch (nextError) {
      if (sessionRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      setPageError(getInboxLoadRequestMessage(nextError, "加载收件箱失败"));
      return "error";
    } finally {
      if (sessionRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    activeThreadIdRef,
    applyClassId,
    applyClasses,
    classIdRef,
    handleAuthRequired,
    loadThreads,
    requestedThreadId,
    sessionRequestIdRef,
    setAuthRequired,
    setLoading,
    setPageError,
    setRefreshing,
    setUser
  ]);

  return {
    loadThreadDetail,
    loadThreads,
    loadSession
  };
}
