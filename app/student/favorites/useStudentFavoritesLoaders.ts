"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import {
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  FavoriteItem,
  FavoritesResponse
} from "./types";
import {
  getStudentFavoritesRequestMessage,
  resolveStudentFavoritesActiveFilters
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type StudentFavoritesLoadersOptions = {
  loadRequestIdRef: MutableRefObject<number>;
  hasFavoritesSnapshotRef: MutableRefObject<boolean>;
  selectedTagRef: MutableRefObject<string>;
  subjectFilterRef: MutableRefObject<string>;
  clearFavoritesState: () => void;
  setFavorites: Setter<FavoriteItem[]>;
  setAuthRequired: Setter<boolean>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPageError: Setter<string | null>;
  setSelectedTag: Setter<string>;
  setSubjectFilter: Setter<string>;
  setShowAll: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useStudentFavoritesLoaders({
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
}: StudentFavoritesLoadersOptions) {
  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearFavoritesState();
    setAuthRequired(true);
  }, [clearFavoritesState, loadRequestIdRef, setAuthRequired]);

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
      const nextFilters = resolveStudentFavoritesActiveFilters(
        nextFavorites,
        subjectFilterRef.current,
        selectedTagRef.current
      );

      setAuthRequired(false);
      hasFavoritesSnapshotRef.current = true;
      setFavorites(nextFavorites);
      if (nextFilters.subjectFilter !== subjectFilterRef.current) {
        subjectFilterRef.current = nextFilters.subjectFilter;
        setSubjectFilter(nextFilters.subjectFilter);
        setShowAll(false);
      }
      if (nextFilters.selectedTag !== selectedTagRef.current) {
        selectedTagRef.current = nextFilters.selectedTag;
        setSelectedTag(nextFilters.selectedTag);
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
  }, [
    clearFavoritesState,
    handleAuthRequired,
    hasFavoritesSnapshotRef,
    loadRequestIdRef,
    selectedTagRef,
    setAuthRequired,
    setFavorites,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setRefreshing,
    setSelectedTag,
    setShowAll,
    setSubjectFilter,
    subjectFilterRef
  ]);

  return {
    handleAuthRequired,
    loadFavorites
  };
}
