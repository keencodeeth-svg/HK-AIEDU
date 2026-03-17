"use client";

import type { ComponentProps } from "react";
import KnowledgePointsListPanel from "./_components/KnowledgePointsListPanel";
import KnowledgePointsToolsPanel from "./_components/KnowledgePointsToolsPanel";
import { useAdminKnowledgePointsPage } from "./useAdminKnowledgePointsPage";

export function useAdminKnowledgePointsPageView() {
  const page = useAdminKnowledgePointsPage();

  const toolsPanelProps: ComponentProps<typeof KnowledgePointsToolsPanel> = {
    batchForm: page.batchForm,
    setBatchForm: page.setBatchForm,
    batchLoading: page.batchLoading,
    batchError: page.batchError,
    batchMessage: page.batchMessage,
    batchProgress: page.batchProgress,
    batchPreview: page.batchPreview,
    batchShowDetail: page.batchShowDetail,
    setBatchShowDetail: page.setBatchShowDetail,
    batchConfirming: page.batchConfirming,
    onBatchPreview: async (event) => {
      await page.handleBatchPreview(event);
    },
    onBatchConfirm: async () => {
      await page.handleBatchConfirm();
    },
    onClearBatchPreview: page.clearBatchPreview,
    treeForm: page.treeForm,
    setTreeForm: page.setTreeForm,
    treeLoading: page.treeLoading,
    treeMessage: page.treeMessage,
    treeErrors: page.treeErrors,
    onTreeGenerate: async (event) => {
      await page.handleTreeGenerate(event);
    },
    aiForm: page.aiForm,
    setAiForm: page.setAiForm,
    chapterOptions: page.chapterOptions,
    aiLoading: page.aiLoading,
    aiMessage: page.aiMessage,
    aiErrors: page.aiErrors,
    onAiGenerate: async (event) => {
      await page.handleAiGenerate(event);
    },
    form: page.form,
    setForm: page.setForm,
    formError: page.formError,
    onCreate: async (event) => {
      await page.handleCreate(event);
    }
  };

  const listPanelProps: ComponentProps<typeof KnowledgePointsListPanel> = {
    query: page.query,
    patchQuery: page.patchQuery,
    facets: page.facets,
    tree: page.tree,
    loading: page.loading,
    list: page.list,
    meta: page.meta,
    pageSize: page.pageSize,
    setPageSize: page.setPageSize,
    setPage: page.setPage,
    pageStart: page.pageStart,
    pageEnd: page.pageEnd,
    onDelete: async (id) => {
      await page.handleDelete(id);
    }
  };

  return {
    authRequired: page.authRequired,
    workspace: page.workspace,
    setWorkspace: page.setWorkspace,
    loadError: page.loadError,
    pageActionError: page.pageActionError,
    toolsPanelProps,
    listPanelProps,
    stepUpDialog: page.stepUpDialog
  };
}
