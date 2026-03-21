"use client";

import { useAdminStepUp } from "@/components/useAdminStepUp";
import { useAdminKnowledgePointsActions } from "./useAdminKnowledgePointsActions";
import { useAdminKnowledgePointsPageEffects } from "./useAdminKnowledgePointsPageEffects";
import { useAdminKnowledgePointsPageState } from "./useAdminKnowledgePointsPageState";
import { useAdminKnowledgePointsLoaders } from "./useAdminKnowledgePointsLoaders";

export function useAdminKnowledgePointsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const pageState = useAdminKnowledgePointsPageState();

  const { loadAllKnowledgePoints, loadKnowledgePointList } = useAdminKnowledgePointsLoaders({
    queryRef: pageState.queryRef,
    pageRef: pageState.pageRef,
    pageSizeRef: pageState.pageSizeRef,
    allKnowledgePointsRequestIdRef: pageState.allKnowledgePointsRequestIdRef,
    knowledgePointListRequestIdRef: pageState.knowledgePointListRequestIdRef,
    hasAllKnowledgePointsSnapshotRef: pageState.hasAllKnowledgePointsSnapshotRef,
    hasKnowledgePointListSnapshotRef: pageState.hasKnowledgePointListSnapshotRef,
    handleAuthRequired: pageState.handleAuthRequired,
    syncAllKnowledgePoints: pageState.syncAllKnowledgePoints,
    syncList: pageState.syncList,
    syncMeta: pageState.syncMeta,
    setTree: pageState.setTree,
    setFacets: pageState.setFacets,
    setLoading: pageState.setLoading,
    setAuthRequired: pageState.setAuthRequired,
    setAllKnowledgePointsLoadError: pageState.setAllKnowledgePointsLoadError,
    setKnowledgePointListLoadError: pageState.setKnowledgePointListLoadError
  });

  useAdminKnowledgePointsPageEffects({
    query: pageState.query,
    page: pageState.page,
    pageSize: pageState.pageSize,
    loadAllKnowledgePoints,
    loadKnowledgePointList
  });

  const actions = useAdminKnowledgePointsActions({
    form: pageState.form,
    aiForm: pageState.aiForm,
    treeForm: pageState.treeForm,
    batchForm: pageState.batchForm,
    batchPreview: pageState.batchPreview,
    runWithStepUp,
    handleAuthRequired: pageState.handleAuthRequired,
    loadAllKnowledgePoints,
    loadKnowledgePointList,
    removeKnowledgePointFromState: pageState.removeKnowledgePointFromState,
    createRequestIdRef: pageState.createRequestIdRef,
    aiRequestIdRef: pageState.aiRequestIdRef,
    treeRequestIdRef: pageState.treeRequestIdRef,
    batchPreviewRequestIdRef: pageState.batchPreviewRequestIdRef,
    batchConfirmRequestIdRef: pageState.batchConfirmRequestIdRef,
    deleteRequestIdRef: pageState.deleteRequestIdRef,
    setForm: pageState.setForm,
    setFormError: pageState.setFormError,
    setPageActionError: pageState.setPageActionError,
    setAiLoading: pageState.setAiLoading,
    setAiMessage: pageState.setAiMessage,
    setAiErrors: pageState.setAiErrors,
    setTreeLoading: pageState.setTreeLoading,
    setTreeMessage: pageState.setTreeMessage,
    setTreeErrors: pageState.setTreeErrors,
    setBatchLoading: pageState.setBatchLoading,
    setBatchError: pageState.setBatchError,
    setBatchMessage: pageState.setBatchMessage,
    setBatchProgress: pageState.setBatchProgress,
    setBatchPreview: pageState.setBatchPreview,
    setBatchConfirming: pageState.setBatchConfirming
  });

  return {
    authRequired: pageState.authRequired,
    workspace: pageState.workspace,
    setWorkspace: pageState.setWorkspace,
    list: pageState.list,
    loading: pageState.loading,
    query: pageState.query,
    page: pageState.page,
    setPage: pageState.setPage,
    pageSize: pageState.pageSize,
    setPageSize: pageState.setPageSize,
    meta: pageState.meta,
    tree: pageState.tree,
    facets: pageState.facets,
    form: pageState.form,
    setForm: pageState.setForm,
    formError: pageState.formError,
    aiForm: pageState.aiForm,
    setAiForm: pageState.setAiForm,
    chapterOptions: pageState.chapterOptions,
    aiLoading: pageState.aiLoading,
    aiMessage: pageState.aiMessage,
    aiErrors: pageState.aiErrors,
    treeForm: pageState.treeForm,
    setTreeForm: pageState.setTreeForm,
    treeLoading: pageState.treeLoading,
    treeMessage: pageState.treeMessage,
    treeErrors: pageState.treeErrors,
    batchForm: pageState.batchForm,
    setBatchForm: pageState.setBatchForm,
    batchLoading: pageState.batchLoading,
    batchError: pageState.batchError,
    batchMessage: pageState.batchMessage,
    batchProgress: pageState.batchProgress,
    batchPreview: pageState.batchPreview,
    batchShowDetail: pageState.batchShowDetail,
    setBatchShowDetail: pageState.setBatchShowDetail,
    batchConfirming: pageState.batchConfirming,
    loadError: pageState.loadError,
    pageActionError: pageState.pageActionError,
    pageStart: pageState.pageStart,
    pageEnd: pageState.pageEnd,
    patchQuery: pageState.patchQuery,
    clearBatchPreview: pageState.clearBatchPreview,
    handleCreate: actions.handleCreate,
    handleAiGenerate: actions.handleAiGenerate,
    handleTreeGenerate: actions.handleTreeGenerate,
    handleBatchPreview: actions.handleBatchPreview,
    handleBatchConfirm: actions.handleBatchConfirm,
    handleDelete: actions.handleDelete,
    stepUpDialog
  };
}
