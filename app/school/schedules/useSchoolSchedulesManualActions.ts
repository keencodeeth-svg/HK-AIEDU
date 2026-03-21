"use client";

import { type Dispatch, type SetStateAction, useCallback } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import { isSchoolAdminAuthRequiredError } from "../utils";
import type { ScheduleFormState, ScheduleMutationResponse, ScheduleViewItem } from "./types";
import {
  EMPTY_FORM,
  WEEKDAY_OPTIONS,
  addMinutesToTime,
  getSchoolSchedulesRequestMessage,
  isMissingSchoolScheduleClassError,
  isMissingSchoolScheduleSessionError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ScrollTargetRef<T> = {
  current: T;
};

type SchoolSchedulesManualActionsOptions = {
  classes: SchoolClassRecord[];
  templateByKey: Map<string, SchoolScheduleTemplate>;
  classWeekdayCountByClass: Map<string, Map<string, number>>;
  form: ScheduleFormState;
  editingId: string | null;
  classFilter: string;
  manualEditorRef: ScrollTargetRef<HTMLDivElement | null>;
  weekViewRef: ScrollTargetRef<HTMLDivElement | null>;
  loadData: (mode?: "initial" | "refresh") => Promise<void>;
  handleAuthRequired: () => void;
  setClassFilter: Setter<string>;
  setWeekdayFilter: Setter<string>;
  setKeyword: Setter<string>;
  setEditingId: Setter<string | null>;
  setForm: Setter<ScheduleFormState>;
  setFormError: Setter<string | null>;
  setFormMessage: Setter<string | null>;
  setSaving: Setter<boolean>;
  setDeletingId: Setter<string | null>;
  setPageError: Setter<string | null>;
  setLockingId: Setter<string | null>;
};

export function useSchoolSchedulesManualActions({
  classes,
  templateByKey,
  classWeekdayCountByClass,
  form,
  editingId,
  classFilter,
  manualEditorRef,
  weekViewRef,
  loadData,
  handleAuthRequired,
  setClassFilter,
  setWeekdayFilter,
  setKeyword,
  setEditingId,
  setForm,
  setFormError,
  setFormMessage,
  setSaving,
  setDeletingId,
  setPageError,
  setLockingId
}: SchoolSchedulesManualActionsOptions) {
  const scrollToManualEditor = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      manualEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [manualEditorRef]);

  const scrollToWeekView = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      weekViewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [weekViewRef]);

  const buildManualScheduleDraft = useCallback(
    (classId: string) => {
      const klass = classes.find((item) => item.id === classId);
      const template = klass ? templateByKey.get(`${klass.grade}:${klass.subject}`) ?? null : null;
      const weekdayCountMap = classWeekdayCountByClass.get(classId) ?? new Map<string, number>();
      const candidateWeekdays = template?.weekdays?.length
        ? template.weekdays.map((item) => String(item))
        : WEEKDAY_OPTIONS.map((item) => item.value);
      const weekday =
        candidateWeekdays
          .slice()
          .sort(
            (left, right) =>
              (weekdayCountMap.get(left) ?? 0) - (weekdayCountMap.get(right) ?? 0) || Number(left) - Number(right)
          )[0] ?? EMPTY_FORM.weekday;
      const startTime = template?.dayStartTime ?? EMPTY_FORM.startTime;
      const lessonDuration = template?.lessonDurationMinutes ?? 45;

      return {
        ...EMPTY_FORM,
        classId,
        weekday,
        startTime,
        endTime: addMinutesToTime(startTime, lessonDuration),
        campus: template?.campus ?? EMPTY_FORM.campus
      } satisfies ScheduleFormState;
    },
    [classWeekdayCountByClass, classes, templateByKey]
  );

  const resetForm = useCallback(
    (options?: { preserveMessage?: boolean; nextClassId?: string }) => {
      setEditingId(null);
      setFormError(null);
      if (!options?.preserveMessage) {
        setFormMessage(null);
      }
      const nextClassId = options?.nextClassId ?? classes[0]?.id ?? "";
      setForm(nextClassId ? buildManualScheduleDraft(nextClassId) : { ...EMPTY_FORM, classId: nextClassId });
    },
    [buildManualScheduleDraft, classes, setEditingId, setForm, setFormError, setFormMessage]
  );

  const startCreateForClass = useCallback(
    (classId: string) => {
      setEditingId(null);
      setFormError(null);
      setFormMessage(null);
      setForm(buildManualScheduleDraft(classId));
      scrollToManualEditor();
    },
    [buildManualScheduleDraft, scrollToManualEditor, setEditingId, setForm, setFormError, setFormMessage]
  );

  const startEdit = useCallback(
    (item: ScheduleViewItem) => {
      setEditingId(item.id);
      setFormError(null);
      setFormMessage(null);
      setForm({
        classId: item.classId,
        weekday: String(item.weekday),
        startTime: item.startTime,
        endTime: item.endTime,
        slotLabel: item.slotLabel ?? "",
        room: item.room ?? "",
        campus: item.campus ?? "",
        focusSummary: item.focusSummary ?? "",
        note: item.note ?? ""
      });
      scrollToManualEditor();
    },
    [scrollToManualEditor, setEditingId, setForm, setFormError, setFormMessage]
  );

  const clearWeekViewFilters = useCallback(() => {
    setClassFilter("all");
    setWeekdayFilter("all");
    setKeyword("");
  }, [setClassFilter, setKeyword, setWeekdayFilter]);

  const keepFocusedClassWeekView = useCallback(() => {
    if (classFilter === "all") return;
    setWeekdayFilter("all");
    setKeyword("");
  }, [classFilter, setKeyword, setWeekdayFilter]);

  const focusClassInWeekView = useCallback(
    (classId: string) => {
      setClassFilter(classId);
      setWeekdayFilter("all");
      setKeyword("");
      scrollToWeekView();
    },
    [scrollToWeekView, setClassFilter, setKeyword, setWeekdayFilter]
  );

  const applySelectedClassTemplateToForm = useCallback(() => {
    const currentClass = classes.find((item) => item.id === form.classId);
    if (!currentClass) return;

    const draft = buildManualScheduleDraft(currentClass.id);
    setForm((prev) => ({
      ...prev,
      classId: currentClass.id,
      weekday: draft.weekday,
      startTime: draft.startTime,
      endTime: draft.endTime,
      campus: draft.campus || prev.campus
    }));
    setFormMessage("已带入该班模板的推荐星期、时间和校区，可继续微调后保存。");
    setFormError(null);
  }, [buildManualScheduleDraft, classes, form.classId, setForm, setFormError, setFormMessage]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFormError(null);
    setFormMessage(null);

    try {
      const payload = {
        classId: form.classId,
        weekday: Number(form.weekday),
        startTime: form.startTime,
        endTime: form.endTime,
        slotLabel: form.slotLabel,
        room: form.room,
        campus: form.campus,
        focusSummary: form.focusSummary,
        note: form.note
      };
      if (!payload.classId) {
        throw new Error("请选择班级");
      }

      const successMessage = editingId ? "课程节次已更新" : "课程节次已创建";
      if (editingId) {
        await requestJson<ScheduleMutationResponse>(`/api/school/schedules/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekday: payload.weekday,
            startTime: payload.startTime,
            endTime: payload.endTime,
            slotLabel: payload.slotLabel,
            room: payload.room,
            campus: payload.campus,
            focusSummary: payload.focusSummary,
            note: payload.note
          })
        });
      } else {
        await requestJson<ScheduleMutationResponse>("/api/school/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      await loadData("refresh");
      resetForm({ preserveMessage: true, nextClassId: payload.classId });
      setFormMessage(successMessage);
    } catch (error) {
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else if (isMissingSchoolScheduleClassError(error) || (editingId && isMissingSchoolScheduleSessionError(error))) {
        resetForm({ preserveMessage: true });
        await loadData("refresh");
        setFormError(getSchoolSchedulesRequestMessage(error, editingId ? "更新节次失败" : "创建节次失败"));
      } else {
        setFormError(getSchoolSchedulesRequestMessage(error, editingId ? "更新节次失败" : "创建节次失败"));
      }
    } finally {
      setSaving(false);
    }
  }, [editingId, form, handleAuthRequired, loadData, resetForm, setFormError, setFormMessage, setSaving]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (typeof window !== "undefined" && !window.confirm("确定删除这个课程节次吗？")) {
        return;
      }

      setDeletingId(id);
      setPageError(null);
      try {
        await requestJson<ScheduleMutationResponse>(`/api/school/schedules/${id}`, { method: "DELETE" });
        if (editingId === id) {
          resetForm({ preserveMessage: true });
        }
        await loadData("refresh");
        setFormMessage("课程节次已删除");
      } catch (error) {
        if (isSchoolAdminAuthRequiredError(error)) {
          handleAuthRequired();
        } else if (isMissingSchoolScheduleSessionError(error)) {
          if (editingId === id) {
            resetForm({ preserveMessage: true });
          }
          await loadData("refresh");
          setPageError(getSchoolSchedulesRequestMessage(error, "删除节次失败"));
        } else {
          setPageError(getSchoolSchedulesRequestMessage(error, "删除节次失败"));
        }
      } finally {
        setDeletingId(null);
      }
    },
    [
      editingId,
      handleAuthRequired,
      loadData,
      resetForm,
      setDeletingId,
      setFormMessage,
      setPageError
    ]
  );

  const handleToggleLock = useCallback(
    async (item: ScheduleViewItem) => {
      setLockingId(item.id);
      setPageError(null);
      setFormError(null);
      setFormMessage(null);

      try {
        await requestJson<ScheduleMutationResponse>(`/api/school/schedules/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: !item.locked })
        });
        if (editingId === item.id && !item.locked) {
          resetForm({ preserveMessage: true });
        }
        await loadData("refresh");
        setFormMessage(item.locked ? "课程节次已解锁" : "课程节次已锁定");
      } catch (error) {
        if (isSchoolAdminAuthRequiredError(error)) {
          handleAuthRequired();
        } else if (isMissingSchoolScheduleSessionError(error)) {
          if (editingId === item.id) {
            resetForm({ preserveMessage: true });
          }
          await loadData("refresh");
          setPageError(getSchoolSchedulesRequestMessage(error, item.locked ? "解锁节次失败" : "锁定节次失败"));
        } else {
          setPageError(getSchoolSchedulesRequestMessage(error, item.locked ? "解锁节次失败" : "锁定节次失败"));
        }
      } finally {
        setLockingId(null);
      }
    },
    [
      editingId,
      handleAuthRequired,
      loadData,
      resetForm,
      setFormError,
      setFormMessage,
      setLockingId,
      setPageError
    ]
  );

  return {
    buildManualScheduleDraft,
    resetForm,
    startCreateForClass,
    startEdit,
    clearWeekViewFilters,
    keepFocusedClassWeekView,
    focusClassInWeekView,
    applySelectedClassTemplateToForm,
    handleSave,
    handleDelete,
    handleToggleLock
  };
}
