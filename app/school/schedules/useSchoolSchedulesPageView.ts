"use client";

import type { ComponentProps } from "react";
import { SchoolSchedulesAiPanel } from "./_components/SchoolSchedulesAiPanel";
import { SchoolSchedulesCoverageCard } from "./_components/SchoolSchedulesCoverageCard";
import { SchoolSchedulesFiltersCard } from "./_components/SchoolSchedulesFiltersCard";
import { SchoolSchedulesHeader } from "./_components/SchoolSchedulesHeader";
import { SchoolSchedulesManualEditorCard } from "./_components/SchoolSchedulesManualEditorCard";
import { SchoolSchedulesOverviewCard } from "./_components/SchoolSchedulesOverviewCard";
import { SchoolScheduleTeacherRulesCard } from "./_components/SchoolScheduleTeacherRulesCard";
import { SchoolScheduleTeacherUnavailableCard } from "./_components/SchoolScheduleTeacherUnavailableCard";
import { SchoolScheduleTemplatesCard } from "./_components/SchoolScheduleTemplatesCard";
import { SchoolSchedulesWeekViewCard } from "./_components/SchoolSchedulesWeekViewCard";
import { useSchoolSchedulesPage } from "./useSchoolSchedulesPage";
import { applyTemplateToAiForm } from "./utils";

