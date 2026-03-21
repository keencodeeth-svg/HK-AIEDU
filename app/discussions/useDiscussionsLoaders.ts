"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AuthMeResponse,
  ClassItem,
  ClassesResponse,
  CurrentUser,
  DiscussionLoadStatus,
  Reply,
  Topic,
  TopicDetailResponse,
  TopicsResponse
} from "./types";
import {
  getDiscussionNoStoreRequestInit,
  getDiscussionTopicDetailRequestMessage,
  getDiscussionTopicListRequestMessage,
  isMissingDiscussionTopicError,
  resolveDiscussionsClassId,
  resolveDiscussionTopicId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type TopicDetailOptions = {
  showLoading?: boolean;
  preserveCurrentDetail?: boolean;
  clearVisibleDetail?: boolean;
};

type TopicListOptions = {
  preferredTopicId?: string;
  showLoading?: boolean;
};

type ClearTopicDetailState = (options?: { invalidate?: boolean; clearReplyDraft?: boolean }) => void;

type DiscussionsLoadersOptions = {
  sessionRequestIdRef: MutableRefObject<number>;
  topicListRequestIdRef: MutableRefObject<number>;
  topicDetailRequestIdRef: MutableRefObject<number>;
  classIdRef: MutableRefObject<string>;
  topicsRef: MutableRefObject<Topic[]>;
  activeTopicIdRef: MutableRefObject<string>;
  activeTopicRef: MutableRefObject<Topic | null>;
  handleAuthRequired: () => void;
  applyClasses: (nextClasses: ClassItem[]) => void;
  applyClassId: (nextClassId: string) => void;
  applyTopics: (nextTopics: Topic[]) => void;
  applyActiveTopicId: (nextTopicId: string) => void;
  applyActiveTopic: (nextTopic: Topic | null) => void;
  applyReplies: (nextReplies: Reply[]) => void;
  clearTopicDetailState: ClearTopicDetailState;
  setUser: Setter<CurrentUser | null>;
  setAuthRequired: Setter<boolean>;
  setReplyText: Setter<string>;
  setPageError: Setter<string | null>;
  setActionError: Setter<string | null>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setListLoading: Setter<boolean>;
  setDetailLoading: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useDiscussionsLoaders({
  sessionRequestIdRef,
  topicListRequestIdRef,
  topicDetailRequestIdRef,
  classIdRef,
  topicsRef,
  activeTopicIdRef,
  activeTopicRef,
  handleAuthRequired,
  applyClasses,
  applyClassId,
  applyTopics,
  applyActiveTopicId,
  applyActiveTopic,
  applyReplies,
  clearTopicDetailState,
  setUser,
  setAuthRequired,
  setReplyText,
  setPageError,
  setActionError,
  setLoading,
  setRefreshing,
  setListLoading,
  setDetailLoading,
  setLastLoadedAt
}: DiscussionsLoadersOptions) {
  const loadTopicDetail = useCallback(async (
    topicId: string,
    options?: TopicDetailOptions
  ): Promise<DiscussionLoadStatus> => {
    const requestId = topicDetailRequestIdRef.current + 1;
    topicDetailRequestIdRef.current = requestId;

    if (!topicId) {
      clearTopicDetailState();
      return "empty";
    }

    const currentTopicMatches = activeTopicRef.current?.id === topicId;
    const shouldPreserveCurrentDetail = options?.preserveCurrentDetail ?? currentTopicMatches;
    const shouldClearVisibleDetail = options?.clearVisibleDetail ?? !shouldPreserveCurrentDetail;

    if (options?.showLoading !== false) {
      setDetailLoading(true);
    }
    if (shouldClearVisibleDetail) {
      applyActiveTopic(null);
      applyReplies([]);
    }

    try {
      const data = await requestJson<TopicDetailResponse>(`/api/discussions/${topicId}`);
      if (topicDetailRequestIdRef.current !== requestId) {
        return "stale";
      }

      setAuthRequired(false);
      applyActiveTopicId(topicId);
      applyActiveTopic(data.topic ?? null);
      applyReplies(data.replies ?? []);
      return "loaded";
    } catch (error) {
      if (topicDetailRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      const nextErrorMessage = getDiscussionTopicDetailRequestMessage(error, "加载话题详情失败");

      if (isMissingDiscussionTopicError(error)) {
        const nextTopics = topicsRef.current.filter((item) => item.id !== topicId);
        const nextActiveTopicId = resolveDiscussionTopicId(
          nextTopics,
          activeTopicIdRef.current === topicId ? "" : activeTopicIdRef.current
        );

        applyTopics(nextTopics);
        setPageError(nextErrorMessage);

        if (!nextActiveTopicId) {
          clearTopicDetailState();
          return "error";
        }

        applyActiveTopicId(nextActiveTopicId);
        setReplyText("");
        return loadTopicDetail(nextActiveTopicId, {
          showLoading: false,
          preserveCurrentDetail: false,
          clearVisibleDetail: true
        });
      }

      setPageError(nextErrorMessage);
      if (!shouldPreserveCurrentDetail) {
        applyActiveTopic(null);
        applyReplies([]);
      }
      return "error";
    } finally {
      if (options?.showLoading !== false && topicDetailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, [
    activeTopicIdRef,
    activeTopicRef,
    applyActiveTopic,
    applyActiveTopicId,
    applyReplies,
    applyTopics,
    clearTopicDetailState,
    handleAuthRequired,
    setAuthRequired,
    setDetailLoading,
    setPageError,
    setReplyText,
    topicDetailRequestIdRef,
    topicsRef
  ]);

  const loadTopicsForClass = useCallback(async (
    nextClassId: string,
    options?: TopicListOptions
  ): Promise<DiscussionLoadStatus> => {
    const requestId = topicListRequestIdRef.current + 1;
    const previousClassId = classIdRef.current;
    const classChanged = nextClassId !== previousClassId;

    topicListRequestIdRef.current = requestId;
    applyClassId(nextClassId);
    setPageError(null);
    setActionError(null);

    if (!nextClassId) {
      applyTopics([]);
      clearTopicDetailState();
      setListLoading(false);
      return "empty";
    }

    if (classChanged) {
      applyTopics([]);
      clearTopicDetailState();
    }

    if (options?.showLoading !== false) {
      setListLoading(true);
      setDetailLoading(true);
    }

    try {
      const data = await requestJson<TopicsResponse>(`/api/discussions?classId=${encodeURIComponent(nextClassId)}`);
      if (topicListRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextTopics = data.data ?? [];
      const currentActiveTopicId = activeTopicIdRef.current;
      const resolvedTopicId = resolveDiscussionTopicId(
        nextTopics,
        options?.preferredTopicId,
        currentActiveTopicId
      );
      const topicChanged = resolvedTopicId !== currentActiveTopicId;

      setAuthRequired(false);
      applyTopics(nextTopics);

      if (topicChanged) {
        applyActiveTopicId(resolvedTopicId);
        setReplyText("");
      }

      if (!resolvedTopicId) {
        clearTopicDetailState({ clearReplyDraft: false });
        setLastLoadedAt(new Date().toISOString());
        return "loaded";
      }

      const detailResult = await loadTopicDetail(resolvedTopicId, {
        showLoading: false,
        preserveCurrentDetail: !topicChanged && activeTopicRef.current?.id === resolvedTopicId,
        clearVisibleDetail: topicChanged || activeTopicRef.current?.id !== resolvedTopicId
      });
      if (topicListRequestIdRef.current !== requestId) {
        return "stale";
      }
      if (detailResult === "auth" || detailResult === "stale") {
        return detailResult;
      }

      setLastLoadedAt(new Date().toISOString());
      return detailResult;
    } catch (error) {
      if (topicListRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      setPageError(getDiscussionTopicListRequestMessage(error, "加载讨论话题失败"));
      if (classChanged) {
        applyTopics([]);
        clearTopicDetailState();
      }
      return "error";
    } finally {
      if (options?.showLoading !== false && topicListRequestIdRef.current === requestId) {
        setListLoading(false);
        setDetailLoading(false);
      }
    }
  }, [
    activeTopicIdRef,
    activeTopicRef,
    applyActiveTopicId,
    applyClassId,
    applyTopics,
    classIdRef,
    clearTopicDetailState,
    handleAuthRequired,
    loadTopicDetail,
    setAuthRequired,
    setDetailLoading,
    setLastLoadedAt,
    setListLoading,
    setActionError,
    setPageError,
    setReplyText,
    topicListRequestIdRef
  ]);

  const loadSession = useCallback(async (
    mode: "initial" | "refresh" = "initial"
  ): Promise<DiscussionLoadStatus> => {
    const requestId = sessionRequestIdRef.current + 1;
    const previousClassId = classIdRef.current;
    const previousActiveTopicId = activeTopicIdRef.current;

    sessionRequestIdRef.current = requestId;
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setPageError(null);

    try {
      const noStoreRequestInit = getDiscussionNoStoreRequestInit();
      const [meData, classData] = await Promise.all([
        requestJson<AuthMeResponse>("/api/auth/me", noStoreRequestInit),
        requestJson<ClassesResponse>("/api/classes", noStoreRequestInit)
      ]);
      if (sessionRequestIdRef.current !== requestId) {
        return "stale";
      }

      const nextUser = meData.user ?? meData.data?.user ?? null;
      const nextClasses = classData.data ?? [];
      const nextClassId = resolveDiscussionsClassId(nextClasses, previousClassId);

      setUser(nextUser);
      setAuthRequired(false);
      applyClasses(nextClasses);
      applyClassId(nextClassId);

      if (!nextClassId) {
        applyTopics([]);
        clearTopicDetailState();
        return "empty";
      }

      const topicLoadResult = await loadTopicsForClass(nextClassId, {
        preferredTopicId: nextClassId === previousClassId ? previousActiveTopicId : undefined,
        showLoading: false
      });
      if (topicLoadResult === "auth" || topicLoadResult === "stale") {
        return topicLoadResult;
      }
      if (sessionRequestIdRef.current !== requestId) {
        return "stale";
      }

      return topicLoadResult;
    } catch (error) {
      if (sessionRequestIdRef.current !== requestId) {
        return "stale";
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      setPageError(getDiscussionTopicListRequestMessage(error, "加载讨论区失败"));
      return "error";
    } finally {
      if (sessionRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
        setListLoading(false);
        setDetailLoading(false);
      }
    }
  }, [
    activeTopicIdRef,
    applyClassId,
    applyClasses,
    applyTopics,
    classIdRef,
    clearTopicDetailState,
    handleAuthRequired,
    loadTopicsForClass,
    sessionRequestIdRef,
    setAuthRequired,
    setDetailLoading,
    setLoading,
    setPageError,
    setRefreshing,
    setListLoading,
    setUser
  ]);

  return {
    loadTopicDetail,
    loadTopicsForClass,
    loadSession
  };
}
