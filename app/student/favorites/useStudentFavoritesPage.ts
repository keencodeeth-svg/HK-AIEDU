"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { FavoriteItem, FavoritesResponse } from "./types";
import {
  buildFavoriteSearchText,
  copyTextToClipboard,
  getStudentFavoriteRemoveRequestMessage,
  getStudentFavoritesRequestMessage,
  getStudentFavoriteSaveRequestMessage,
  getStudentFavoritesStageCopy,
  normalizeFavoriteTagInput,
  resolveStudentFavoritesSelectedTag,
  resolveStudentFavoritesSubjectFilter
} from "./utils";

export function useStudentFavoritesPage() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const loadRequestIdRef = useRef(0);
  const hasFavoritesSnapshotRef = useRef(false);
  const selectedTagRef = useRef("");
  const subjectFilterRef = useRef("all");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");
  const [showAll, setShowAll] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [savingQuestionId, setSavingQuestionId] = useState("");
  const [removingQuestionId, setRemovingQuestionId] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearFavoritesState = useCallback(() => {
    hasFavoritesSnapshotRef.current = false;
    setFavorites([]);
    setPageError(null);
    setActionError(null);
    setActionMessage(null);
    setEditingQuestionId("");
    setDraftTags("");
    setDraftNote("");
    setSavingQuestionId("");
    setRemovingQuestionId("");
    setLastLoadedAt(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearFavoritesState();
    setAuthRequired(true);
  }, [clearFavoritesState]);

  const loadFavorites = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const isRefresh = mode === "refresh";

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setPageError(null);

    try {
      const data = await requestJson<FavoritesResponse>("/api/favorites?includeQuestion=1");
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const nextFavorites = Array.isArray(data.data) ? data.data : [];
      const nextSubjectFilter = resolveStudentFavoritesSubjectFilter(nextFavorites, subjectFilterRef.current);
      const nextSelectedTag = resolveStudentFavoritesSelectedTag(nextFavorites, selectedTagRef.current);

      setAuthRequired(false);
      hasFavoritesSnapshotRef.current = true;
      setFavorites(nextFavorites);
      if (nextSubjectFilter !== subjectFilterRef.current) {
        subjectFilterRef.current = nextSubjectFilter;
        setSubjectFilter(nextSubjectFilter);
        setShowAll(false);
      }
      if (nextSelectedTag !== selectedTagRef.current) {
        selectedTagRef.current = nextSelectedTag;
        setSelectedTag(nextSelectedTag);
        setShowAll(false);
      }
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        if (!hasFavoritesSnapshotRef.current) {
          clearFavoritesState();
        }
        setAuthRequired(false);
        setPageError(getStudentFavoritesRequestMessage(error, "加载收藏夹失败"));
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearFavoritesState, handleAuthRequired]);

  useEffect(() => {
    void loadFavorites("initial");
  }, [loadFavorites]);

  const subjectOptions = useMemo(() => {
    const subjects = Array.from(
      new Set(favorites.map((item) => item.question?.subject).filter((value): value is string => Boolean(value)))
    );
    return subjects.sort((left, right) => (SUBJECT_LABELS[left] ?? left).localeCompare(SUBJECT_LABELS[right] ?? right, "zh-CN"));
  }, [favorites]);

  const topTags = useMemo(() => {
    const counter = new Map<string, number>();
    favorites.forEach((item) => {
      item.tags.forEach((tag) => counter.set(tag, (counter.get(tag) ?? 0) + 1));
    });
    return Array.from(counter.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
      .slice(0, 10);
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return favorites
      .filter((item) => {
        if (selectedTag && !item.tags.includes(selectedTag)) {
          return false;
        }
        if (subjectFilter !== "all" && item.question?.subject !== subjectFilter) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return buildFavoriteSearchText(item).includes(needle);
      })
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [favorites, keyword, selectedTag, subjectFilter]);

  const visibleFavorites = showAll ? filteredFavorites : filteredFavorites.slice(0, 12);
  const hasActiveFilters = Boolean(keyword.trim() || selectedTag || subjectFilter !== "all");
  const notedCount = useMemo(() => favorites.filter((item) => item.note?.trim()).length, [favorites]);
  const stageCopy = getStudentFavoritesStageCopy({
    loading,
    editingQuestionId,
    favoritesCount: favorites.length,
    filteredCount: filteredFavorites.length,
    hasActiveFilters
  });
  const hasFavoritesData = favorites.length > 0;
  const busy = Boolean(savingQuestionId) || Boolean(removingQuestionId);

  const clearFilters = useCallback(() => {
    selectedTagRef.current = "";
    subjectFilterRef.current = "all";
    setKeyword("");
    setSelectedTag("");
    setSubjectFilter("all");
    setShowAll(false);
  }, []);

  const updateKeyword = useCallback((value: string) => {
    setKeyword(value);
    setShowAll(false);
  }, []);

  const updateSubjectFilter = useCallback((value: string) => {
    subjectFilterRef.current = value;
    setSubjectFilter(value);
    setShowAll(false);
  }, []);

  const toggleSelectedTag = useCallback((tag: string) => {
    setSelectedTag((prev) => {
      const nextValue = prev === tag ? "" : tag;
      selectedTagRef.current = nextValue;
      return nextValue;
    });
    setShowAll(false);
  }, []);

  const openEditor = useCallback((item: FavoriteItem) => {
    setEditingQuestionId(item.questionId);
    setDraftTags(item.tags.join("，"));
    setDraftNote(item.note ?? "");
    setActionError(null);
    setActionMessage(null);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  const closeEditor = useCallback(() => {
    setEditingQuestionId("");
    setDraftTags("");
    setDraftNote("");
  }, []);

  const refreshFavorites = useCallback(async () => {
    await loadFavorites("refresh");
  }, [loadFavorites]);

  async function handleSave(item: FavoriteItem) {
    setSavingQuestionId(item.questionId);
    setActionError(null);
    setActionMessage(null);

    try {
      const tags = normalizeFavoriteTagInput(draftTags);
      await requestJson(`/api/favorites/${item.questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, note: draftNote.trim() || undefined })
      });

      setFavorites((prev) =>
        prev.map((favorite) =>
          favorite.questionId === item.questionId
            ? {
                ...favorite,
                tags,
                note: draftNote.trim() || undefined,
                updatedAt: new Date().toISOString()
              }
            : favorite
        )
      );
      hasFavoritesSnapshotRef.current = true;
      setAuthRequired(false);
      setPageError(null);
      setLastLoadedAt(new Date().toISOString());
      setActionMessage(tags.length || draftNote.trim() ? "收藏信息已更新，复习时更容易快速定位。" : "已清空标签和备注。");
      pushAppToast("收藏信息已保存");
      closeEditor();
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      const message = getStudentFavoriteSaveRequestMessage(error, "保存收藏信息失败");
      setActionError(message);
      pushAppToast(message, "error");
    } finally {
      setSavingQuestionId("");
    }
  }

  async function handleRemove(item: FavoriteItem) {
    setRemovingQuestionId(item.questionId);
    setActionError(null);
    setActionMessage(null);

    try {
      await requestJson(`/api/favorites/${item.questionId}`, { method: "DELETE" });
      setFavorites((prev) => prev.filter((favorite) => favorite.questionId !== item.questionId));
      hasFavoritesSnapshotRef.current = true;
      setAuthRequired(false);
      setPageError(null);
      setLastLoadedAt(new Date().toISOString());
      if (editingQuestionId === item.questionId) {
        closeEditor();
      }
      setActionMessage("已从收藏夹移除这道题。");
      pushAppToast("已取消收藏");
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      const message = getStudentFavoriteRemoveRequestMessage(error, "取消收藏失败");
      setActionError(message);
      pushAppToast(message, "error");
    } finally {
      setRemovingQuestionId("");
    }
  }

  async function handleCopyQuestion(item: FavoriteItem) {
    const stem = item.question?.stem?.trim() ?? "";
    if (!stem) {
      pushAppToast("当前题目内容为空", "error");
      return;
    }
    try {
      await copyTextToClipboard(stem);
      pushAppToast("已复制题目");
    } catch {
      pushAppToast("复制失败，请稍后重试", "error");
    }
  }

  return {
    editorRef,
    favorites,
    authRequired,
    loading,
    refreshing,
    pageError,
    actionError,
    actionMessage,
    keyword,
    selectedTag,
    subjectFilter,
    viewMode,
    showAll,
    editingQuestionId,
    draftTags,
    draftNote,
    savingQuestionId,
    removingQuestionId,
    lastLoadedAt,
    subjectOptions,
    topTags,
    filteredFavorites,
    visibleFavorites,
    hasActiveFilters,
    notedCount,
    stageCopy,
    hasFavoritesData,
    busy,
    setDraftTags,
    setDraftNote,
    setViewMode,
    clearFilters,
    updateKeyword,
    updateSubjectFilter,
    toggleSelectedTag,
    toggleShowAll: () => setShowAll((prev) => !prev),
    openEditor,
    closeEditor,
    refreshFavorites,
    handleSave,
    handleRemove,
    handleCopyQuestion
  };
}