export function useSchoolSchedulesPageView() {
  const page = useSchoolSchedulesPage();

  const headerProps: ComponentProps<typeof SchoolSchedulesHeader> = {
    lastLoadedAt: page.lastLoadedAt,
    loading: page.loading,
    refreshing: page.refreshing,
    onRefresh: () => {
      void page.loadData("refresh");
    }
  };

  const overviewProps: ComponentProps<typeof SchoolSchedulesOverviewCard> = {
    classCount: page.classes.length,
    activeClasses: page.summary?.activeClasses ?? 0,
    classesWithoutScheduleCount: page.summary?.classesWithoutScheduleCount ?? 0,
    totalSessions: page.summary?.totalSessions ?? 0,
    filteredSessionsCount: page.filteredSessions.length,
    averageLessonsPerWeek: page.summary?.averageLessonsPerWeek ?? 0,
    attentionClassCount: page.classes.filter((item) => (page.scheduleCountByClass.get(item.id) ?? 0) === 0).length
  };

  const aiPanelProps: ComponentProps<typeof SchoolSchedulesAiPanel> = {
    aiForm: page.aiForm,
    aiGenerating: page.aiGenerating,
    aiRollingBack: page.aiRollingBack,
    aiMessage: page.aiMessage,
    aiError: page.aiError,
    aiResult: page.aiResult,
    latestAiOperation: page.latestAiOperation,
    aiWeeklyLessonsTarget: page.aiWeeklyLessonsTarget,
    aiTargetClassCount: page.aiTargetClassCount,
    aiRequestedLessonCount: page.aiRequestedLessonCount,
    aiTeacherGapCount: page.aiTeacherGapCount,
    aiTemplateCoverageCount: page.aiTemplateCoverageCount,
    lockedSessionCount: page.lockedSessionCount,
    aiTeacherBoundTargetCount: page.aiTeacherBoundTargetCount,
    aiMissingTemplateTargetCount: page.aiMissingTemplateTargetCount,
    aiTeacherRuleGapTargetCount: page.aiTeacherRuleGapTargetCount,
    aiZeroScheduleTargetCount: page.aiZeroScheduleTargetCount,
    aiPreviewBlockingReasons: page.aiPreviewBlockingReasons,
    aiPreviewWarningReasons: page.aiPreviewWarningReasons,
    aiReadinessLabel: page.aiReadinessLabel,
    aiReadinessTone: page.aiReadinessTone,
    setAiForm: page.setAiForm,
    onToggleAiWeekday: page.toggleAiWeekday,
    onResetAiForm: page.resetAiForm,
    onPreview: () => {
      void page.handleAiPreview();
    },
    onApplyPreview: () => {
      void page.handleAiApplyPreview();
    },
    onRollback: () => {
      void page.handleAiRollback();
    }
  };

  const templateCardProps: ComponentProps<typeof SchoolScheduleTemplatesCard> = {
    templates: page.templates,
    templateForm: page.templateForm,
    gradeOptions: page.gradeOptions,
    subjectOptions: page.subjectOptions,
    aiTemplateCoverageCount: page.aiTemplateCoverageCount,
    teacherUnavailableSlotCount: page.teacherUnavailableSlots.length,
    templateSaving: page.templateSaving,
    templateDeletingId: page.templateDeletingId,
    templateMessage: page.templateMessage,
    templateError: page.templateError,
    setTemplateForm: page.setTemplateForm,
    toggleTemplateWeekday: page.toggleTemplateWeekday,
    resetTemplateForm: page.resetTemplateForm,
    applyDraftTemplateToAi: page.applyDraftTemplateToAi,
    startEditTemplate: page.startEditTemplate,
    handleSaveTemplate: page.handleSaveTemplate,
    handleDeleteTemplate: page.handleDeleteTemplate,
    onApplyTemplateToAi: (template) => {
      page.setAiForm(applyTemplateToAiForm(template));
    }
  };

  const teacherUnavailableCardProps: ComponentProps<typeof SchoolScheduleTeacherUnavailableCard> = {
    teacherUnavailableSlots: page.teacherUnavailableSlots,
    teacherUnavailableForm: page.teacherUnavailableForm,
    teacherUnavailableSaving: page.teacherUnavailableSaving,
    teacherUnavailableDeletingId: page.teacherUnavailableDeletingId,
    teacherUnavailableMessage: page.teacherUnavailableMessage,
    teacherUnavailableError: page.teacherUnavailableError,
    teacherOptions: page.teacherOptions,
    setTeacherUnavailableForm: page.setTeacherUnavailableForm,
    handleSaveTeacherUnavailable: page.handleSaveTeacherUnavailable,
    handleDeleteTeacherUnavailable: page.handleDeleteTeacherUnavailable
  };

  const teacherRulesCardProps: ComponentProps<typeof SchoolScheduleTeacherRulesCard> = {
    teacherRules: page.teacherRules,
    teacherRuleCoverageCount: page.teacherRuleCoverageCount,
    crossCampusRuleCount: page.crossCampusRuleCount,
    teacherRuleForm: page.teacherRuleForm,
    teacherRuleSaving: page.teacherRuleSaving,
    teacherRuleDeletingId: page.teacherRuleDeletingId,
    teacherRuleMessage: page.teacherRuleMessage,
    teacherRuleError: page.teacherRuleError,
    teacherOptions: page.teacherOptions,
    setTeacherRuleForm: page.setTeacherRuleForm,
    resetTeacherRuleForm: page.resetTeacherRuleForm,
    startEditTeacherRule: page.startEditTeacherRule,
    handleSaveTeacherRule: page.handleSaveTeacherRule,
    handleDeleteTeacherRule: page.handleDeleteTeacherRule,
    formatTeacherRuleSummary: page.formatTeacherRuleSummary
  };

  const filtersCardProps: ComponentProps<typeof SchoolSchedulesFiltersCard> = {
    classes: page.classes,
    classFilter: page.classFilter,
    weekdayFilter: page.weekdayFilter,
    keyword: page.keyword,
    setClassFilter: page.setClassFilter,
    setWeekdayFilter: page.setWeekdayFilter,
    setKeyword: page.setKeyword,
    clearWeekViewFilters: page.clearWeekViewFilters
  };

  const manualEditorCardProps: ComponentProps<typeof SchoolSchedulesManualEditorCard> = {
    manualEditorRef: page.manualEditorRef,
    editingId: page.editingId,
    saving: page.saving,
    classes: page.classes,
    form: page.form,
    formMessage: page.formMessage,
    formError: page.formError,
    selectedManualClass: page.selectedManualClass,
    selectedManualClassTemplate: page.selectedManualClassTemplate,
    selectedManualTeacherRule: page.selectedManualTeacherRule,
    selectedManualClassScheduleCount: page.selectedManualClassScheduleCount,
    selectedManualClassLockedCount: page.selectedManualClassLockedCount,
    setForm: page.setForm,
    buildManualScheduleDraft: page.buildManualScheduleDraft,
    applySelectedClassTemplateToForm: page.applySelectedClassTemplateToForm,
    focusClassInWeekView: page.focusClassInWeekView,
    handleSave: page.handleSave,
    resetForm: page.resetForm
  };

  const weekViewCardProps: ComponentProps<typeof SchoolSchedulesWeekViewCard> = {
    weekViewRef: page.weekViewRef,
    selectedWeekViewClass: page.selectedWeekViewClass,
    selectedWeekdayOption: page.selectedWeekdayOption,
    trimmedKeyword: page.trimmedKeyword,
    filteredSessions: page.filteredSessions,
    filteredLockedSessionCount: page.filteredLockedSessionCount,
    activeWeekViewFilterCount: page.activeWeekViewFilterCount,
    sessionsByWeekday: page.sessionsByWeekday,
    lockingId: page.lockingId,
    deletingId: page.deletingId,
    keepFocusedClassWeekView: page.keepFocusedClassWeekView,
    setWeekdayFilter: page.setWeekdayFilter,
    setKeyword: page.setKeyword,
    clearWeekViewFilters: page.clearWeekViewFilters,
    handleToggleLock: page.handleToggleLock,
    startEdit: page.startEdit,
    handleDelete: page.handleDelete
  };

  const coverageCardProps: ComponentProps<typeof SchoolSchedulesCoverageCard> = {
    classes: page.classes,
    scheduleCountByClass: page.scheduleCountByClass,
    lockedCountByClass: page.lockedCountByClass,
    templateByKey: page.templateByKey,
    teacherRuleByTeacherId: page.teacherRuleByTeacherId,
    startCreateForClass: page.startCreateForClass,
    focusClassInWeekView: page.focusClassInWeekView,
    formatTeacherRuleSummary: page.formatTeacherRuleSummary
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasClasses: page.classes.length > 0,
    hasSessions: page.sessions.length > 0,
    pageError: page.pageError,
    reload: () => {
      void page.loadData("refresh");
    },
    headerProps,
    overviewProps,
    aiPanelProps,
    templateCardProps,
    teacherUnavailableCardProps,
    teacherRulesCardProps,
    filtersCardProps,
    manualEditorCardProps,
    weekViewCardProps,
    coverageCardProps
  };
}
