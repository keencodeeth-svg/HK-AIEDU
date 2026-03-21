import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePoint,
  KnowledgePointBatchPreviewItem,
  KnowledgePointFacets,
  KnowledgePointForm,
  KnowledgePointListMeta,
  KnowledgePointQuery,
  KnowledgePointTreeNode,
  TreeForm
} from "./types";
import {
  createInitialAiKnowledgePointForm,
  createInitialBatchForm,
  createInitialKnowledgePointFacets,
  createInitialKnowledgePointForm,
  createInitialKnowledgePointMeta,
  createInitialKnowledgePointQuery,
  createInitialTreeForm,
  getAdminKnowledgePointsDerivedState,
  removeKnowledgePointSnapshot
} from "./utils";

export function useAdminKnowledgePointsPageState() {
  const allKnowledgePointsRequestIdRef = useRef(0);
  const knowledgePointListRequestIdRef = useRef(0);
  const createRequestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const treeRequestIdRef = useRef(0);
  const batchPreviewRequestIdRef = useRef(0);
  const batchConfirmRequestIdRef = useRef(0);
  const deleteRequestIdRef = useRef(0);
  const queryRef = useRef<KnowledgePointQuery>(createInitialKnowledgePointQuery());
  const pageRef = useRef(1);
  const pageSizeRef = useRef(20);
  const hasAllKnowledgePointsSnapshotRef = useRef(false);
  const hasKnowledgePointListSnapshotRef = useRef(false);
  const listRef = useRef<KnowledgePoint[]>([]);
  const allKnowledgePointsRef = useRef<KnowledgePoint[]>([]);
  const metaRef = useRef<KnowledgePointListMeta>(createInitialKnowledgePointMeta());

  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [allKnowledgePoints, setAllKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<KnowledgePointQuery>(createInitialKnowledgePointQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState<KnowledgePointListMeta>(createInitialKnowledgePointMeta);
  const [tree, setTree] = useState<KnowledgePointTreeNode[]>([]);
  const [facets, setFacets] = useState<KnowledgePointFacets>(createInitialKnowledgePointFacets);
  const [form, setForm] = useState<KnowledgePointForm>(createInitialKnowledgePointForm);
  const [aiForm, setAiForm] = useState<AiKnowledgePointForm>(createInitialAiKnowledgePointForm);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [treeForm, setTreeForm] = useState<TreeForm>(createInitialTreeForm);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [treeErrors, setTreeErrors] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<BatchForm>(createInitialBatchForm);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchPreview, setBatchPreview] = useState<KnowledgePointBatchPreviewItem[]>([]);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchShowDetail, setBatchShowDetail] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageActionError, setPageActionError] = useState<string | null>(null);
  const [allKnowledgePointsLoadError, setAllKnowledgePointsLoadError] = useState<string | null>(null);
  const [knowledgePointListLoadError, setKnowledgePointListLoadError] = useState<string | null>(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const syncList = useCallback((nextList: KnowledgePoint[]) => {
    listRef.current = nextList;
    setList(nextList);
  }, []);

  const syncAllKnowledgePoints = useCallback((nextKnowledgePoints: KnowledgePoint[]) => {
    allKnowledgePointsRef.current = nextKnowledgePoints;
    setAllKnowledgePoints(nextKnowledgePoints);
  }, []);

  const syncMeta = useCallback((nextMeta: KnowledgePointListMeta) => {
    metaRef.current = nextMeta;
    setMeta(nextMeta);
  }, []);

  const derivedState = useMemo(
    () =>
      getAdminKnowledgePointsDerivedState({
        allKnowledgePoints,
        aiForm,
        meta,
        allKnowledgePointsLoadError,
        knowledgePointListLoadError
      }),
    [
      aiForm,
      allKnowledgePoints,
      allKnowledgePointsLoadError,
      knowledgePointListLoadError,
      meta
    ]
  );

  useEffect(() => {
    if (derivedState.resolvedAiChapter !== aiForm.chapter) {
      setAiForm((current) => ({ ...current, chapter: derivedState.resolvedAiChapter }));
    }
  }, [aiForm.chapter, derivedState.resolvedAiChapter]);

  const removeKnowledgePointFromState = useCallback(
    (knowledgePointId: string) => {
      const nextSnapshot = removeKnowledgePointSnapshot(
        listRef.current,
        allKnowledgePointsRef.current,
        metaRef.current,
        knowledgePointId
      );
      syncList(nextSnapshot.list);
      syncAllKnowledgePoints(nextSnapshot.allKnowledgePoints);
      syncMeta(nextSnapshot.meta);
    },
    [syncAllKnowledgePoints, syncList, syncMeta]
  );

  const handleAuthRequired = useCallback(() => {
    allKnowledgePointsRequestIdRef.current += 1;
    knowledgePointListRequestIdRef.current += 1;
    createRequestIdRef.current += 1;
    aiRequestIdRef.current += 1;
    treeRequestIdRef.current += 1;
    batchPreviewRequestIdRef.current += 1;
    batchConfirmRequestIdRef.current += 1;
    deleteRequestIdRef.current += 1;
    setLoading(false);
    setAiLoading(false);
    setTreeLoading(false);
    setBatchLoading(false);
    setBatchConfirming(false);
    setBatchProgress(null);
    setAuthRequired(true);
  }, []);

  const patchQuery = useCallback((next: Partial<KnowledgePointQuery>) => {
    setQuery((current) => ({ ...current, ...next }));
    setPage(1);
  }, []);

  const clearBatchPreview = useCallback(() => {
    setBatchPreview([]);
    setBatchProgress(null);
    setBatchError(null);
    setBatchMessage(null);
  }, []);

  return {
    allKnowledgePointsRequestIdRef,
    knowledgePointListRequestIdRef,
    createRequestIdRef,
    aiRequestIdRef,
    treeRequestIdRef,
    batchPreviewRequestIdRef,
    batchConfirmRequestIdRef,
    deleteRequestIdRef,
    queryRef,
    pageRef,
    pageSizeRef,
    hasAllKnowledgePointsSnapshotRef,
    hasKnowledgePointListSnapshotRef,
    list,
    allKnowledgePoints,
    workspace,
    authRequired,
    loading,
    query,
    page,
    pageSize,
    meta,
    tree,
    facets,
    form,
    aiForm,
    aiLoading,
    aiMessage,
    aiErrors,
    treeForm,
    treeLoading,
    treeMessage,
    treeErrors,
    batchForm,
    batchLoading,
    batchError,
    batchMessage,
    batchProgress,
    batchPreview,
    batchConfirming,
    batchShowDetail,
    formError,
    pageActionError,
    chapterOptions: derivedState.chapterOptions,
    loadError: derivedState.loadError,
    pageStart: derivedState.pageStart,
    pageEnd: derivedState.pageEnd,
    setList,
    setAllKnowledgePoints,
    setWorkspace,
    setAuthRequired,
    setLoading,
    setQuery,
    setPage,
    setPageSize,
    setMeta,
    setTree,
    setFacets,
    setForm,
    setAiForm,
    setAiLoading,
    setAiMessage,
    setAiErrors,
    setTreeForm,
    setTreeLoading,
    setTreeMessage,
    setTreeErrors,
    setBatchForm,
    setBatchLoading,
    setBatchError,
    setBatchMessage,
    setBatchProgress,
    setBatchPreview,
    setBatchConfirming,
    setBatchShowDetail,
    setFormError,
    setPageActionError,
    setAllKnowledgePointsLoadError,
    setKnowledgePointListLoadError,
    syncList,
    syncAllKnowledgePoints,
    syncMeta,
    removeKnowledgePointFromState,
    handleAuthRequired,
    patchQuery,
    clearBatchPreview
  };
}
