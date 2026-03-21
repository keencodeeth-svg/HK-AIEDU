"use client";

import { useAdminStepUp } from "@/components/useAdminStepUp";
import { useAdminQuestionsPageEffects } from "./useAdminQuestionsPageEffects";
import { useAdminQuestionsListActions } from "./useAdminQuestionsListActions";
import { useAdminQuestionsPageLoaders } from "./useAdminQuestionsPageLoaders";
import { useAdminQuestionsPageState } from "./useAdminQuestionsPageState";
import { useAdminQuestionsToolActions } from "./useAdminQuestionsToolActions";

export function useAdminQuestionsPage() {
  const { runWithStepUp, stepUpDialog } = useAdminStepUp();
  const pageState = useAdminQuestionsPageState();

  const {
    handleAuthRequired,
    removeQuestionFromCurrentPage,
    loadKnowledgePoints,
    loadQuestions
  } = useAdminQuestionsPageLoaders({
    knowledgePointsRequestIdRef: pageState.knowledgePointsRequestIdRef,
    questionsRequestIdRef: pageState.questionsRequestIdRef,
    importRequestIdRef: pageState.importRequestIdRef,
    aiRequestIdRef: pageState.aiRequestIdRef,
    createRequestIdRef: pageState.createRequestIdRef,
    listActionRequestIdRef: pageState.listActionRequestIdRef,
    recheckRequestIdRef: pageState.recheckRequestIdRef,
    queryRef: pageState.queryRef,
    pageRef: pageState.pageRef,
    pageSizeRef: pageState.pageSizeRef,
    hasKnowledgePointsSnapshotRef: pageState.hasKnowledgePointsSnapshotRef,
    setList: pageState.setList,
    setKnowledgePoints: pageState.setKnowledgePoints,
    setLoading: pageState.setLoading,
    setAiLoading: pageState.setAiLoading,
    setRecheckLoading: pageState.setRecheckLoading,
    setAuthRequired: pageState.setAuthRequired,
    setMeta: pageState.setMeta,
    setTree: pageState.setTree,
    setQualitySummary: pageState.setQualitySummary,
    setFacets: pageState.setFacets,
    setKnowledgePointsLoadError: pageState.setKnowledgePointsLoadError,
    setQuestionsLoadError: pageState.setQuestionsLoadError
  });

  useAdminQuestionsPageEffects({
    queryRef: pageState.queryRef,
    pageRef: pageState.pageRef,
    pageSizeRef: pageState.pageSizeRef,
    query: pageState.query,
    page: pageState.page,
    pageSize: pageState.pageSize,
    form: pageState.form,
    aiForm: pageState.aiForm,
    formKnowledgePoints: pageState.formKnowledgePoints,
    aiKnowledgePoints: pageState.aiKnowledgePoints,
    chapterOptions: pageState.chapterOptions,
    setForm: pageState.setForm,
    setAiForm: pageState.setAiForm,
    loadKnowledgePoints,
    loadQuestions
  });

  const { handleImport, handleGenerate, handleCreate } = useAdminQuestionsToolActions({
    aiForm: pageState.aiForm,
    form: pageState.form,
    knowledgePoints: pageState.knowledgePoints,
    runWithStepUp,
    handleAuthRequired,
    loadKnowledgePoints,
    loadQuestions,
    importRequestIdRef: pageState.importRequestIdRef,
    aiRequestIdRef: pageState.aiRequestIdRef,
    createRequestIdRef: pageState.createRequestIdRef,
    setImportMessage: pageState.setImportMessage,
    setImportErrors: pageState.setImportErrors,
    setPageActionError: pageState.setPageActionError,
    setAiMessage: pageState.setAiMessage,
    setAiErrors: pageState.setAiErrors,
    setAiLoading: pageState.setAiLoading,
    setCreateError: pageState.setCreateError,
    setForm: pageState.setForm
  });

  const { handleDelete, handleToggleIsolation, handleRecheckQuality } = useAdminQuestionsListActions({
    query: pageState.query,
    runWithStepUp,
    handleAuthRequired,
    loadQuestions,
    removeQuestionFromCurrentPage,
    listActionRequestIdRef: pageState.listActionRequestIdRef,
    recheckRequestIdRef: pageState.recheckRequestIdRef,
    setPageActionError: pageState.setPageActionError,
    setRecheckMessage: pageState.setRecheckMessage,
    setRecheckError: pageState.setRecheckError,
    setRecheckLoading: pageState.setRecheckLoading
  });

  return {
    stepUpDialog,
    authRequired: pageState.authRequired,
    list: pageState.list,
    knowledgePoints: pageState.knowledgePoints,
    workspace: pageState.workspace,
    setWorkspace: pageState.setWorkspace,
    loading: pageState.loading,
    query: pageState.query,
    page: pageState.page,
    setPage: pageState.setPage,
    pageSize: pageState.pageSize,
    setPageSize: pageState.setPageSize,
    meta: pageState.meta,
    tree: pageState.tree,
    qualitySummary: pageState.qualitySummary,
    facets: pageState.facets,
    importMessage: pageState.importMessage,
    importErrors: pageState.importErrors,
    form: pageState.form,
    setForm: pageState.setForm,
    aiForm: pageState.aiForm,
    setAiForm: pageState.setAiForm,
    aiLoading: pageState.aiLoading,
    aiMessage: pageState.aiMessage,
    aiErrors: pageState.aiErrors,
    recheckLoading: pageState.recheckLoading,
    recheckMessage: pageState.recheckMessage,
    recheckError: pageState.recheckError,
    createError: pageState.createError,
    pageActionError: pageState.pageActionError,
    loadError: pageState.loadError,
    chapterOptions: pageState.chapterOptions,
    aiKnowledgePoints: pageState.aiKnowledgePoints,
    formKnowledgePoints: pageState.formKnowledgePoints,
    patchQuery: pageState.patchQuery,
    handleImport,
    handleGenerate,
    handleCreate,
    handleDelete,
    handleToggleIsolation,
    handleRecheckQuality,
    pageStart: pageState.pageStart,
    pageEnd: pageState.pageEnd
  };
}
