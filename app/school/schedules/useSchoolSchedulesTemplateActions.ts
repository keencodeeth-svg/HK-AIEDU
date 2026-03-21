"use client";

import { type Dispatch, type SetStateAction, useCallback } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import { isSchoolAdminAuthRequiredError } from "../utils";
import type {
  AiScheduleFormState,
  ScheduleTemplateResponse,
  TemplateFormState
} from "./types";
import {
  DEFAULT_TEMPLATE_FORM,
  applyTemplateToAiForm,
  getSchoolSchedulesRequestMessage,
  isMissingSchoolScheduleTemplateError,
  toggleSortedWeekdaySelection
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type SchoolSchedulesTemplateActionsOptions = {
  gradeOptions: string[];
  subjectOptions: string[];
  templateForm: TemplateFormState;
  loadData: (mode?: "initial" | "refresh") => Promise<void>;
  handleAuthRequired: () => void;
  setAiForm: Setter<AiScheduleFormState>;
  setTemplateForm: Setter<TemplateFormState>;
  setTemplateSaving: Setter<boolean>;
  setTemplateDeletingId: Setter<string | null>;
  setTemplateMessage: Setter<string | null>;
  setTemplateError: Setter<string | null>;
};

export function useSchoolSchedulesTemplateActions({
  gradeOptions,
  subjectOptions,
  templateForm,
  loadData,
  handleAuthRequired,
  setAiForm,
  setTemplateForm,
  setTemplateSaving,
  setTemplateDeletingId,
  setTemplateMessage,
  setTemplateError
}: SchoolSchedulesTemplateActionsOptions) {
  const toggleTemplateWeekday = useCallback((weekday: string) => {
    setTemplateForm((previous) => ({
      ...previous,
      weekdays: toggleSortedWeekdaySelection(previous.weekdays, weekday)
    }));
  }, [setTemplateForm]);

  const resetTemplateForm = useCallback(() => {
    setTemplateForm((previous) => ({
      ...DEFAULT_TEMPLATE_FORM,
      grade: previous.grade || gradeOptions[0] || "",
      subject: previous.subject || subjectOptions[0] || ""
    }));
    setTemplateError(null);
    setTemplateMessage(null);
  }, [
    gradeOptions,
    setTemplateError,
    setTemplateForm,
    setTemplateMessage,
    subjectOptions
  ]);

  const startEditTemplate = useCallback((template: SchoolScheduleTemplate) => {
    setTemplateError(null);
    setTemplateMessage(null);
    setTemplateForm({
      id: template.id,
      grade: template.grade,
      subject: template.subject,
      weeklyLessonsPerClass: String(template.weeklyLessonsPerClass),
      lessonDurationMinutes: String(template.lessonDurationMinutes),
      periodsPerDay: String(template.periodsPerDay),
      dayStartTime: template.dayStartTime,
      shortBreakMinutes: String(template.shortBreakMinutes),
      lunchBreakAfterPeriod: template.lunchBreakAfterPeriod
        ? String(template.lunchBreakAfterPeriod)
        : "",
      lunchBreakMinutes: String(template.lunchBreakMinutes),
      campus: template.campus ?? "主校区",
      weekdays: template.weekdays.map((item) => String(item))
    });
  }, [setTemplateError, setTemplateForm, setTemplateMessage]);

  const handleSaveTemplate = useCallback(async () => {
    const weeklyLessonsPerClass = Number(templateForm.weeklyLessonsPerClass);
    const lessonDurationMinutes = Number(templateForm.lessonDurationMinutes);
    const periodsPerDay = Number(templateForm.periodsPerDay);
    const shortBreakMinutes = Number(templateForm.shortBreakMinutes);
    const lunchBreakMinutes = Number(templateForm.lunchBreakMinutes);
    const lunchBreakAfterPeriod = templateForm.lunchBreakAfterPeriod
      ? Number(templateForm.lunchBreakAfterPeriod)
      : undefined;

    if (!templateForm.grade || !templateForm.subject) {
      setTemplateError("请选择年级和学科。");
      return;
    }
    if (!templateForm.weekdays.length) {
      setTemplateError("模板至少需要 1 个排课日。");
      return;
    }

    setTemplateSaving(true);
    setTemplateError(null);
    setTemplateMessage(null);
    try {
      await requestJson<ScheduleTemplateResponse>("/api/school/schedules/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: templateForm.id,
          grade: templateForm.grade,
          subject: templateForm.subject,
          weeklyLessonsPerClass,
          lessonDurationMinutes,
          periodsPerDay,
          weekdays: templateForm.weekdays.map((item) => Number(item)),
          dayStartTime: templateForm.dayStartTime,
          shortBreakMinutes,
          lunchBreakAfterPeriod,
          lunchBreakMinutes,
          campus: templateForm.campus
        })
      });
      await loadData("refresh");
      setTemplateMessage(templateForm.id ? "课时模板已更新" : "课时模板已保存");
      setTemplateForm((previous) => ({ ...previous, id: undefined }));
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleTemplateError(error)) {
        resetTemplateForm();
        await loadData("refresh");
        setTemplateError(getSchoolSchedulesRequestMessage(error, "保存模板失败"));
      } else {
        setTemplateError(getSchoolSchedulesRequestMessage(error, "保存模板失败"));
      }
    } finally {
      setTemplateSaving(false);
    }
  }, [
    handleAuthRequired,
    loadData,
    resetTemplateForm,
    setTemplateError,
    setTemplateForm,
    setTemplateMessage,
    setTemplateSaving,
    templateForm
  ]);

  const applyDraftTemplateToAi = useCallback(() => {
    if (
      !templateForm.grade ||
      !templateForm.subject ||
      !templateForm.weekdays.length
    ) {
      setTemplateError("请先补全年级、学科和排课日，再应用到 AI 参数。");
      return;
    }

    setAiForm(
      applyTemplateToAiForm({
        id: templateForm.id ?? "draft-template",
        schoolId: "school-default",
        grade: templateForm.grade,
        subject: templateForm.subject,
        weeklyLessonsPerClass: Number(templateForm.weeklyLessonsPerClass) || 5,
        lessonDurationMinutes: Number(templateForm.lessonDurationMinutes) || 45,
        periodsPerDay: Number(templateForm.periodsPerDay) || 6,
        weekdays: templateForm.weekdays.map((item) => Number(item)) as Array<
          1 | 2 | 3 | 4 | 5 | 6 | 7
        >,
        dayStartTime: templateForm.dayStartTime,
        shortBreakMinutes: Number(templateForm.shortBreakMinutes) || 10,
        lunchBreakAfterPeriod: templateForm.lunchBreakAfterPeriod
          ? Number(templateForm.lunchBreakAfterPeriod)
          : undefined,
        lunchBreakMinutes: Number(templateForm.lunchBreakMinutes) || 60,
        campus: templateForm.campus,
        createdAt: "",
        updatedAt: ""
      })
    );
    setTemplateMessage("模板参数已同步到 AI 排课配置区。");
  }, [setAiForm, setTemplateError, setTemplateMessage, templateForm]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定删除这个课时模板吗？")
    ) {
      return;
    }

    setTemplateDeletingId(id);
    setTemplateError(null);
    setTemplateMessage(null);
    try {
      await requestJson(`/api/school/schedules/templates/${id}`, {
        method: "DELETE"
      });
      await loadData("refresh");
      if (templateForm.id === id) {
        resetTemplateForm();
      }
      setTemplateMessage("课时模板已删除");
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleTemplateError(error)) {
        if (templateForm.id === id) {
          resetTemplateForm();
        }
        await loadData("refresh");
        setTemplateError(getSchoolSchedulesRequestMessage(error, "删除模板失败"));
      } else {
        setTemplateError(getSchoolSchedulesRequestMessage(error, "删除模板失败"));
      }
    } finally {
      setTemplateDeletingId(null);
    }
  }, [
    handleAuthRequired,
    loadData,
    resetTemplateForm,
    setTemplateDeletingId,
    setTemplateError,
    setTemplateMessage,
    templateForm.id
  ]);

  return {
    toggleTemplateWeekday,
    resetTemplateForm,
    startEditTemplate,
    handleSaveTemplate,
    applyDraftTemplateToAi,
    handleDeleteTemplate
  };
}
