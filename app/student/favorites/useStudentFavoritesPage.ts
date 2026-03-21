"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FavoriteItem } from "./types";
import {
  getFilteredStudentFavorites,
  getStudentFavoritesStageCopy,
  getStudentFavoritesSubjectOptions,
  getStudentFavoritesTopTags
} from "./utils";
import { useStudentFavoritesActions } from "./useStudentFavoritesActions";
import { useStudentFavoritesLoaders } from "./useStudentFavoritesLoaders";

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

  const closeEditor = useCallback(() => {
    setEditingQuestionId("");
    setDraftTags("");
    setDraftNote("");
  }, []);

  const {
    handleAuthRequired,
    loadFavorites
  } = useStudentFavoritesLoaders({
    loadRequestIdRef,
    hasFavoritesSnapshotRef,
    selectedTagRef,
    subjectFilterRef,
    clearFavoritesState,
    setFavorites,
    setAuthRequired,
    setLoading,
    setRefreshing,
    setPageError,
    setSelectedTag,
    setSubjectFilter,
    setShowAll,
    setLastLoadedAt
  });

  useEffect(() => {
    void loadFavorites("initial");
  }, [loadFavorites]);

  const subjectOptions = useMemo(() => getStudentFavoritesSubjectOptions(favorites), [favorites]);
  const topTags = useMemo(() => getStudentFavoritesTopTags(favorites), [favorites]);
  const filteredFavorites = useMemo(
    () => getFilteredStudentFavorites(favorites, keyword, selectedTag, subjectFilter),
    [favorites, keyword, selectedTag, subjectFilter]
  );

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

  const refreshFavorites = useCallback(async () => {
    await loadFavorites("refresh");
  }, [loadFavorites]);

  const {
    handleSave,
    handleRemove,
    handleCopyQuestion
  } = useStudentFavoritesActions({
    hasFavoritesSnapshotRef,
    draftTags,
    draftNote,
    editingQuestionId,
    handleAuthRequired,
    closeEditor,
    setFavorites,
    setAuthRequired,
    setPageError,
    setActionError,
    setActionMessage,
    setSavingQuestionId,
    setRemovingQuestionId,
    setLastLoadedAt
  });

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
