"use client";

import { type Dispatch, type SetStateAction, useCallback } from "react";
import { requestJson } from "@/lib/client-request";
import { isSchoolAdminAuthRequiredError } from "../utils";
import type {
  TeacherUnavailableFormState,
  TeacherUnavailableResponse
} from "./types";
import {
  DEFAULT_TEACHER_UNAVAILABLE_FORM,
  getSchoolSchedulesRequestMessage,
  isMissingSchoolScheduleTeacherUnavailableError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type SchoolSchedulesTeacherUnavailableActionsOptions = {
  teacherUnavailableForm: TeacherUnavailableFormState;
  loadData: (mode?: "initial" | "refresh") => Promise<void>;
  handleAuthRequired: () => void;
  setTeacherUnavailableForm: Setter<TeacherUnavailableFormState>;
  setTeacherUnavailableSaving: Setter<boolean>;
  setTeacherUnavailableDeletingId: Setter<string | null>;
  setTeacherUnavailableMessage: Setter<string | null>;
  setTeacherUnavailableError: Setter<string | null>;
};

export function useSchoolSchedulesTeacherUnavailableActions({
  teacherUnavailableForm,
  loadData,
  handleAuthRequired,
  setTeacherUnavailableForm,
  setTeacherUnavailableSaving,
  setTeacherUnavailableDeletingId,
  setTeacherUnavailableMessage,
  setTeacherUnavailableError
}: SchoolSchedulesTeacherUnavailableActionsOptions) {
  const handleSaveTeacherUnavailable = useCallback(async () => {
    if (!teacherUnavailableForm.teacherId) {
      setTeacherUnavailableError("请选择教师。");
      return;
    }

    setTeacherUnavailableSaving(true);
    setTeacherUnavailableError(null);
    setTeacherUnavailableMessage(null);
    try {
      await requestJson<TeacherUnavailableResponse>(
        "/api/school/schedules/teacher-unavailability",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherId: teacherUnavailableForm.teacherId,
            weekday: Number(teacherUnavailableForm.weekday),
            startTime: teacherUnavailableForm.startTime,
            endTime: teacherUnavailableForm.endTime,
            reason: teacherUnavailableForm.reason
          })
        }
      );
      await loadData("refresh");
      setTeacherUnavailableMessage("教师禁排时段已保存");
      setTeacherUnavailableForm((previous) => ({
        ...DEFAULT_TEACHER_UNAVAILABLE_FORM,
        teacherId: previous.teacherId
      }));
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else {
        setTeacherUnavailableError(
          getSchoolSchedulesRequestMessage(error, "保存教师禁排失败")
        );
      }
    } finally {
      setTeacherUnavailableSaving(false);
    }
  }, [
    handleAuthRequired,
    loadData,
    setTeacherUnavailableError,
    setTeacherUnavailableForm,
    setTeacherUnavailableMessage,
    setTeacherUnavailableSaving,
    teacherUnavailableForm
  ]);

  const handleDeleteTeacherUnavailable = useCallback(async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定删除这个教师禁排时段吗？")
    ) {
      return;
    }

    setTeacherUnavailableDeletingId(id);
    setTeacherUnavailableError(null);
    setTeacherUnavailableMessage(null);
    try {
      await requestJson(
        `/api/school/schedules/teacher-unavailability/${id}`,
        { method: "DELETE" }
      );
      await loadData("refresh");
      setTeacherUnavailableMessage("教师禁排时段已删除");
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleTeacherUnavailableError(error)) {
        await loadData("refresh");
        setTeacherUnavailableError(
          getSchoolSchedulesRequestMessage(error, "删除教师禁排失败")
        );
      } else {
        setTeacherUnavailableError(
          getSchoolSchedulesRequestMessage(error, "删除教师禁排失败")
        );
      }
    } finally {
      setTeacherUnavailableDeletingId(null);
    }
  }, [
    handleAuthRequired,
    loadData,
    setTeacherUnavailableDeletingId,
    setTeacherUnavailableError,
    setTeacherUnavailableMessage
  ]);

  return {
    handleSaveTeacherUnavailable,
    handleDeleteTeacherUnavailable
  };
}
