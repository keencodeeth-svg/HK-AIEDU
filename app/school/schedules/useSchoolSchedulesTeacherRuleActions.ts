"use client";

import { type Dispatch, type SetStateAction, useCallback } from "react";
import { requestJson } from "@/lib/client-request";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import { isSchoolAdminAuthRequiredError } from "../utils";
import type {
  TeacherRuleFormState,
  TeacherRuleMutationResponse
} from "./types";
import {
  DEFAULT_TEACHER_RULE_FORM,
  getSchoolSchedulesRequestMessage,
  isMissingSchoolScheduleTeacherRuleError,
  toOptionalNumber
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type TeacherOption = {
  id: string;
  name: string;
};

type SchoolSchedulesTeacherRuleActionsOptions = {
  teacherOptions: TeacherOption[];
  teacherRuleForm: TeacherRuleFormState;
  loadData: (mode?: "initial" | "refresh") => Promise<void>;
  handleAuthRequired: () => void;
  setTeacherRuleForm: Setter<TeacherRuleFormState>;
  setTeacherRuleSaving: Setter<boolean>;
  setTeacherRuleDeletingId: Setter<string | null>;
  setTeacherRuleMessage: Setter<string | null>;
  setTeacherRuleError: Setter<string | null>;
};

export function useSchoolSchedulesTeacherRuleActions({
  teacherOptions,
  teacherRuleForm,
  loadData,
  handleAuthRequired,
  setTeacherRuleForm,
  setTeacherRuleSaving,
  setTeacherRuleDeletingId,
  setTeacherRuleMessage,
  setTeacherRuleError
}: SchoolSchedulesTeacherRuleActionsOptions) {
  const resetTeacherRuleForm = useCallback(() => {
    setTeacherRuleForm((previous) => ({
      ...DEFAULT_TEACHER_RULE_FORM,
      teacherId: previous.teacherId || teacherOptions[0]?.id || ""
    }));
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
  }, [
    setTeacherRuleError,
    setTeacherRuleForm,
    setTeacherRuleMessage,
    teacherOptions
  ]);

  const startEditTeacherRule = useCallback((rule: TeacherScheduleRule) => {
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    setTeacherRuleForm({
      id: rule.id,
      teacherId: rule.teacherId,
      weeklyMaxLessons: rule.weeklyMaxLessons
        ? String(rule.weeklyMaxLessons)
        : "",
      maxConsecutiveLessons: rule.maxConsecutiveLessons
        ? String(rule.maxConsecutiveLessons)
        : "",
      minCampusGapMinutes: rule.minCampusGapMinutes
        ? String(rule.minCampusGapMinutes)
        : ""
    });
  }, [setTeacherRuleError, setTeacherRuleForm, setTeacherRuleMessage]);

  const handleSaveTeacherRule = useCallback(async () => {
    const weeklyMaxLessons = toOptionalNumber(teacherRuleForm.weeklyMaxLessons);
    const maxConsecutiveLessons = toOptionalNumber(
      teacherRuleForm.maxConsecutiveLessons
    );
    const minCampusGapMinutes = toOptionalNumber(
      teacherRuleForm.minCampusGapMinutes
    );

    if (!teacherRuleForm.teacherId) {
      setTeacherRuleError("请选择教师。");
      return;
    }
    if (
      weeklyMaxLessons === undefined &&
      maxConsecutiveLessons === undefined &&
      minCampusGapMinutes === undefined
    ) {
      setTeacherRuleError("请至少填写一项教师排课规则。");
      return;
    }

    setTeacherRuleSaving(true);
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    try {
      await requestJson<TeacherRuleMutationResponse>(
        "/api/school/schedules/teacher-rules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: teacherRuleForm.id,
            teacherId: teacherRuleForm.teacherId,
            weeklyMaxLessons,
            maxConsecutiveLessons,
            minCampusGapMinutes
          })
        }
      );
      await loadData("refresh");
      setTeacherRuleMessage(
        teacherRuleForm.id ? "教师排课规则已更新" : "教师排课规则已保存"
      );
      setTeacherRuleForm((previous) => ({
        ...DEFAULT_TEACHER_RULE_FORM,
        teacherId: previous.teacherId
      }));
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleTeacherRuleError(error)) {
        resetTeacherRuleForm();
        await loadData("refresh");
        setTeacherRuleError(
          getSchoolSchedulesRequestMessage(error, "保存教师排课规则失败")
        );
      } else {
        setTeacherRuleError(
          getSchoolSchedulesRequestMessage(error, "保存教师排课规则失败")
        );
      }
    } finally {
      setTeacherRuleSaving(false);
    }
  }, [
    handleAuthRequired,
    loadData,
    resetTeacherRuleForm,
    setTeacherRuleError,
    setTeacherRuleForm,
    setTeacherRuleMessage,
    setTeacherRuleSaving,
    teacherRuleForm
  ]);

  const handleDeleteTeacherRule = useCallback(async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定删除这个教师排课规则吗？")
    ) {
      return;
    }

    setTeacherRuleDeletingId(id);
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    try {
      await requestJson(`/api/school/schedules/teacher-rules/${id}`, {
        method: "DELETE"
      });
      await loadData("refresh");
      if (teacherRuleForm.id === id) {
        resetTeacherRuleForm();
      }
      setTeacherRuleMessage("教师排课规则已删除");
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleTeacherRuleError(error)) {
        if (teacherRuleForm.id === id) {
          resetTeacherRuleForm();
        }
        await loadData("refresh");
        setTeacherRuleError(
          getSchoolSchedulesRequestMessage(error, "删除教师排课规则失败")
        );
      } else {
        setTeacherRuleError(
          getSchoolSchedulesRequestMessage(error, "删除教师排课规则失败")
        );
      }
    } finally {
      setTeacherRuleDeletingId(null);
    }
  }, [
    handleAuthRequired,
    loadData,
    resetTeacherRuleForm,
    setTeacherRuleDeletingId,
    setTeacherRuleError,
    setTeacherRuleMessage,
    teacherRuleForm.id
  ]);

  return {
    resetTeacherRuleForm,
    startEditTeacherRule,
    handleSaveTeacherRule,
    handleDeleteTeacherRule
  };
}
