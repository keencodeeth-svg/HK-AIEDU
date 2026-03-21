"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  LibraryAnnotation,
  LibraryAnnotationListResponse,
  LibraryAuthResponse,
  LibraryDetailAuthUser,
  LibraryDetailItem,
  LibraryDetailResponse,
  LibraryKnowledgePoint,
  LibraryKnowledgePointListResponse
} from "../types";
import {
  getLibraryDetailNoStoreRequestInit,
  getLibraryDetailRequestMessage,
  isMissingLibraryItemError
} from "../detail-utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

export type LibraryLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "error" | "loaded" | "stale";
};

type LibraryDetailPageLoadersOptions = {
  id: string;
  loadRequestIdRef: MutableRefObject<number>;
  hasItemSnapshotRef: MutableRefObject<boolean>;
  hasAnnotationsSnapshotRef: MutableRefObject<boolean>;
  hasUserSnapshotRef: MutableRefObject<boolean>;
  hasKnowledgePointsSnapshotRef: MutableRefObject<boolean>;
  clearLibraryItemState: () => void;
  clearAnnotationsState: () => void;
  clearUserState: () => void;
  clearKnowledgePointsState: () => void;
  clearLibraryPageState: () => void;
  handleAuthRequired: () => void;
  setItem: Setter<LibraryDetailItem | null>;
  setAnnotations: Setter<LibraryAnnotation[]>;
  setUser: Setter<LibraryDetailAuthUser>;
  setKnowledgePoints: Setter<LibraryKnowledgePoint[]>;
  setLoading: Setter<boolean>;
  setRefreshing: Setter<boolean>;
  setPageError: Setter<string | null>;
  setAuthRequired: Setter<boolean>;
  setLastLoadedAt: Setter<string | null>;
};

export function useLibraryDetailPageLoaders({
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
}: LibraryDetailPageLoadersOptions) {
  const load = useCallback(async (mode: "initial" | "refresh" = "initial"): Promise<LibraryLoadResult> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const noStoreRequestInit = getLibraryDetailNoStoreRequestInit();
      const [itemResult, annotationsResult, authResult, knowledgePointsResult] = await Promise.allSettled([
        requestJson<LibraryDetailResponse>(`/api/library/${id}`, noStoreRequestInit),
        requestJson<LibraryAnnotationListResponse>(`/api/library/${id}/annotations`, noStoreRequestInit),
        requestJson<LibraryAuthResponse>("/api/auth/me", noStoreRequestInit),
        requestJson<LibraryKnowledgePointListResponse>("/api/knowledge-points", noStoreRequestInit)
      ]);

      if (loadRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }

      const authFailure = [itemResult, annotationsResult, authResult, knowledgePointsResult].some(
        (result) => result.status === "rejected" && isAuthError(result.reason)
      );

      if (authFailure) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }

      let hasSuccess = false;
      const nextErrors: string[] = [];

      if (itemResult.status === "fulfilled" && itemResult.value.data) {
        hasItemSnapshotRef.current = true;
        setItem(itemResult.value.data);
        hasSuccess = true;
      } else {
        const itemErrorMessage =
          itemResult.status === "rejected"
            ? getLibraryDetailRequestMessage(itemResult.reason, "加载资料详情失败")
            : itemResult.value.error?.trim() || "加载资料详情失败";

        if (
          (itemResult.status === "rejected" && isMissingLibraryItemError(itemResult.reason)) ||
          !hasItemSnapshotRef.current
        ) {
          clearLibraryPageState();
          setAuthRequired(false);
          setPageError(itemErrorMessage);
          return { status: "error", errorMessage: itemErrorMessage, hasSuccess: false };
        }

        nextErrors.push(`资料详情加载失败：${itemErrorMessage}`);
      }

      if (annotationsResult.status === "fulfilled") {
        hasAnnotationsSnapshotRef.current = true;
        setAnnotations(annotationsResult.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasAnnotationsSnapshotRef.current) {
          clearAnnotationsState();
        }
        nextErrors.push(
          `标注加载失败：${getLibraryDetailRequestMessage(annotationsResult.reason, "加载标注失败")}`
        );
      }

      if (authResult.status === "fulfilled") {
        hasUserSnapshotRef.current = true;
        setUser(authResult.value.user ?? authResult.value.data ?? null);
        hasSuccess = true;
      } else {
        if (!hasUserSnapshotRef.current) {
          clearUserState();
        }
        nextErrors.push(
          `登录信息同步失败：${getLibraryDetailRequestMessage(authResult.reason, "同步登录信息失败")}`
        );
      }

      if (knowledgePointsResult.status === "fulfilled") {
        hasKnowledgePointsSnapshotRef.current = true;
        setKnowledgePoints(knowledgePointsResult.value.data ?? []);
        hasSuccess = true;
      } else {
        if (!hasKnowledgePointsSnapshotRef.current) {
          clearKnowledgePointsState();
        }
        nextErrors.push(
          `知识点列表加载失败：${getLibraryDetailRequestMessage(
            knowledgePointsResult.reason,
            "加载知识点列表失败"
          )}`
        );
      }

      setAuthRequired(false);
      if (hasSuccess) {
        setLastLoadedAt(new Date().toISOString());
      }
      if (nextErrors.length) {
        setPageError(nextErrors.join("；"));
      }

      return {
        status: nextErrors.length ? "error" : "loaded",
        errorMessage: nextErrors.length ? nextErrors.join("；") : null,
        hasSuccess
      };
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return { status: "stale", errorMessage: null, hasSuccess: false };
      }
      if (isAuthError(error)) {
        handleAuthRequired();
        return { status: "auth", errorMessage: null, hasSuccess: false };
      }
      if (isMissingLibraryItemError(error)) {
        clearLibraryPageState();
        setAuthRequired(false);
        const errorMessage = getLibraryDetailRequestMessage(error, "加载资料详情失败");
        setPageError(errorMessage);
        return { status: "error", errorMessage, hasSuccess: false };
      }

      if (!hasItemSnapshotRef.current) {
        clearLibraryItemState();
      }
      if (!hasAnnotationsSnapshotRef.current) {
        clearAnnotationsState();
      }
      if (!hasUserSnapshotRef.current) {
        clearUserState();
      }
      if (!hasKnowledgePointsSnapshotRef.current) {
        clearKnowledgePointsState();
      }

      const errorMessage = getLibraryDetailRequestMessage(error, "加载资料详情失败");
      setAuthRequired(false);
      setPageError(errorMessage);
      return {
        status: "error",
        errorMessage,
        hasSuccess:
          hasItemSnapshotRef.current ||
          hasAnnotationsSnapshotRef.current ||
          hasUserSnapshotRef.current ||
          hasKnowledgePointsSnapshotRef.current
      };
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    clearAnnotationsState,
    clearKnowledgePointsState,
    clearLibraryItemState,
    clearLibraryPageState,
    clearUserState,
    handleAuthRequired,
    hasAnnotationsSnapshotRef,
    hasItemSnapshotRef,
    hasKnowledgePointsSnapshotRef,
    hasUserSnapshotRef,
    id,
    loadRequestIdRef,
    setAnnotations,
    setAuthRequired,
    setItem,
    setKnowledgePoints,
    setLastLoadedAt,
    setLoading,
    setPageError,
    setRefreshing,
    setUser
  ]);

  return {
    load
  };
}
