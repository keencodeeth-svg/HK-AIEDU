"use client";

import { useEffect, useMemo, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import {
  getRequestErrorMessage,
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  TutorHistoryCreatePayload,
  TutorHistoryItem,
  TutorHistoryItemResponse,
  TutorHistoryListResponse,
  TutorHistoryOriginFilter
} from "./types";
import { getOriginLabel, truncateText } from "./utils";

type UseTutorHistoryParams = {
  onReuseHistoryItem?: (item: TutorHistoryItem) => void;
  onAuthRequired?: () => void;
};

function isTutorHistoryItemMissing(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

function getTutorHistoryActionErrorMessage(error: unknown, fallback: string) {
  if (isTutorHistoryItemMissing(error)) {
    return "这条历史记录已不存在，已从列表中移除。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function useTutorHistory({
  onReuseHistoryItem,
  onAuthRequired
}: UseTutorHistoryParams = {}) {
  const [history, setHistory] = useState<TutorHistoryItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyOriginFilter, setHistoryOriginFilter] = useState<TutorHistoryOriginFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const data = await requestJson<TutorHistoryListResponse>("/api/ai/history");
        if (cancelled) {
          return;
        }
        setHistory(data.data ?? []);
      } catch (error) {
        if (!cancelled) {
          setHistory([]);
          if (isAuthError(error)) {
            onAuthRequired?.();
          }
        }
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [onAuthRequired]);

  async function saveHistory(payload: TutorHistoryCreatePayload) {
    try {
      const historyData = await requestJson<TutorHistoryItemResponse>("/api/ai/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (historyData.data) {
        setHistory((prev) => [historyData.data!, ...prev]);
      }
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired?.();
      }
      // Best effort only; saving history must not interrupt the active tutor flow.
    }
  }

  async function refreshHistory() {
    try {
      const data = await requestJson<TutorHistoryListResponse>("/api/ai/history");
      setHistory(data.data ?? []);
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired?.();
      }
      // Best effort only; history refresh must not block the live tutor flow.
    }
  }

  function clearHistoryFilters() {
    setHistoryKeyword("");
    setHistoryOriginFilter("all");
    setShowFavorites(false);
  }

  async function toggleFavorite(item: TutorHistoryItem) {
    try {
      const data = await requestJson<TutorHistoryItemResponse>(
        `/api/ai/history/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite: !item.favorite })
        }
      );
      if (data.data) {
        setHistory((prev) => prev.map((historyItem) => (historyItem.id === item.id ? data.data! : historyItem)));
        pushAppToast(item.favorite ? "已取消收藏" : "已加入收藏");
        return;
      }
      pushAppToast("更新收藏状态失败", "error");
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired?.();
        return;
      }
      if (isTutorHistoryItemMissing(error)) {
        setHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
      }
      pushAppToast(getTutorHistoryActionErrorMessage(error, "更新收藏状态失败"), "error");
    }
  }

  async function editTags(item: TutorHistoryItem) {
    const input = prompt("输入标签（用逗号分隔）", item.tags.join(",") ?? "");
    if (input === null) return;
    const tags = input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      const data = await requestJson<TutorHistoryItemResponse>(
        `/api/ai/history/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags })
        }
      );
      if (data.data) {
        setHistory((prev) => prev.map((historyItem) => (historyItem.id === item.id ? data.data! : historyItem)));
        pushAppToast(tags.length ? "标签已更新" : "标签已清空");
        return;
      }
      pushAppToast("标签更新失败", "error");
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired?.();
        return;
      }
      if (isTutorHistoryItemMissing(error)) {
        setHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
      }
      pushAppToast(getTutorHistoryActionErrorMessage(error, "标签更新失败"), "error");
    }
  }

  async function deleteHistory(item: TutorHistoryItem) {
    const confirmed = window.confirm(`确认删除这条记录？\n\n${truncateText(item.question, 60)}`);
    if (!confirmed) return;

    try {
      await requestJson(`/api/ai/history/${item.id}`, { method: "DELETE" });
      setHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
      pushAppToast("记录已删除");
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired?.();
        return;
      }
      if (isTutorHistoryItemMissing(error)) {
        setHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
      }
      pushAppToast(getTutorHistoryActionErrorMessage(error, "删除失败，请稍后重试"), "error");
    }
  }

  function reuseHistoryItem(item: TutorHistoryItem) {
    onReuseHistoryItem?.(item);
  }

  const filteredHistory = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();
    return history.filter((item) => {
      if (showFavorites && !item.favorite) {
        return false;
      }

      const origin = item.meta?.origin ?? "text";
      if (historyOriginFilter !== "all" && origin !== historyOriginFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchable = [
        item.question,
        item.answer,
        item.tags.join(" "),
        item.meta?.recognizedQuestion ?? "",
        item.meta?.subject ?? "",
        item.meta?.provider ?? "",
        item.meta?.learningMode === "study" ? "学习模式" : "直接讲解",
        getOriginLabel(item.meta?.origin)
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [history, historyKeyword, historyOriginFilter, showFavorites]);

  const historyImageCount = useMemo(
    () => history.filter((item) => (item.meta?.origin ?? "text") === "image").length,
    [history]
  );
  const favoriteHistoryCount = useMemo(() => history.filter((item) => item.favorite).length, [history]);
  const hasActiveHistoryFilters = showFavorites || historyOriginFilter !== "all" || historyKeyword.trim().length > 0;

  return {
    history,
    filteredHistory,
    showFavorites,
    historyKeyword,
    historyOriginFilter,
    hasActiveHistoryFilters,
    historyImageCount,
    favoriteHistoryCount,
    setShowFavorites,
    setHistoryKeyword,
    setHistoryOriginFilter,
    saveHistory,
    refreshHistory,
    clearHistoryFilters,
    toggleFavorite,
    editTags,
    deleteHistory,
    reuseHistoryItem
  };
}
