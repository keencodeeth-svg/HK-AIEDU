"use client";

import type { ComponentProps } from "react";
import LibraryAdminImportPanel from "./_components/LibraryAdminImportPanel";
import LibraryAiGeneratePanel from "./_components/LibraryAiGeneratePanel";
import LibraryBatchImportPanel from "./_components/LibraryBatchImportPanel";
import LibraryFiltersPanel from "./_components/LibraryFiltersPanel";
import LibraryListPanel from "./_components/LibraryListPanel";
import { useLibraryPage } from "./useLibraryPage";

export function useLibraryPageView() {
  const page = useLibraryPage();

  const adminImportPanelProps: ComponentProps<typeof LibraryAdminImportPanel> = {
    importForm: page.importForm,
    setImportForm: page.setImportForm,
    setImportFile: page.setImportFile,
    onSubmit: page.submitImport
  };

  const batchImportPanelProps: ComponentProps<typeof LibraryBatchImportPanel> = {
    batchPreview: page.batchPreview,
    batchSummary: page.batchSummary,
    batchFailedPreview: page.batchFailedPreview,
    onDownloadBatchTemplate: page.downloadBatchTemplate,
    onBatchFileChange: page.handleBatchFileChange,
    onSubmit: page.submitBatchImport
  };

  const aiGeneratePanelProps: ComponentProps<typeof LibraryAiGeneratePanel> = {
    classes: page.classes,
    aiForm: page.aiForm,
    setAiForm: page.setAiForm,
    onSubmit: page.submitAiGenerate
  };

  const filtersPanelProps: ComponentProps<typeof LibraryFiltersPanel> = {
    subjectList: page.subjectList,
    facets: page.facets,
    subjectFilter: page.subjectFilter,
    setSubjectFilter: page.setSubjectFilter,
    contentFilter: page.contentFilter,
    setContentFilter: page.setContentFilter,
    keyword: page.keyword,
    setKeyword: page.setKeyword,
    pageSize: page.pageSize,
    setPageSize: page.setPageSize,
    meta: page.meta,
    summary: page.summary,
    loading: page.loading,
    onPrevPage: () => page.setPage((prev) => Math.max(1, prev - 1)),
    onNextPage: () => page.setPage((prev) => prev + 1)
  };

  const listPanelProps: ComponentProps<typeof LibraryListPanel> = {
    loading: page.loading,
    groupedBySubject: page.groupedBySubject,
    expandedSubjects: page.expandedSubjects,
    expandedTypeKeys: page.expandedTypeKeys,
    libraryViewMode: page.libraryViewMode,
    userRole: page.user?.role,
    deletingId: page.deletingId,
    itemsCount: page.items.length,
    totalCount: page.meta.total,
    onSetLibraryViewMode: page.setLibraryViewMode,
    onSetAllSubjectsExpanded: page.setAllSubjectsExpanded,
    onSetAllTypesExpanded: page.setAllTypesExpanded,
    onToggleExpandedSubject: page.toggleExpandedSubject,
    onToggleExpandedType: page.toggleExpandedType,
    onDownloadItem: (item) => {
      void page.downloadItem(item);
    },
    onRemoveItem: (item) => {
      void page.removeItem(item);
    }
  };

  return {
    userRole: page.user?.role,
    authRequired: page.authRequired,
    pageError: page.pageError,
    pageLoading: page.loading && !page.pageReady && !page.authRequired,
    bootstrapNotice: page.bootstrapNotice,
    classesNotice: page.classesNotice,
    listNotice: page.listNotice,
    error: page.error,
    message: page.message,
    stepUpDialog: page.stepUpDialog,
    reload: page.reload,
    adminImportPanelProps,
    batchImportPanelProps,
    aiGeneratePanelProps,
    filtersPanelProps,
    listPanelProps
  };
}
