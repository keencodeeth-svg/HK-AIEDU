"use client";

import type { ComponentProps } from "react";
import StudentFavoritesFiltersCard from "./_components/StudentFavoritesFiltersCard";
import StudentFavoritesHeader from "./_components/StudentFavoritesHeader";
import StudentFavoritesList from "./_components/StudentFavoritesList";
import StudentFavoritesOverviewSection from "./_components/StudentFavoritesOverviewSection";
import { useStudentFavoritesPage } from "./useStudentFavoritesPage";

export function useStudentFavoritesPageView() {
  const page = useStudentFavoritesPage();

  const headerProps: ComponentProps<typeof StudentFavoritesHeader> = {
    favoritesCount: page.favorites.length,
    notedCount: page.notedCount,
    subjectCount: page.subjectOptions.length,
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    busy: page.busy,
    onRefresh: () => {
      void page.refreshFavorites();
    }
  };

  const overviewProps: ComponentProps<typeof StudentFavoritesOverviewSection> = {
    stageCopy: page.stageCopy,
    favoritesCount: page.favorites.length,
    filteredCount: page.filteredFavorites.length,
    visibleCount: page.visibleFavorites.length,
    viewMode: page.viewMode,
    selectedTag: page.selectedTag,
    notedCount: page.notedCount,
    subjectCount: page.subjectOptions.length
  };

  const filtersProps: ComponentProps<typeof StudentFavoritesFiltersCard> = {
    keyword: page.keyword,
    subjectFilter: page.subjectFilter,
    subjectOptions: page.subjectOptions,
    hasActiveFilters: page.hasActiveFilters,
    filteredCount: page.filteredFavorites.length,
    viewMode: page.viewMode,
    topTags: page.topTags,
    selectedTag: page.selectedTag,
    onKeywordChange: page.updateKeyword,
    onSubjectFilterChange: page.updateSubjectFilter,
    onToggleTag: page.toggleSelectedTag,
    onViewModeChange: page.setViewMode,
    onClearFilters: page.clearFilters
  };

  const listProps: ComponentProps<typeof StudentFavoritesList> = {
    viewMode: page.viewMode,
    filteredFavorites: page.filteredFavorites,
    visibleFavorites: page.visibleFavorites,
    hasActiveFilters: page.hasActiveFilters,
    showAll: page.showAll,
    editingQuestionId: page.editingQuestionId,
    removingQuestionId: page.removingQuestionId,
    savingQuestionId: page.savingQuestionId,
    draftTags: page.draftTags,
    draftNote: page.draftNote,
    editorRef: page.editorRef,
    onEdit: page.openEditor,
    onCopy: (item) => {
      void page.handleCopyQuestion(item);
    },
    onRemove: (item) => {
      void page.handleRemove(item);
    },
    onDraftTagsChange: page.setDraftTags,
    onDraftNoteChange: page.setDraftNote,
    onSave: (item) => {
      void page.handleSave(item);
    },
    onCancelEdit: page.closeEditor,
    onClearFilters: page.clearFilters,
    onToggleShowAll: page.toggleShowAll
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasFavoritesData: page.hasFavoritesData,
    pageError: page.pageError,
    actionError: page.actionError,
    actionMessage: page.actionMessage,
    reload: () => {
      void page.refreshFavorites();
    },
    headerProps,
    overviewProps,
    filtersProps,
    listProps
  };
}
