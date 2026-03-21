"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ClassItem,
  LibraryAiFormState,
  LibraryAuthResponse,
  LibraryContentFilter,
  LibraryFacets,
  LibraryItem,
  LibraryListResponse,
  LibraryMeta,
  LibrarySummary,
  LibraryUser,
  TeacherClassesResponse
} from "./types";
import { getLibraryPageBaseRequestMessage } from "./request-helpers";
import {
  buildLibraryListSearchParams,
  getLibraryNoStoreRequestInit,
  normalizeLibraryListSnapshot,
  resolveLibraryAiClassId
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type SyncState<T> = (next: T) => void;

type LibraryPageLoadersOptions = {
  userRequestIdRef: MutableRefObject<number>;
  listRequestIdRef: MutableRefObject<number>;
  classesRequestIdRef: MutableRefObject<number>;
  hasListSnapshotRef: MutableRefObject<boolean>;
  pageRef: MutableRefObject<number>;
  pageSizeRef: MutableRefObject<number>;
  subjectFilterRef: MutableRefObject<string>;
  contentFilterRef: MutableRefObject<LibraryContentFilter>;
  keywordRef: MutableRefObject<string>;
  syncUser: SyncState<LibraryUser>;
  syncItems: SyncState<LibraryItem[]>;
  syncClasses: SyncState<ClassItem[]>;
  syncMeta: SyncState<LibraryMeta>;
  syncFacets: SyncState<LibraryFacets>;
  syncSummary: SyncState<LibrarySummary>;
  setPage: Setter<number>;
  setAiForm: Setter<LibraryAiFormState>;
  setLoading: Setter<boolean>;
  setAuthRequired: Setter<boolean>;
  setPageError: Setter<string | null>;
  setPageReady: Setter<boolean>;
  setBootstrapNotice: Setter<string | null>;
  setClassesNotice: Setter<string | null>;
  setListNotice: Setter<string | null>;
};

export function useLibraryPageLoaders({
  userRequestIdRef,
  listRequestIdRef,
  classesRequestIdRef,
  hasListSnapshotRef,
  pageRef,
  pageSizeRef,
  subjectFilterRef,
  contentFilterRef,
  keywordRef,
  syncUser,
  syncItems,
  syncClasses,
  syncMeta,
  syncFacets,
  syncSummary,
  setPage,
  setAiForm,
  setLoading,
  setAuthRequired,
  setPageError,
  setPageReady,
  setBootstrapNotice,
  setClassesNotice,
  setListNotice
}: LibraryPageLoadersOptions) {
  const loadUser = useCallback(async () => {
    const requestId = userRequestIdRef.current + 1;
    userRequestIdRef.current = requestId;

    try {
      const payload = await requestJson<LibraryAuthResponse>(
        "/api/auth/me",
        getLibraryNoStoreRequestInit()
      );
      if (userRequestIdRef.current !== requestId) {
        return false;
      }
      syncUser(payload.user ?? payload.data ?? null);
      setAuthRequired(false);
      setBootstrapNotice(null);
      return true;
    } catch (nextError) {
      if (userRequestIdRef.current !== requestId) {
        return false;
      }
      if (isAuthError(nextError)) {
        syncUser(null);
        setAuthRequired(true);
        return false;
      }

      syncUser(null);
      setBootstrapNotice(
        `用户身份同步失败：${getLibraryPageBaseRequestMessage(
          nextError,
          "教师和管理操作面板可能暂时不可用。"
        )}`
      );
      return false;
    }
  }, [setAuthRequired, setBootstrapNotice, syncUser, userRequestIdRef]);

  const loadItems = useCallback(async (options?: { noticePrefix?: string }) => {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    setLoading(true);
    setPageError(null);

    const page = pageRef.current;
    const pageSize = pageSizeRef.current;
    const subjectFilter = subjectFilterRef.current;
    const contentFilter = contentFilterRef.current;
    const keyword = keywordRef.current;

    try {
      const params = buildLibraryListSearchParams(page, pageSize, subjectFilter, contentFilter, keyword);
      const payload = await requestJson<LibraryListResponse>(
        `/api/library?${params.toString()}`,
        getLibraryNoStoreRequestInit()
      );

      if (listRequestIdRef.current !== requestId) {
        return false;
      }

      const nextSnapshot = normalizeLibraryListSnapshot(payload, page, pageSize);
      syncItems(nextSnapshot.items);
      syncMeta(nextSnapshot.meta);
      syncFacets(nextSnapshot.facets);
      syncSummary(nextSnapshot.summary);
      if (nextSnapshot.meta.page !== page) {
        setPage(nextSnapshot.meta.page);
      }
      hasListSnapshotRef.current = true;
      setPageReady(true);
      setAuthRequired(false);
      setListNotice(null);
      return true;
    } catch (nextError) {
      if (listRequestIdRef.current !== requestId) {
        return false;
      }

      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return false;
      }

      const nextMessage = getLibraryPageBaseRequestMessage(nextError, "资料加载失败");
      if (hasListSnapshotRef.current) {
        setListNotice(
          options?.noticePrefix
            ? `${options.noticePrefix}：${nextMessage}`
            : `最新资料刷新失败：${nextMessage}`
        );
        return false;
      }

      setPageError(nextMessage);
      return false;
    } finally {
      if (listRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    contentFilterRef,
    hasListSnapshotRef,
    keywordRef,
    listRequestIdRef,
    pageRef,
    pageSizeRef,
    setAuthRequired,
    setListNotice,
    setLoading,
    setPage,
    setPageError,
    setPageReady,
    subjectFilterRef,
    syncFacets,
    syncItems,
    syncMeta,
    syncSummary
  ]);

  const loadTeacherClasses = useCallback(async (userRole?: string) => {
    const requestId = classesRequestIdRef.current + 1;
    classesRequestIdRef.current = requestId;

    if (userRole !== "teacher") {
      syncClasses([]);
      setClassesNotice(null);
      setAiForm((prev) => (prev.classId ? { ...prev, classId: "" } : prev));
      return;
    }

    try {
      const payload = await requestJson<TeacherClassesResponse>(
        "/api/teacher/classes",
        getLibraryNoStoreRequestInit()
      );
      if (classesRequestIdRef.current !== requestId) {
        return;
      }

      const nextClasses = Array.isArray(payload.data) ? payload.data : [];
      syncClasses(nextClasses);
      setClassesNotice(null);
      setAiForm((prev) => {
        const nextClassId = resolveLibraryAiClassId(nextClasses, prev.classId);
        return nextClassId === prev.classId ? prev : { ...prev, classId: nextClassId };
      });
      setAuthRequired(false);
    } catch (nextError) {
      if (classesRequestIdRef.current !== requestId) {
        return;
      }
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        return;
      }
      syncClasses([]);
      setClassesNotice(
        `班级列表同步失败：${getLibraryPageBaseRequestMessage(nextError, "暂时无法拉取教师班级。")}`
      );
      setAiForm((prev) => (prev.classId ? { ...prev, classId: "" } : prev));
    }
  }, [classesRequestIdRef, setAiForm, setAuthRequired, setClassesNotice, syncClasses]);

  return {
    loadUser,
    loadItems,
    loadTeacherClasses
  };
}
