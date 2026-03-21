"use client";

import { useCallback, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { ClassItem, InboxLoadStatus, ThreadDetail } from "./types";
import {
  getInboxCreateRequestMessage,
  getInboxCreateSuccessMessage,
  getInboxReplyRequestMessage,
  getInboxReplySuccessMessage,
  isInboxThreadDetailCurrent,
  isMissingInboxClassError,
  isMissingInboxThreadError,
  resolveInboxClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ClearThreadDetailState = (options?: { clearReplyDraft?: boolean; clearReplyFeedback?: boolean }) => void;

type LoadThreadDetail = (
  threadId: string,
  options?: { preserveCurrentDetail?: boolean; clearVisibleDetail?: boolean }
) => Promise<InboxLoadStatus>;

type LoadThreads = (options?: { preferredThreadId?: string }) => Promise<InboxLoadStatus>;

type InboxActionsOptions = {
  subject: string;
  content: string;
  replyText: string;
  includeParents: boolean;
  classesRef: MutableRefObject<ClassItem[]>;
  classIdRef: MutableRefObject<string>;
  activeThreadIdRef: MutableRefObject<string>;
  threadDetailRef: MutableRefObject<ThreadDetail | null>;
  handleAuthRequired: () => void;
  clearComposeFeedback: () => void;
  clearReplyFeedback: () => void;
  applyClasses: (nextClasses: ClassItem[]) => void;
  applyClassId: (nextClassId: string) => void;
  applyActiveThreadId: (nextThreadId: string) => void;
  clearThreadDetailState: ClearThreadDetailState;
  loadThreadDetail: LoadThreadDetail;
  loadThreads: LoadThreads;
  setAuthRequired: Setter<boolean>;
  setSubject: Setter<string>;
  setContent: Setter<string>;
  setReplyText: Setter<string>;
  setIncludeParents: Setter<boolean>;
  setComposeMessage: Setter<string | null>;
  setComposeError: Setter<string | null>;
  setReplyMessage: Setter<string | null>;
  setReplyError: Setter<string | null>;
  setPageError: Setter<string | null>;
  setActionLoading: Setter<boolean>;
};

export function useInboxActions({
  subject,
  content,
  replyText,
  includeParents,
  classesRef,
  classIdRef,
  activeThreadIdRef,
  threadDetailRef,
  handleAuthRequired,
  clearComposeFeedback,
  clearReplyFeedback,
  applyClasses,
  applyClassId,
  applyActiveThreadId,
  clearThreadDetailState,
  loadThreadDetail,
  loadThreads,
  setAuthRequired,
  setSubject,
  setContent,
  setReplyText,
  setIncludeParents,
  setComposeMessage,
  setComposeError,
  setReplyMessage,
  setReplyError,
  setPageError,
  setActionLoading
}: InboxActionsOptions) {
  const selectThread = useCallback(async (threadId: string) => {
    setPageError(null);
    if (threadId !== activeThreadIdRef.current) {
      applyActiveThreadId(threadId);
      setReplyText("");
    }
    clearReplyFeedback();

    if (!threadId) {
      clearThreadDetailState();
      return;
    }

    await loadThreadDetail(threadId, {
      preserveCurrentDetail: isInboxThreadDetailCurrent(threadDetailRef.current, threadId),
      clearVisibleDetail: !isInboxThreadDetailCurrent(threadDetailRef.current, threadId)
    });
  }, [
    activeThreadIdRef,
    applyActiveThreadId,
    clearReplyFeedback,
    clearThreadDetailState,
    loadThreadDetail,
    setPageError,
    setReplyText,
    threadDetailRef
  ]);

  const handleCreate = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setActionLoading(true);
    clearComposeFeedback();
    setPageError(null);

    try {
      const data = await requestJson<{ data?: { threadId?: string } }>("/api/inbox/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, content, classId: classIdRef.current, includeParents })
      });

      const nextThreadId = data.data?.threadId ?? "";
      setSubject("");
      setContent("");
      setIncludeParents(false);

      const refreshStatus = await loadThreads({ preferredThreadId: nextThreadId });
      if (refreshStatus === "auth") {
        return;
      }

      setComposeMessage(getInboxCreateSuccessMessage(refreshStatus));
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        if (isMissingInboxClassError(nextError)) {
          const nextClasses = classesRef.current.filter((item) => item.id !== classIdRef.current);
          applyClasses(nextClasses);
          applyClassId(resolveInboxClassId(nextClasses, ""));
        }
        setComposeError(getInboxCreateRequestMessage(nextError, "发送失败"));
      }
    } finally {
      setActionLoading(false);
    }
  }, [
    applyClassId,
    applyClasses,
    classIdRef,
    classesRef,
    clearComposeFeedback,
    content,
    handleAuthRequired,
    includeParents,
    loadThreads,
    setActionLoading,
    setAuthRequired,
    setComposeError,
    setComposeMessage,
    setContent,
    setIncludeParents,
    setPageError,
    setSubject,
    subject
  ]);

  const handleReply = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const replyingThreadId = activeThreadIdRef.current;
    if (!replyingThreadId) return;

    setActionLoading(true);
    clearReplyFeedback();
    setPageError(null);

    try {
      await requestJson(`/api/inbox/threads/${replyingThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText })
      });

      setReplyText("");

      const refreshStatus = await loadThreads({ preferredThreadId: replyingThreadId });
      if (refreshStatus === "auth") {
        return;
      }

      setReplyMessage(getInboxReplySuccessMessage(refreshStatus));
    } catch (nextError) {
      if (isAuthError(nextError)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        const nextErrorMessage = getInboxReplyRequestMessage(nextError, "发送失败");

        if (isMissingInboxThreadError(nextError)) {
          const refreshStatus = await loadThreads();
          if (refreshStatus === "auth") {
            return;
          }
          setPageError(nextErrorMessage);
        } else {
          setReplyError(nextErrorMessage);
        }
      }
    } finally {
      setActionLoading(false);
    }
  }, [
    activeThreadIdRef,
    clearReplyFeedback,
    handleAuthRequired,
    loadThreads,
    replyText,
    setActionLoading,
    setAuthRequired,
    setPageError,
    setReplyError,
    setReplyMessage,
    setReplyText
  ]);

  return {
    selectThread,
    handleCreate,
    handleReply
  };
}
