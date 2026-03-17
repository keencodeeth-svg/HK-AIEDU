"use client";

import type { ComponentProps } from "react";
import NotificationExecutionLoopCard from "./_components/NotificationExecutionLoopCard";
import TeacherNotificationCommandCard from "./_components/TeacherNotificationCommandCard";
import TeacherNotificationConfigCard from "./_components/TeacherNotificationConfigCard";
import TeacherNotificationHeader from "./_components/TeacherNotificationHeader";
import TeacherNotificationHistoryCard from "./_components/TeacherNotificationHistoryCard";
import TeacherNotificationPreviewCard from "./_components/TeacherNotificationPreviewCard";
import { useTeacherNotificationRulesPage } from "./useTeacherNotificationRulesPage";
import { getSelectedClassLabel } from "./utils";

export function useTeacherNotificationRulesPageView() {
  const page = useTeacherNotificationRulesPage();

  const headerProps: ComponentProps<typeof TeacherNotificationHeader> = {
    selectedClassLabel: getSelectedClassLabel(page.selectedClass),
    configuredRuleCount: page.configuredRuleCount,
    enabledRuleCount: page.enabledRuleCount,
    assignmentTargets: page.preview?.summary.assignmentTargets || null,
    lastLoadedAt: page.lastLoadedAt,
    refreshing: page.refreshing,
    disabled: page.refreshing || page.saving || page.running || page.previewing || page.historyLoading,
    onRefresh: () => {
      void page.load("refresh");
    }
  };

  const executionLoopCardProps: ComponentProps<typeof NotificationExecutionLoopCard> = {
    selectedClass: page.selectedClass,
    draftRule: page.draftRule,
    preview: page.preview,
    latestHistory: page.latestHistory,
    hasUnsavedChanges: page.hasUnsavedChanges
  };

  const configCardProps: ComponentProps<typeof TeacherNotificationConfigCard> = {
    classes: page.classes,
    classId: page.classId,
    selectedClass: page.selectedClass,
    draftRule: page.draftRule,
    hasUnsavedChanges: page.hasUnsavedChanges,
    isPreviewCurrent: page.isPreviewCurrent,
    preview: page.preview,
    saving: page.saving,
    running: page.running,
    previewing: page.previewing,
    onClassChange: (nextClassId) => {
      void page.handleClassChange(nextClassId);
    },
    onUpdateDraft: page.updateDraft,
    onReset: () => {
      void page.handleReset();
    },
    onPreview: () => {
      void page.handlePreview();
    },
    onSave: () => {
      void page.handleSave();
    },
    onRun: () => {
      void page.handleRun();
    }
  };

  const commandCardProps: ComponentProps<typeof TeacherNotificationCommandCard> = {
    preview: page.preview,
    historySummary: page.historySummary,
    commandState: page.commandState,
    previewTargetDelta: page.previewTargetDelta,
    latestClassResult: page.latestClassResult
  };

  const previewCardProps: ComponentProps<typeof TeacherNotificationPreviewCard> = {
    previewing: page.previewing,
    preview: page.preview,
    overdueAssignments: page.overdueAssignments,
    dueSoonAssignments: page.dueSoonAssignments
  };

  const historyCardProps: ComponentProps<typeof TeacherNotificationHistoryCard> = {
    historyLoading: page.historyLoading,
    history: page.history,
    historySummary: page.historySummary,
    latestHistory: page.latestHistory,
    classId: page.classId
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasClasses: page.classes.length > 0,
    loadError: page.loadError,
    actionError: page.actionError,
    message: page.message,
    classId: page.classId,
    isPreviewCurrent: page.isPreviewCurrent,
    headerProps,
    executionLoopCardProps,
    configCardProps,
    commandCardProps,
    previewCardProps,
    historyCardProps,
    reload: () => {
      void page.load("refresh");
    }
  };
}
