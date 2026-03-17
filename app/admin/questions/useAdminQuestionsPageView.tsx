"use client";

import type { ComponentProps } from "react";
import QuestionsListPanel from "./_components/QuestionsListPanel";
import QuestionsToolsPanel from "./_components/QuestionsToolsPanel";
import { downloadQuestionTemplate } from "./utils";
import { useAdminQuestionsPage } from "./useAdminQuestionsPage";

export function useAdminQuestionsPageView() {
  const page = useAdminQuestionsPage();

  const toolsPanelProps: ComponentProps<typeof QuestionsToolsPanel> = {
    importMessage: page.importMessage,
    importErrors: page.importErrors,
    onDownloadTemplate: downloadQuestionTemplate,
    onImport: async (file) => {
      await page.handleImport(file);
    },
    aiForm: page.aiForm,
    setAiForm: page.setAiForm,
    aiKnowledgePoints: page.aiKnowledgePoints,
    chapterOptions: page.chapterOptions,
    aiLoading: page.aiLoading,
    aiMessage: page.aiMessage,
    aiErrors: page.aiErrors,
    onGenerate: async (event) => {
      await page.handleGenerate(event);
    },
    form: page.form,
    setForm: page.setForm,
    knowledgePoints: page.formKnowledgePoints,
    createError: page.createError,
    onCreate: async (event) => {
      await page.handleCreate(event);
    }
  };

  const listPanelProps: ComponentProps<typeof QuestionsListPanel> = {
    query: page.query,
    patchQuery: page.patchQuery,
    facets: page.facets,
    tree: page.tree,
    qualitySummary: page.qualitySummary,
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
    },
    onToggleIsolation: async (id, isolated) => {
      await page.handleToggleIsolation(id, isolated);
    },
    recheckLoading: page.recheckLoading,
    recheckMessage: page.recheckMessage,
    recheckError: page.recheckError,
    onRecheckQuality: async () => {
      await page.handleRecheckQuality();
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
