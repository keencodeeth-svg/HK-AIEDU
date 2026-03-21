"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import type {
  LibraryAnnotation,
  LibraryDetailAuthUser,
  LibraryDetailItem,
  LibraryKnowledgePoint,
} from "../types";
import {
  canEditLibraryKnowledgePoints,
  filterLibraryKnowledgePointsForItem,
  resolveLibrarySelectedKnowledgePointIds
} from "../detail-utils";
import { useLibraryDetailPageActions } from "./useLibraryDetailPageActions";
import { useLibraryDetailPageLoaders } from "./useLibraryDetailPageLoaders";

export function useLibraryDetailPage(id: string) {
  const loadRequestIdRef = useRef(0);
  const hasItemSnapshotRef = useRef(false);
  const hasAnnotationsSnapshotRef = useRef(false);
  const hasUserSnapshotRef = useRef(false);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const [item, setItem] = useState<LibraryDetailItem | null>(null);
  const [annotations, setAnnotations] = useState<LibraryAnnotation[]>([]);
  const [user, setUser] = useState<LibraryDetailAuthUser>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<LibraryKnowledgePoint[]>([]);
  const [selectedKpIds, setSelectedKpIds] = useState<string[]>([]);
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [savingKnowledgePoints, setSavingKnowledgePoints] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearLibraryItemState = useCallback(() => {
    hasItemSnapshotRef.current = false;
    setItem(null);
    setSelectedKpIds([]);
    setQuote("");
    setNote("");
    setShareUrl("");
  }, []);

  const clearAnnotationsState = useCallback(() => {
    hasAnnotationsSnapshotRef.current = false;
    setAnnotations([]);
  }, []);

  const clearUserState = useCallback(() => {
    hasUserSnapshotRef.current = false;
    setUser(null);
  }, []);

  const clearKnowledgePointsState = useCallback(() => {
    hasKnowledgePointsSnapshotRef.current = false;
    setKnowledgePoints([]);
  }, []);

  const clearLibraryPageState = useCallback(() => {
    clearLibraryItemState();
    clearAnnotationsState();
    clearUserState();
    clearKnowledgePointsState();
    setPageError(null);
    setActionError(null);
    setMessage(null);
    setLastLoadedAt(null);
  }, [clearAnnotationsState, clearKnowledgePointsState, clearLibraryItemState, clearUserState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearLibraryPageState();
    setLoading(false);
    setRefreshing(false);
    setAuthRequired(true);
  }, [clearLibraryPageState]);

  const { load } = useLibraryDetailPageLoaders({
    id,
    loadRequestIdRef,
    hasItemSnapshotRef,
    hasAnnotationsSnapshotRef,
    hasUserSnapshotRef,
    hasKnowledgePointsSnapshotRef,
    clearLibraryItemState,
    clearAnnotationsState,
    clearUserState,
    clearKnowledgePointsState,
    clearLibraryPageState,
    handleAuthRequired,
    setItem,
    setAnnotations,
    setUser,
    setKnowledgePoints,
    setLoading,
    setRefreshing,
    setPageError,
    setAuthRequired,
    setLastLoadedAt
  });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedKpIds((current) => resolveLibrarySelectedKnowledgePointIds(item, knowledgePoints, current));
  }, [item, knowledgePoints]);

  const filteredKnowledgePoints = useMemo(() => {
    return filterLibraryKnowledgePointsForItem(item, knowledgePoints);
  }, [item, knowledgePoints]);

  const {
    captureSelection,
    submitAnnotation,
    createShare,
    saveKnowledgePoints
  } = useLibraryDetailPageActions({
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
  });

  const canEditKnowledgePoints = canEditLibraryKnowledgePoints(user);
  const lastLoadedAtLabel = lastLoadedAt ? formatLoadedTime(lastLoadedAt) : null;

  const updateQuote = useCallback((value: string) => {
    setQuote(value);
  }, []);

  const updateNote = useCallback((value: string) => {
    setNote(value);
  }, []);

  const updateSelectedKnowledgePointIds = useCallback((value: string[]) => {
    setSelectedKpIds(value);
  }, []);

  return {
    item,
    annotations,
    quote,
    note,
    shareUrl,
    message,
    pageError,
    actionError,
    loading,
    refreshing,
    authRequired,
    savingAnnotation,
    creatingShare,
    savingKnowledgePoints,
    filteredKnowledgePoints,
    selectedKpIds,
    canEditKnowledgePoints,
    lastLoadedAtLabel,
    load,
    captureSelection,
    submitAnnotation,
    createShare,
    saveKnowledgePoints,
    updateQuote,
    updateNote,
    updateSelectedKnowledgePointIds
  };
}
