"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTeacherExamCreatePageEffects } from "./useTeacherExamCreatePageEffects";
import { useTeacherExamCreatePageActions } from "./useTeacherExamCreatePageActions";
import { useTeacherExamCreatePageLoaders } from "./useTeacherExamCreatePageLoaders";
import { useTeacherExamCreatePageState } from "./useTeacherExamCreatePageState";

export function useTeacherExamCreatePage() {
  const router = useRouter();
  const pageState = useTeacherExamCreatePageState();

  const { loadConfig, loadStudents } = useTeacherExamCreatePageLoaders({
    formRef: pageState.formRef,
    knowledgePointsRef: pageState.knowledgePointsRef,
    configRequestIdRef: pageState.configRequestIdRef,
    studentsRequestIdRef: pageState.studentsRequestIdRef,
    hasClassSnapshotRef: pageState.hasClassSnapshotRef,
    hasKnowledgePointSnapshotRef: pageState.hasKnowledgePointSnapshotRef,
    setClasses: pageState.setClasses,
    setKnowledgePoints: pageState.setKnowledgePoints,
    setClassStudents: pageState.setClassStudents,
    setConfigLoading: pageState.setConfigLoading,
    setConfigRefreshing: pageState.setConfigRefreshing,
    setStudentsLoading: pageState.setStudentsLoading,
    setAuthRequired: pageState.setAuthRequired,
    setPageError: pageState.setPageError,
    setConfigNotice: pageState.setConfigNotice,
    setStudentsError: pageState.setStudentsError,
    setLastLoadedAt: pageState.setLastLoadedAt,
    setForm: pageState.setForm
  });

  useTeacherExamCreatePageEffects({
    formRef: pageState.formRef,
    knowledgePointsRef: pageState.knowledgePointsRef,
    form: pageState.form,
    knowledgePoints: pageState.knowledgePoints,
    loadConfig,
    loadStudents
  });

  const refreshConfig = useCallback(async () => {
    const previousClassId = pageState.formRef.current.classId;
    const nextClassId = await loadConfig("refresh");

    if (nextClassId && nextClassId === previousClassId) {
      await loadStudents(nextClassId, { preserveExisting: true });
    }
  }, [loadConfig, loadStudents, pageState.formRef]);

  const retryStudents = useCallback(() => {
    void loadStudents(pageState.form.classId, { preserveExisting: true });
  }, [loadStudents, pageState.form.classId]);

  const actions = useTeacherExamCreatePageActions({
    router,
    form: pageState.form,
    scheduleStatus: pageState.scheduleStatus,
    saving: pageState.saving,
    setSaving: pageState.setSaving,
    setAuthRequired: pageState.setAuthRequired,
    setSubmitError: pageState.setSubmitError,
    setSubmitMessage: pageState.setSubmitMessage,
    setSubmitSuggestions: pageState.setSubmitSuggestions,
    setStageTrail: pageState.setStageTrail
  });

  return {
    classes: pageState.classes,
    knowledgePoints: pageState.knowledgePoints,
    classStudents: pageState.classStudents,
    configLoading: pageState.configLoading,
    configRefreshing: pageState.configRefreshing,
    studentsLoading: pageState.studentsLoading,
    authRequired: pageState.authRequired,
    pageError: pageState.pageError,
    configNotice: pageState.configNotice,
    studentsError: pageState.studentsError,
    saving: pageState.saving,
    submitError: pageState.submitError,
    submitMessage: pageState.submitMessage,
    submitSuggestions: pageState.submitSuggestions,
    stageTrail: pageState.stageTrail,
    lastLoadedAt: pageState.lastLoadedAt,
    lastLoadedAtLabel: pageState.lastLoadedAtLabel,
    form: pageState.form,
    setForm: pageState.setForm,
    selectedClass: pageState.selectedClass,
    filteredPoints: pageState.filteredPoints,
    selectedPoint: pageState.selectedPoint,
    scheduleStatus: pageState.scheduleStatus,
    poolRisk: pageState.poolRisk,
    targetCount: pageState.targetCount,
    canSubmit: pageState.canSubmit,
    classLabel: pageState.classLabel,
    scopeLabel: pageState.scopeLabel,
    targetLabel: pageState.targetLabel,
    loadConfig,
    refreshConfig,
    retryStudents,
    handleSubmit: actions.handleSubmit
  };
}
