"use client";

import type { ComponentProps } from "react";
import ExamCreateCommitCard from "./_components/ExamCreateCommitCard";
import ExamCreateGuardrailsCard from "./_components/ExamCreateGuardrailsCard";
import ExamCreateLoopCard from "./_components/ExamCreateLoopCard";
import ExamCreateOverviewCard from "./_components/ExamCreateOverviewCard";
import ExamCreatePoolCard from "./_components/ExamCreatePoolCard";
import ExamCreatePublishCard from "./_components/ExamCreatePublishCard";
import ExamCreateScheduleCard from "./_components/ExamCreateScheduleCard";
import ExamCreateScopeCard from "./_components/ExamCreateScopeCard";
import {
  formatLoadedTime,
  getDifficultyLabel,
  getPublishModeLabel
} from "./utils";
import { useTeacherExamCreatePage } from "./useTeacherExamCreatePage";

export function useTeacherExamCreatePageView() {
  const page = useTeacherExamCreatePage();

  const loopCardProps: ComponentProps<typeof ExamCreateLoopCard> = {
    classLabel: page.classLabel,
    scopeLabel: page.scopeLabel,
    targetLabel: page.targetLabel,
    scheduleLabel: page.scheduleStatus.summary,
    scheduleMeta: page.scheduleStatus.meta.trim(),
    poolLabel: `风险 ${page.poolRisk.label}`,
    poolMeta: page.poolRisk.meta
  };

  const overviewCardProps: ComponentProps<typeof ExamCreateOverviewCard> = {
    selectedClass: page.selectedClass,
    selectedPoint: page.selectedPoint,
    filteredPointCount: page.filteredPoints.length,
    targetCount: page.targetCount,
    classStudentsCount: page.classStudents.length,
    form: page.form,
    scheduleStatus: page.scheduleStatus
  };

  const guardrailsCardProps: ComponentProps<typeof ExamCreateGuardrailsCard> = {
    poolRisk: page.poolRisk,
    scheduleStatus: page.scheduleStatus,
    configNotice: page.configNotice,
    onRefresh: () => {
      void page.refreshConfig();
    }
  };

  const scopeCardProps: ComponentProps<typeof ExamCreateScopeCard> = {
    classes: page.classes,
    form: page.form,
    setForm: page.setForm,
    classLabel: page.classLabel,
    filteredPointCount: page.filteredPoints.length,
    classStudentsCount: page.classStudents.length
  };

  const poolCardProps: ComponentProps<typeof ExamCreatePoolCard> = {
    form: page.form,
    setForm: page.setForm,
    filteredPoints: page.filteredPoints
  };

  const scheduleCardProps: ComponentProps<typeof ExamCreateScheduleCard> = {
    form: page.form,
    setForm: page.setForm,
    scheduleStatus: page.scheduleStatus
  };

  const publishCardProps: ComponentProps<typeof ExamCreatePublishCard> = {
    form: page.form,
    setForm: page.setForm,
    targetLabel: page.targetLabel,
    classStudents: page.classStudents,
    studentsLoading: page.studentsLoading,
    studentsError: page.studentsError,
    onRetryStudents: page.retryStudents
  };

  const commitCardProps: ComponentProps<typeof ExamCreateCommitCard> = {
    formTitle: page.form.title.trim(),
    scopeLabel: page.scopeLabel,
    targetLabel: page.targetLabel,
    scheduleSummary: page.scheduleStatus.summary,
    canSubmit: page.canSubmit,
    saving: page.saving,
    submitMessage: page.submitMessage,
    submitError: page.submitError,
    submitSuggestions: page.submitSuggestions,
    stageTrail: page.stageTrail
  };

  return {
    loading: page.configLoading,
    authRequired: page.authRequired,
    hasConfigData: Boolean(page.classes.length || page.knowledgePoints.length),
    hasClasses: page.classes.length > 0,
    pageError: page.pageError,
    classLabel: page.classLabel,
    publishModeLabel: getPublishModeLabel(page.form.publishMode),
    difficultyLabel: getDifficultyLabel(page.form.difficulty),
    questionCount: page.form.questionCount,
    targetLabel: page.targetLabel,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    refreshing: page.configRefreshing,
    refreshDisabled: page.configLoading || page.configRefreshing || page.studentsLoading,
    refresh: () => {
      void page.refreshConfig();
    },
    reload: () => {
      void page.loadConfig();
    },
    handleSubmit: page.handleSubmit,
    loopCardProps,
    overviewCardProps,
    guardrailsCardProps,
    scopeCardProps,
    poolCardProps,
    scheduleCardProps,
    publishCardProps,
    commitCardProps
  };
}
