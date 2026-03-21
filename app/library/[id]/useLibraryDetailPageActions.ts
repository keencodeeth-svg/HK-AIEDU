"use client";

import {
  useCallback,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  LibraryDetailItem,
  LibraryDetailResponse,
  LibraryShareResponse
} from "../types";
import type { LibraryLoadResult } from "./useLibraryDetailPageLoaders";
import {
  buildLibraryAnnotationPayload,
  buildLibrarySelectionCaptureState,
  getLibraryDetailRequestMessage,
  isMissingLibraryItemError
} from "../detail-utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type LibraryAnnotationMutationResponse = {
  data?: unknown;
  error?: string;
};

type LibraryDetailPageActionsOptions = {
  id: string;
  item: LibraryDetailItem | null;
  quote: string;
  note: string;
  selectedKpIds: string[];
  hasItemSnapshotRef: MutableRefObject<boolean>;
  load: (mode?: "initial" | "refresh") => Promise<LibraryLoadResult>;
  clearLibraryPageState: () => void;
  handleAuthRequired: () => void;
  setItem: Setter<LibraryDetailItem | null>;
  setSelectedKpIds: Setter<string[]>;
  setQuote: Setter<string>;
  setNote: Setter<string>;
  setShareUrl: Setter<string>;
  setMessage: Setter<string | null>;
  setPageError: Setter<string | null>;
  setActionError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setSavingAnnotation: Setter<boolean>;
  setCreatingShare: Setter<boolean>;
  setSavingKnowledgePoints: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useLibraryDetailPageActions({
  id,
  item,
  quote,
  note,
  selectedKpIds,
  hasItemSnapshotRef,
  load,
  clearLibraryPageState,
  handleAuthRequired,
  setItem,
  setSelectedKpIds,
  setQuote,
  setNote,
  setShareUrl,
  setMessage,
  setPageError,
  setActionError,
  setAuthRequired,
  setSavingAnnotation,
  setCreatingShare,
  setSavingKnowledgePoints,
  setLastLoadedAt
}: LibraryDetailPageActionsOptions) {
  const captureSelection = useCallback(() => {
    const selection = window.getSelection()?.toString() ?? "";
    const captureState = buildLibrarySelectionCaptureState(item?.textContent, selection);
    if (!captureState) {
      return;
    }

    setQuote(captureState.quote);
    setActionError(null);
    setMessage(captureState.message);
  }, [item?.textContent, setActionError, setMessage, setQuote]);

  const submitAnnotation = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setActionError(null);
    if (!quote.trim()) {
      setActionError("请填写或选中标注片段");
      return;
    }

    setSavingAnnotation(true);

    try {
      await requestJson<LibraryAnnotationMutationResponse>(`/api/library/${id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildLibraryAnnotationPayload(item, quote, note))
      });
      setQuote("");
      setNote("");
      const refreshResult = await load("refresh");
      setMessage(
        refreshResult.status === "error"
          ? "标注已保存，但最新数据刷新失败，请稍后重试。"
          : "标注已保存"
      );
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        setPageError(getLibraryDetailRequestMessage(error, "资料不存在，或当前账号无权访问。"));
      } else {
        setActionError(getLibraryDetailRequestMessage(error, "保存标注失败"));
      }
    } finally {
      setSavingAnnotation(false);
    }
  }, [
    clearLibraryPageState,
    handleAuthRequired,
    id,
    item,
    load,
    note,
    quote,
    setActionError,
    setAuthRequired,
    setMessage,
    setNote,
    setPageError,
    setQuote,
    setSavingAnnotation
  ]);

  const createShare = useCallback(async () => {
    setMessage(null);
    setActionError(null);
    setCreatingShare(true);

    try {
      const data = await requestJson<LibraryShareResponse>(`/api/library/${id}/share`, {
        method: "POST"
      });
      setShareUrl(data?.data?.shareUrl ?? "");
      setMessage("分享链接已生成");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        setPageError(getLibraryDetailRequestMessage(error, "资料不存在，或当前账号无权访问。"));
      } else {
        setActionError(getLibraryDetailRequestMessage(error, "生成分享链接失败"));
      }
    } finally {
      setCreatingShare(false);
    }
  }, [
    clearLibraryPageState,
    handleAuthRequired,
    id,
    setActionError,
    setAuthRequired,
    setCreatingShare,
    setMessage,
    setPageError,
    setShareUrl
  ]);

  const saveKnowledgePoints = useCallback(async () => {
    setMessage(null);
    setActionError(null);
    if (!selectedKpIds.length) {
      setActionError("请至少选择一个知识点");
      return;
    }
    setSavingKnowledgePoints(true);

    try {
      const data = await requestJson<LibraryDetailResponse>(`/api/library/${id}/knowledge-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePointIds: selectedKpIds
        })
      });
      const nextItem = data.data ?? null;
      if (nextItem) {
        hasItemSnapshotRef.current = true;
        setItem(nextItem);
        setSelectedKpIds(nextItem.knowledgePointIds ?? []);
        setLastLoadedAt(new Date().toISOString());
      }
      setMessage("知识点修正已保存");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        setPageError(getLibraryDetailRequestMessage(error, "资料不存在，或当前账号无权访问。"));
      } else {
        setActionError(getLibraryDetailRequestMessage(error, "更新知识点失败"));
      }
    } finally {
      setSavingKnowledgePoints(false);
    }
  }, [
    clearLibraryPageState,
    handleAuthRequired,
    hasItemSnapshotRef,
    id,
    selectedKpIds,
    setActionError,
    setAuthRequired,
    setItem,
    setLastLoadedAt,
    setMessage,
    setPageError,
    setSavingKnowledgePoints,
    setSelectedKpIds
  ]);

  return {
    captureSelection,
    submitAnnotation,
    createShare,
    saveKnowledgePoints
  };
}
