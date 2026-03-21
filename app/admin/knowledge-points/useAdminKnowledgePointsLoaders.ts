"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  KnowledgePoint,
  KnowledgePointFacets,
  KnowledgePointListMeta,
  KnowledgePointListPayload,
  KnowledgePointQuery,
  KnowledgePointTreeNode
} from "./types";
import {
  buildAdminKnowledgePointsSearchParams,
  createInitialKnowledgePointFacets,
  getAdminKnowledgePointsErrorMessage
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type RequestRef = MutableRefObject<number>;
type SyncState<T> = (next: T) => void;

type AdminKnowledgePointsLoadersOptions = {
  queryRef: MutableRefObject<KnowledgePointQuery>;
  pageRef: MutableRefObject<number>;
  pageSizeRef: MutableRefObject<number>;
  allKnowledgePointsRequestIdRef: RequestRef;
  knowledgePointListRequestIdRef: RequestRef;
  hasAllKnowledgePointsSnapshotRef: MutableRefObject<boolean>;
  hasKnowledgePointListSnapshotRef: MutableRefObject<boolean>;
  handleAuthRequired: () => void;
  syncAllKnowledgePoints: SyncState<KnowledgePoint[]>;
  syncList: SyncState<KnowledgePoint[]>;
  syncMeta: SyncState<KnowledgePointListMeta>;
  setTree: Setter<KnowledgePointTreeNode[]>;
  setFacets: Setter<KnowledgePointFacets>;
  setLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setAllKnowledgePointsLoadError: Setter<string | null>;
  setKnowledgePointListLoadError: Setter<string | null>;
};

export function useAdminKnowledgePointsLoaders({
  queryRef,
  pageRef,
  pageSizeRef,
  allKnowledgePointsRequestIdRef,
  knowledgePointListRequestIdRef,
  hasAllKnowledgePointsSnapshotRef,
  hasKnowledgePointListSnapshotRef,
  handleAuthRequired,
  syncAllKnowledgePoints,
  syncList,
  syncMeta,
  setTree,
  setFacets,
  setLoading,
  setAuthRequired,
  setAllKnowledgePointsLoadError,
  setKnowledgePointListLoadError
}: AdminKnowledgePointsLoadersOptions) {
  const loadAllKnowledgePoints = useCallback(async () => {
    const requestId = allKnowledgePointsRequestIdRef.current + 1;
    allKnowledgePointsRequestIdRef.current = requestId;

    try {
      const payload = await requestJson<KnowledgePointListPayload>("/api/admin/knowledge-points");
      if (allKnowledgePointsRequestIdRef.current !== requestId) {
        return;
      }

      hasAllKnowledgePointsSnapshotRef.current = true;
      syncAllKnowledgePoints(payload.data ?? []);
      setAuthRequired(false);
      setAllKnowledgePointsLoadError(null);
    } catch (error) {
      if (allKnowledgePointsRequestIdRef.current !== requestId) {
        return;
      }

      if (!hasAllKnowledgePointsSnapshotRef.current) {
        syncAllKnowledgePoints([]);
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }
      setAllKnowledgePointsLoadError(getAdminKnowledgePointsErrorMessage(error, "知识点全集加载失败"));
    }
  }, [
    allKnowledgePointsRequestIdRef,
    handleAuthRequired,
    hasAllKnowledgePointsSnapshotRef,
    setAllKnowledgePointsLoadError,
    setAuthRequired,
    syncAllKnowledgePoints
  ]);

  const loadKnowledgePointList = useCallback(
    async (options?: { query?: KnowledgePointQuery; page?: number; pageSize?: number }) => {
      const requestId = knowledgePointListRequestIdRef.current + 1;
      knowledgePointListRequestIdRef.current = requestId;
      const nextQuery = options?.query ?? queryRef.current;
      const nextPage = options?.page ?? pageRef.current;
      const nextPageSize = options?.pageSize ?? pageSizeRef.current;

      setLoading(true);
      const searchParams = buildAdminKnowledgePointsSearchParams(nextQuery, nextPage, nextPageSize);

      try {
        const payload = await requestJson<KnowledgePointListPayload>(`/api/admin/knowledge-points?${searchParams.toString()}`);
        if (knowledgePointListRequestIdRef.current !== requestId) {
          return;
        }

        hasKnowledgePointListSnapshotRef.current = true;
        syncList(payload.data ?? []);
        syncMeta(
          payload.meta ?? {
            total: payload.data?.length ?? 0,
            page: nextPage,
            pageSize: nextPageSize,
            totalPages: 1
          }
        );
        setTree(payload.tree ?? []);
        setFacets({
          subjects: payload.facets?.subjects ?? [],
          grades: payload.facets?.grades ?? [],
          units: payload.facets?.units ?? [],
          chapters: payload.facets?.chapters ?? []
        });
        setAuthRequired(false);
        setKnowledgePointListLoadError(null);
      } catch (error) {
        if (knowledgePointListRequestIdRef.current !== requestId) {
          return;
        }

        if (!hasKnowledgePointListSnapshotRef.current) {
          syncList([]);
          syncMeta({
            total: 0,
            page: nextPage,
            pageSize: nextPageSize,
            totalPages: 1
          });
          setTree([]);
          setFacets(createInitialKnowledgePointFacets());
        }
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }
        setKnowledgePointListLoadError(getAdminKnowledgePointsErrorMessage(error, "知识点列表加载失败"));
      } finally {
        if (knowledgePointListRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [
      handleAuthRequired,
      hasKnowledgePointListSnapshotRef,
      knowledgePointListRequestIdRef,
      pageRef,
      pageSizeRef,
      queryRef,
      setAuthRequired,
      setFacets,
      setKnowledgePointListLoadError,
      setLoading,
      setTree,
      syncList,
      syncMeta
    ]
  );

  return {
    loadAllKnowledgePoints,
    loadKnowledgePointList
  };
}
