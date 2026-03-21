"use client";

import { useCallback } from "react";
import { useAdminStepUp } from "@/components/useAdminStepUp";
import { useLibraryPageActions } from "./useLibraryPageActions";
import { useLibraryPageEffects } from "./useLibraryPageEffects";
import { useLibraryPageLoaders } from "./useLibraryPageLoaders";
import { useLibraryPageState } from "./useLibraryPageState";

export function useLibraryPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const pageState = useLibraryPageState();
  const { setError, setPageError } = pageState;

  const { loadUser, loadItems, loadTeacherClasses } = useLibraryPageLoaders({
    userRequestIdRef: pageState.userRequestIdRef,
    listRequestIdRef: pageState.listRequestIdRef,
    classesRequestIdRef: pageState.classesRequestIdRef,
    hasListSnapshotRef: pageState.hasListSnapshotRef,
    pageRef: pageState.pageRef,
    pageSizeRef: pageState.pageSizeRef,
    subjectFilterRef: pageState.subjectFilterRef,
    contentFilterRef: pageState.contentFilterRef,
    keywordRef: pageState.keywordRef,
    syncUser: pageState.syncUser,
    syncItems: pageState.syncItems,
    syncClasses: pageState.syncClasses,
    syncMeta: pageState.syncMeta,
    syncFacets: pageState.syncFacets,
    syncSummary: pageState.syncSummary,
    setPage: pageState.setPage,
    setAiForm: pageState.setAiForm,
    setLoading: pageState.setLoading,
    setAuthRequired: pageState.setAuthRequired,
    setPageError: pageState.setPageError,
    setPageReady: pageState.setPageReady,
    setBootstrapNotice: pageState.setBootstrapNotice,
    setClassesNotice: pageState.setClassesNotice,
    setListNotice: pageState.setListNotice
  });

  useLibraryPageEffects({
    contentFilter: pageState.contentFilter,
    keyword: pageState.keyword,
    page: pageState.page,
    pageSize: pageState.pageSize,
    subjectFilter: pageState.subjectFilter,
    userRole: pageState.user?.role,
    loadUser,
    loadItems,
    loadTeacherClasses
  });

  const reload = useCallback(async () => {
    setPageError(null);
    setError(null);
    await Promise.allSettled([loadUser(), loadItems()]);
  }, [loadItems, loadUser, setError, setPageError]);

  const actions = useLibraryPageActions({
    user: pageState.user,
    importForm: pageState.importForm,
    importFile: pageState.importFile,
    batchFile: pageState.batchFile,
    aiForm: pageState.aiForm,
    runWithStepUp,
    loadItems,
    removeItemFromSnapshot: pageState.removeItemFromSnapshot,
    setAuthRequired: pageState.setAuthRequired,
    setMessage: pageState.setMessage,
    setError: pageState.setError,
    setImportForm: pageState.setImportForm,
    setImportFile: pageState.setImportFile,
    setBatchPreview: pageState.setBatchPreview,
    setBatchSummary: pageState.setBatchSummary,
    setBatchFailedPreview: pageState.setBatchFailedPreview,
    setAiForm: pageState.setAiForm,
    setDeletingId: pageState.setDeletingId,
    setBatchFile: pageState.setBatchFile
  });

  return {
    user: pageState.user,
    classes: pageState.classes,
    items: pageState.items,
    loading: pageState.loading,
    authRequired: pageState.authRequired,
    pageError: pageState.pageError,
    pageReady: pageState.pageReady,
    bootstrapNotice: pageState.bootstrapNotice,
    classesNotice: pageState.classesNotice,
    listNotice: pageState.listNotice,
    message: pageState.message,
    error: pageState.error,
    importForm: pageState.importForm,
    setImportForm: pageState.setImportForm,
    setImportFile: pageState.setImportFile,
    batchPreview: pageState.batchPreview,
    batchSummary: pageState.batchSummary,
    batchFailedPreview: pageState.batchFailedPreview,
    aiForm: pageState.aiForm,
    setAiForm: pageState.setAiForm,
    subjectList: pageState.subjectList,
    facets: pageState.facets,
    subjectFilter: pageState.subjectFilter,
    setSubjectFilter: pageState.setSubjectFilter,
    contentFilter: pageState.contentFilter,
    setContentFilter: pageState.setContentFilter,
    keyword: pageState.keyword,
    setKeyword: pageState.setKeyword,
    pageSize: pageState.pageSize,
    setPageSize: pageState.setPageSize,
    meta: pageState.meta,
    summary: pageState.summary,
    deletingId: pageState.deletingId,
    expandedSubjects: pageState.expandedSubjects,
    expandedTypeKeys: pageState.expandedTypeKeys,
    libraryViewMode: pageState.libraryViewMode,
    setLibraryViewMode: pageState.setLibraryViewMode,
    groupedBySubject: pageState.groupedBySubject,
    stepUpDialog,
    reload,
    setPage: pageState.setPage,
    toggleExpandedSubject: pageState.toggleExpandedSubject,
    toggleExpandedType: pageState.toggleExpandedType,
    setAllSubjectsExpanded: pageState.setAllSubjectsExpanded,
    setAllTypesExpanded: pageState.setAllTypesExpanded,
    ...actions
  };
}
