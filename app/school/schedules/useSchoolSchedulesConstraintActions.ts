"use client";

import { useSchoolSchedulesTeacherRuleActions } from "./useSchoolSchedulesTeacherRuleActions";
import { useSchoolSchedulesTeacherUnavailableActions } from "./useSchoolSchedulesTeacherUnavailableActions";
import { useSchoolSchedulesTemplateActions } from "./useSchoolSchedulesTemplateActions";

type TeacherOption = {
  id: string;
  name: string;
};

type SchoolSchedulesConstraintActionsOptions = {
  gradeOptions: string[];
  subjectOptions: string[];
  teacherOptions: TeacherOption[];
  templateForm: {
    id?: string;
    grade: string;
    subject: string;
    weeklyLessonsPerClass: string;
    lessonDurationMinutes: string;
    periodsPerDay: string;
    weekdays: string[];
    dayStartTime: string;
    shortBreakMinutes: string;
    lunchBreakAfterPeriod: string;
    lunchBreakMinutes: string;
    campus: string;
  };
  teacherRuleForm: {
    id?: string;
    teacherId: string;
    weeklyMaxLessons: string;
    maxConsecutiveLessons: string;
    minCampusGapMinutes: string;
  };
  teacherUnavailableForm: {
    teacherId: string;
    weekday: string;
    startTime: string;
    endTime: string;
    reason: string;
  };
  loadData: (mode?: "initial" | "refresh") => Promise<void>;
  handleAuthRequired: () => void;
  setAiForm: Parameters<typeof useSchoolSchedulesTemplateActions>[0]["setAiForm"];
  setTemplateForm: Parameters<typeof useSchoolSchedulesTemplateActions>[0]["setTemplateForm"];
  setTemplateSaving: Parameters<typeof useSchoolSchedulesTemplateActions>[0]["setTemplateSaving"];
  setTemplateDeletingId: Parameters<typeof useSchoolSchedulesTemplateActions>[0]["setTemplateDeletingId"];
  setTemplateMessage: Parameters<typeof useSchoolSchedulesTemplateActions>[0]["setTemplateMessage"];
  setTemplateError: Parameters<typeof useSchoolSchedulesTemplateActions>[0]["setTemplateError"];
  setTeacherRuleForm: Parameters<typeof useSchoolSchedulesTeacherRuleActions>[0]["setTeacherRuleForm"];
  setTeacherRuleSaving: Parameters<typeof useSchoolSchedulesTeacherRuleActions>[0]["setTeacherRuleSaving"];
  setTeacherRuleDeletingId: Parameters<typeof useSchoolSchedulesTeacherRuleActions>[0]["setTeacherRuleDeletingId"];
  setTeacherRuleMessage: Parameters<typeof useSchoolSchedulesTeacherRuleActions>[0]["setTeacherRuleMessage"];
  setTeacherRuleError: Parameters<typeof useSchoolSchedulesTeacherRuleActions>[0]["setTeacherRuleError"];
  setTeacherUnavailableForm: Parameters<typeof useSchoolSchedulesTeacherUnavailableActions>[0]["setTeacherUnavailableForm"];
  setTeacherUnavailableSaving: Parameters<typeof useSchoolSchedulesTeacherUnavailableActions>[0]["setTeacherUnavailableSaving"];
  setTeacherUnavailableDeletingId: Parameters<typeof useSchoolSchedulesTeacherUnavailableActions>[0]["setTeacherUnavailableDeletingId"];
  setTeacherUnavailableMessage: Parameters<typeof useSchoolSchedulesTeacherUnavailableActions>[0]["setTeacherUnavailableMessage"];
  setTeacherUnavailableError: Parameters<typeof useSchoolSchedulesTeacherUnavailableActions>[0]["setTeacherUnavailableError"];
};

export function useSchoolSchedulesConstraintActions(
  options: SchoolSchedulesConstraintActionsOptions
) {
  const templateActions = useSchoolSchedulesTemplateActions({
    gradeOptions: options.gradeOptions,
    subjectOptions: options.subjectOptions,
    templateForm: options.templateForm,
    loadData: options.loadData,
    handleAuthRequired: options.handleAuthRequired,
    setAiForm: options.setAiForm,
    setTemplateForm: options.setTemplateForm,
    setTemplateSaving: options.setTemplateSaving,
    setTemplateDeletingId: options.setTemplateDeletingId,
    setTemplateMessage: options.setTemplateMessage,
    setTemplateError: options.setTemplateError
  });

  const teacherRuleActions = useSchoolSchedulesTeacherRuleActions({
    teacherOptions: options.teacherOptions,
    teacherRuleForm: options.teacherRuleForm,
    loadData: options.loadData,
    handleAuthRequired: options.handleAuthRequired,
    setTeacherRuleForm: options.setTeacherRuleForm,
    setTeacherRuleSaving: options.setTeacherRuleSaving,
    setTeacherRuleDeletingId: options.setTeacherRuleDeletingId,
    setTeacherRuleMessage: options.setTeacherRuleMessage,
    setTeacherRuleError: options.setTeacherRuleError
  });

  const teacherUnavailableActions = useSchoolSchedulesTeacherUnavailableActions({
    teacherUnavailableForm: options.teacherUnavailableForm,
    loadData: options.loadData,
    handleAuthRequired: options.handleAuthRequired,
    setTeacherUnavailableForm: options.setTeacherUnavailableForm,
    setTeacherUnavailableSaving: options.setTeacherUnavailableSaving,
    setTeacherUnavailableDeletingId: options.setTeacherUnavailableDeletingId,
    setTeacherUnavailableMessage: options.setTeacherUnavailableMessage,
    setTeacherUnavailableError: options.setTeacherUnavailableError
  });

  return {
    ...templateActions,
    ...teacherRuleActions,
    ...teacherUnavailableActions
  };
}
