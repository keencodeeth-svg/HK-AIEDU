"use client";

import { useCallback, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ClassItem, DiscussionLoadStatus, Topic } from "./types";
import {
  getDiscussionCreateRequestMessage,
  getDiscussionCreateSuccessMessage,
  getDiscussionReplyRequestMessage,
  getDiscussionReplySuccessMessage,
  isMissingDiscussionClassError,
  isMissingDiscussionTopicError,
  resolveDiscussionsClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LoadTopicDetail = (
  topicId: string,
  options?: { showLoading?: boolean; preserveCurrentDetail?: boolean; clearVisibleDetail?: boolean }
) => Promise<DiscussionLoadStatus>;

type LoadTopicsForClass = (
  nextClassId: string,
  options?: { preferredTopicId?: string; showLoading?: boolean }
) => Promise<DiscussionLoadStatus>;

type ClearTopicDetailState = (options?: { invalidate?: boolean; clearReplyDraft?: boolean }) => void;

type DiscussionsActionsOptions = {
  title: string;
  content: string;
  pinned: boolean;
  replyText: string;
  classesRef: MutableRefObject<ClassItem[]>;
  classIdRef: MutableRefObject<string>;
  activeTopicIdRef: MutableRefObject<string>;
  activeTopicRef: MutableRefObject<Topic | null>;
  handleAuthRequired: () => void;
  clearActionNotices: () => void;
  scrollDetailIntoView: (focusReply?: boolean) => void;
  loadTopicDetail: LoadTopicDetail;
  loadTopicsForClass: LoadTopicsForClass;
  applyClasses: (nextClasses: ClassItem[]) => void;
  applyClassId: (nextClassId: string) => void;
  applyTopics: (nextTopics: Topic[]) => void;
  applyActiveTopicId: (nextTopicId: string) => void;
  clearTopicDetailState: ClearTopicDetailState;
  setAuthRequired: Setter<boolean>;
  setTitle: Setter<string>;
  setContent: Setter<string>;
  setPinned: Setter<boolean>;
  setReplyText: Setter<string>;
  setPageError: Setter<string | null>;
  setActionError: Setter<string | null>;
  setActionMessage: Setter<string | null>;
  setCreating: Setter<boolean>;
  setReplySubmitting: Setter<boolean>;
};

export function useDiscussionsActions({
  title,
  content,
  pinned,
  replyText,
  classesRef,
  classIdRef,
  activeTopicIdRef,
  activeTopicRef,
  handleAuthRequired,
  clearActionNotices,
  scrollDetailIntoView,
  loadTopicDetail,
  loadTopicsForClass,
  applyClasses,
  applyClassId,
  applyTopics,
  applyActiveTopicId,
  clearTopicDetailState,
  setAuthRequired,
  setTitle,
  setContent,
  setPinned,
  setReplyText,
  setPageError,
  setActionError,
  setActionMessage,
  setCreating,
  setReplySubmitting
}: DiscussionsActionsOptions) {
  const handleCreate = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classIdRef.current || !title.trim() || !content.trim()) {
      setActionError("请先补全班级、标题和话题内容。");
      return;
    }

    setCreating(true);
    clearActionNotices();

    try {
      const payload = await requestJson<{ data?: Topic }>("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classIdRef.current,
          title: title.trim(),
          content: content.trim(),
          pinned
        })
      });

      const createdTopicId = payload.data?.id ?? "";
      setTitle("");
      setContent("");
      setPinned(false);

      const refreshResult = await loadTopicsForClass(classIdRef.current, {
        preferredTopicId: createdTopicId,
        showLoading: true
      });
      if (refreshResult === "auth") {
        return;
      }

      setActionMessage(getDiscussionCreateSuccessMessage(refreshResult));
      if (refreshResult === "loaded") {
        scrollDetailIntoView();
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        if (isMissingDiscussionClassError(error)) {
          const nextClasses = classesRef.current.filter((item) => item.id !== classIdRef.current);
          const nextClassId = resolveDiscussionsClassId(nextClasses, "");

          applyClasses(nextClasses);
          applyClassId(nextClassId);
          if (nextClassId) {
            void loadTopicsForClass(nextClassId, { showLoading: true });
          } else {
            applyTopics([]);
            clearTopicDetailState();
          }
        }
        setActionError(getDiscussionCreateRequestMessage(error, "发布失败"));
      }
    } finally {
      setCreating(false);
    }
  }, [
    applyClassId,
    applyClasses,
    applyTopics,
    classIdRef,
    classesRef,
    clearActionNotices,
    clearTopicDetailState,
    content,
    handleAuthRequired,
    loadTopicsForClass,
    pinned,
    scrollDetailIntoView,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setContent,
    setCreating,
    setPinned,
    setTitle,
    title
  ]);

  const handleReply = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const replyingTopicId = activeTopicIdRef.current;
    if (!replyingTopicId || !replyText.trim()) {
      setActionError("请输入回复内容后再发送。");
      return;
    }

    setReplySubmitting(true);
    clearActionNotices();

    try {
      await requestJson(`/api/discussions/${replyingTopicId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() })
      });

      setReplyText("");
      const refreshResult = await loadTopicsForClass(classIdRef.current, {
        preferredTopicId: replyingTopicId,
        showLoading: false
      });
      if (refreshResult === "auth") {
        return;
      }

      setActionMessage(getDiscussionReplySuccessMessage(refreshResult));
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        const nextErrorMessage = getDiscussionReplyRequestMessage(error, "回复失败");

        if (isMissingDiscussionTopicError(error)) {
          const refreshResult = await loadTopicsForClass(classIdRef.current, { showLoading: false });
          if (refreshResult === "auth") {
            return;
          }
          setPageError(nextErrorMessage);
        } else {
          setActionError(nextErrorMessage);
        }
      }
    } finally {
      setReplySubmitting(false);
    }
  }, [
    activeTopicIdRef,
    classIdRef,
    clearActionNotices,
    handleAuthRequired,
    loadTopicsForClass,
    replyText,
    setActionError,
    setActionMessage,
    setAuthRequired,
    setPageError,
    setReplySubmitting,
    setReplyText
  ]);

  const handleClassChange = useCallback(async (nextClassId: string) => {
    clearActionNotices();
    await loadTopicsForClass(nextClassId, { showLoading: true });
  }, [clearActionNotices, loadTopicsForClass]);

  const handleSelectTopic = useCallback(async (topicId: string) => {
    const topicChanged = topicId !== activeTopicIdRef.current;

    clearActionNotices();
    setPageError(null);
    if (topicChanged) {
      applyActiveTopicId(topicId);
      setReplyText("");
    }

    const result = await loadTopicDetail(topicId, {
      showLoading: true,
      preserveCurrentDetail: !topicChanged && activeTopicRef.current?.id === topicId,
      clearVisibleDetail: topicChanged || activeTopicRef.current?.id !== topicId
    });
    if (result === "loaded") {
      scrollDetailIntoView();
    }
  }, [
    activeTopicIdRef,
    activeTopicRef,
    applyActiveTopicId,
    clearActionNotices,
    loadTopicDetail,
    scrollDetailIntoView,
    setPageError,
    setReplyText
  ]);

  return {
    handleCreate,
    handleReply,
    handleClassChange,
    handleSelectTopic
  };
}
