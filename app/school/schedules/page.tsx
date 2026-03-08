"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import Stat from "@/components/Stat";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { ClassScheduleSession } from "@/lib/class-schedules";
import type { SchoolClassRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherUnavailableSlot } from "@/lib/teacher-unavailability";

const WEEKDAY_OPTIONS = [
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
  { value: "7", label: "周日" }
] as const;

const fieldStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)",
  background: "var(--card)",
  color: "var(--ink)"
} as const;

type ScheduleViewItem = ClassScheduleSession & {
  className: string;
  subject: string;
  grade: string;
  teacherName?: string;
  teacherId: string | null;
};

type SchoolSchedulesResponse = {
  data?: {
    summary: {
      totalSessions: number;
      activeClasses: number;
      classesWithoutScheduleCount: number;
      averageLessonsPerWeek: number;
    };
    classes: SchoolClassRecord[];
    sessions: ScheduleViewItem[];
  };
};

type ScheduleMutationResponse = { data?: ClassScheduleSession | null; ok?: boolean };
type SchoolSchedulesData = NonNullable<SchoolSchedulesResponse["data"]>;
type AiMode = "fill_missing" | "replace_all";

type AiImpactedClass = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacherName?: string;
  teacherId: string | null;
  requestedLessons: number;
  createdLessons: number;
  totalLessonsAfter: number;
  status: "generated" | "skipped" | "unchanged";
  reason?: string;
};

type AiScheduleResponse = {
  data?: {
    summary: {
      targetClassCount: number;
      teacherBoundClassCount: number;
      replacedClassCount: number;
      createdSessions: number;
      requestedLessons: number;
      unresolvedLessons: number;
      skippedClassCount: number;
      untouchedClassCount: number;
      templateAppliedClassCount?: number;
    };
    warnings: string[];
    createdSessions: ScheduleViewItem[];
    impactedClasses: AiImpactedClass[];
  };
};

type ScheduleTemplateResponse = { data?: SchoolScheduleTemplate[] };
type TeacherUnavailableResponse = { data?: TeacherUnavailableSlot[] };

type TemplateFormState = {
  id?: string;
  grade: string;
  subject: string;
  weeklyLessonsPerClass: string;
  lessonDurationMinutes: string;
  periodsPerDay: string;
  dayStartTime: string;
  shortBreakMinutes: string;
  lunchBreakAfterPeriod: string;
  lunchBreakMinutes: string;
  campus: string;
  weekdays: string[];
};

type TeacherUnavailableFormState = {
  teacherId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  reason: string;
};

type ScheduleFormState = {
  classId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  room: string;
  campus: string;
  focusSummary: string;
  note: string;
};

type AiScheduleFormState = {
  mode: AiMode;
  weeklyLessonsPerClass: string;
  lessonDurationMinutes: string;
  periodsPerDay: string;
  dayStartTime: string;
  shortBreakMinutes: string;
  lunchBreakAfterPeriod: string;
  lunchBreakMinutes: string;
  campus: string;
  weekdays: string[];
};

const EMPTY_FORM: ScheduleFormState = {
  classId: "",
  weekday: "1",
  startTime: "08:00",
  endTime: "08:45",
  slotLabel: "",
  room: "",
  campus: "",
  focusSummary: "",
  note: ""
};

const DEFAULT_AI_FORM: AiScheduleFormState = {
  mode: "fill_missing",
  weeklyLessonsPerClass: "5",
  lessonDurationMinutes: "45",
  periodsPerDay: "6",
  dayStartTime: "08:00",
  shortBreakMinutes: "10",
  lunchBreakAfterPeriod: "4",
  lunchBreakMinutes: "60",
  campus: "主校区",
  weekdays: ["1", "2", "3", "4", "5"]
};

const DEFAULT_TEMPLATE_FORM: TemplateFormState = {
  grade: "",
  subject: "",
  weeklyLessonsPerClass: "5",
  lessonDurationMinutes: "45",
  periodsPerDay: "6",
  dayStartTime: "08:00",
  shortBreakMinutes: "10",
  lunchBreakAfterPeriod: "4",
  lunchBreakMinutes: "60",
  campus: "主校区",
  weekdays: ["1", "2", "3", "4", "5"]
};

const DEFAULT_TEACHER_UNAVAILABLE_FORM: TeacherUnavailableFormState = {
  teacherId: "",
  weekday: "1",
  startTime: "08:00",
  endTime: "08:45",
  reason: ""
};

function formatSubjectLine(item: Pick<ScheduleViewItem, "subject" | "grade" | "teacherName" | "teacherId">) {
  return `${item.subject} · ${item.grade} 年级 · ${item.teacherName ?? item.teacherId ?? "未绑定教师"}`;
}

function applyTemplateToAiForm(template: SchoolScheduleTemplate): AiScheduleFormState {
  return {
    mode: "fill_missing",
    weeklyLessonsPerClass: String(template.weeklyLessonsPerClass),
    lessonDurationMinutes: String(template.lessonDurationMinutes),
    periodsPerDay: String(template.periodsPerDay),
    dayStartTime: template.dayStartTime,
    shortBreakMinutes: String(template.shortBreakMinutes),
    lunchBreakAfterPeriod: template.lunchBreakAfterPeriod ? String(template.lunchBreakAfterPeriod) : "",
    lunchBreakMinutes: String(template.lunchBreakMinutes),
    campus: template.campus ?? "主校区",
    weekdays: template.weekdays.map((item) => String(item))
  };
}

export default function SchoolSchedulesPage() {
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [sessions, setSessions] = useState<ScheduleViewItem[]>([]);
  const [summary, setSummary] = useState<SchoolSchedulesData["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("all");
  const [weekdayFilter, setWeekdayFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState<AiScheduleFormState>(DEFAULT_AI_FORM);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiScheduleResponse["data"] | null>(null);
  const [templates, setTemplates] = useState<SchoolScheduleTemplate[]>([]);
  const [teacherUnavailableSlots, setTeacherUnavailableSlots] = useState<TeacherUnavailableSlot[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(DEFAULT_TEMPLATE_FORM);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateDeletingId, setTemplateDeletingId] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [teacherUnavailableForm, setTeacherUnavailableForm] = useState<TeacherUnavailableFormState>(DEFAULT_TEACHER_UNAVAILABLE_FORM);
  const [teacherUnavailableSaving, setTeacherUnavailableSaving] = useState(false);
  const [teacherUnavailableDeletingId, setTeacherUnavailableDeletingId] = useState<string | null>(null);
  const [teacherUnavailableMessage, setTeacherUnavailableMessage] = useState<string | null>(null);
  const [teacherUnavailableError, setTeacherUnavailableError] = useState<string | null>(null);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [payload, templatesPayload, teacherUnavailablePayload] = await Promise.all([
        requestJson<SchoolSchedulesResponse>("/api/school/schedules"),
        requestJson<ScheduleTemplateResponse>("/api/school/schedules/templates"),
        requestJson<TeacherUnavailableResponse>("/api/school/schedules/teacher-unavailability")
      ]);
      setClasses(payload.data?.classes ?? []);
      setSessions(payload.data?.sessions ?? []);
      setSummary(payload.data?.summary ?? null);
      setTemplates(templatesPayload.data ?? []);
      setTeacherUnavailableSlots(teacherUnavailablePayload.data ?? []);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
      if (payload.data?.classes?.[0]?.id) {
        const firstClass = payload.data.classes[0];
        setForm((prev) => (prev.classId ? prev : { ...prev, classId: firstClass.id }));
        setTemplateForm((prev) => prev.grade && prev.subject ? prev : { ...DEFAULT_TEMPLATE_FORM, grade: firstClass.grade, subject: firstClass.subject });
        setTeacherUnavailableForm((prev) => prev.teacherId ? prev : { ...DEFAULT_TEACHER_UNAVAILABLE_FORM, teacherId: firstClass.teacherId ?? "" });
      }
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setClasses([]);
        setSessions([]);
        setSummary(null);
        setTemplates([]);
        setTeacherUnavailableSlots([]);
      } else {
        setPageError(getRequestErrorMessage(error, "加载课程表管理失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData("initial");
  }, [loadData]);

  const scheduleCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((item) => {
      map.set(item.classId, (map.get(item.classId) ?? 0) + 1);
    });
    return map;
  }, [sessions]);

  const templateByKey = useMemo(() => {
    return new Map(templates.map((item) => [`${item.grade}:${item.subject}`, item]));
  }, [templates]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    classes.forEach((item) => {
      if (!item.teacherId) return;
      map.set(item.teacherId, { id: item.teacherId, name: item.teacherName ?? item.teacherId });
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [classes]);

  const gradeOptions = useMemo(() => Array.from(new Set(classes.map((item) => item.grade))).sort((left, right) => Number(left) - Number(right)), [classes]);
  const subjectOptions = useMemo(() => Array.from(new Set(classes.map((item) => item.subject))).sort((left, right) => left.localeCompare(right, "zh-CN")), [classes]);

  const aiWeeklyLessonsTarget = Math.max(0, Number(aiForm.weeklyLessonsPerClass) || 0);
  const getPreviewTargetForClass = useCallback((item: SchoolClassRecord) => {
    return templateByKey.get(`${item.grade}:${item.subject}`)?.weeklyLessonsPerClass ?? aiWeeklyLessonsTarget;
  }, [aiWeeklyLessonsTarget, templateByKey]);

  const aiTargetClassCount = useMemo(() => {
    return classes.filter((item) => (aiForm.mode === "replace_all" ? true : (scheduleCountByClass.get(item.id) ?? 0) < getPreviewTargetForClass(item))).length;
  }, [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]);

  const aiRequestedLessonCount = useMemo(() => {
    return classes.reduce((sum, item) => {
      const current = scheduleCountByClass.get(item.id) ?? 0;
      const target = getPreviewTargetForClass(item);
      return sum + (aiForm.mode === "replace_all" ? target : Math.max(target - current, 0));
    }, 0);
  }, [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]);

  const aiTeacherGapCount = useMemo(() => {
    return classes.filter((item) => {
      if (item.teacherId) return false;
      return aiForm.mode === "replace_all" ? true : (scheduleCountByClass.get(item.id) ?? 0) < getPreviewTargetForClass(item);
    }).length;
  }, [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]);

  const aiTemplateCoverageCount = useMemo(() => {
    return classes.filter((item) => templateByKey.has(`${item.grade}:${item.subject}`)).length;
  }, [classes, templateByKey]);

  const filteredSessions = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return sessions.filter((item) => {
      if (classFilter !== "all" && item.classId !== classFilter) return false;
      if (weekdayFilter !== "all" && String(item.weekday) !== weekdayFilter) return false;
      if (!keywordLower) return true;
      return [item.className, item.subject, item.grade, item.room ?? "", item.campus ?? "", item.focusSummary ?? "", item.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [classFilter, keyword, sessions, weekdayFilter]);

  const sessionsByWeekday = useMemo(() => {
    const map = new Map<string, ScheduleViewItem[]>();
    WEEKDAY_OPTIONS.forEach((item) => map.set(item.value, []));
    filteredSessions
      .slice()
      .sort((left, right) => {
        if (left.weekday !== right.weekday) return left.weekday - right.weekday;
        if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
        return left.className.localeCompare(right.className, "zh-CN");
      })
      .forEach((item) => {
        const list = map.get(String(item.weekday)) ?? [];
        list.push(item);
        map.set(String(item.weekday), list);
      });
    return map;
  }, [filteredSessions]);

  const resetForm = useCallback((options?: { preserveMessage?: boolean; nextClassId?: string }) => {
    setEditingId(null);
    setFormError(null);
    if (!options?.preserveMessage) {
      setFormMessage(null);
    }
    setForm((prev) => ({ ...EMPTY_FORM, classId: options?.nextClassId ?? classes[0]?.id ?? prev.classId }));
  }, [classes]);

  const startCreateForClass = useCallback((classId: string) => {
    setEditingId(null);
    setFormError(null);
    setFormMessage(null);
    setForm({ ...EMPTY_FORM, classId });
  }, []);

  const startEdit = useCallback((item: ScheduleViewItem) => {
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
  }, []);

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
      setFormError(getRequestErrorMessage(error, editingId ? "更新节次失败" : "创建节次失败"));
    } finally {
      setSaving(false);
    }
  }, [editingId, form, loadData, resetForm]);

  const handleDelete = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("确定删除这个课程节次吗？")) {
      return;
    }
    setDeletingId(id);
    setPageError(null);
    try {
      await requestJson<ScheduleMutationResponse>(`/api/school/schedules/${id}`, {
        method: "DELETE"
      });
      if (editingId === id) {
        resetForm({ preserveMessage: true });
      }
      await loadData("refresh");
      setFormMessage("课程节次已删除");
    } catch (error) {
      setPageError(getRequestErrorMessage(error, "删除节次失败"));
    } finally {
      setDeletingId(null);
    }
  }, [editingId, loadData, resetForm]);

  const toggleAiWeekday = useCallback((weekday: string) => {
    setAiForm((prev) => {
      const exists = prev.weekdays.includes(weekday);
      const weekdays = exists
        ? prev.weekdays.filter((item) => item !== weekday)
        : [...prev.weekdays, weekday].sort((left, right) => Number(left) - Number(right));
      return { ...prev, weekdays };
    });
  }, []);

  const resetAiForm = useCallback(() => {
    setAiForm(DEFAULT_AI_FORM);
    setAiError(null);
    setAiMessage(null);
    setAiResult(null);
  }, []);

  const handleAiGenerate = useCallback(async () => {
    const weeklyLessonsPerClass = Number(aiForm.weeklyLessonsPerClass);
    const lessonDurationMinutes = Number(aiForm.lessonDurationMinutes);
    const periodsPerDay = Number(aiForm.periodsPerDay);
    const shortBreakMinutes = Number(aiForm.shortBreakMinutes);
    const lunchBreakMinutes = Number(aiForm.lunchBreakMinutes);
    const lunchBreakAfterPeriod = aiForm.lunchBreakAfterPeriod ? Number(aiForm.lunchBreakAfterPeriod) : undefined;

    if (!aiForm.weekdays.length) {
      setAiError("请至少选择 1 个排课日。");
      return;
    }
    if (!Number.isFinite(weeklyLessonsPerClass) || weeklyLessonsPerClass < 1) {
      setAiError("请填写有效的每班每周总节数。");
      return;
    }
    if (aiForm.mode === "replace_all" && typeof window !== "undefined") {
      const confirmed = window.confirm("全量重排会替换当前学校现有课表，确定继续吗？");
      if (!confirmed) {
        return;
      }
    }

    setAiGenerating(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const result = await requestJson<AiScheduleResponse>("/api/school/schedules/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyLessonsPerClass,
          lessonDurationMinutes,
          periodsPerDay,
          weekdays: aiForm.weekdays.map((item) => Number(item)),
          dayStartTime: aiForm.dayStartTime,
          shortBreakMinutes,
          lunchBreakAfterPeriod,
          lunchBreakMinutes,
          mode: aiForm.mode,
          campus: aiForm.campus
        })
      });
      setAiResult(result.data ?? null);
      await loadData("refresh");
      setAiMessage(`AI 排课已完成，本次新增 ${result.data?.summary.createdSessions ?? 0} 个节次。`);
    } catch (error) {
      setAiError(getRequestErrorMessage(error, "AI 排课失败"));
    } finally {
      setAiGenerating(false);
    }
  }, [aiForm, loadData]);


  const toggleTemplateWeekday = useCallback((weekday: string) => {
    setTemplateForm((prev) => {
      const exists = prev.weekdays.includes(weekday);
      const weekdays = exists
        ? prev.weekdays.filter((item) => item !== weekday)
        : [...prev.weekdays, weekday].sort((left, right) => Number(left) - Number(right));
      return { ...prev, weekdays };
    });
  }, []);

  const resetTemplateForm = useCallback(() => {
    setTemplateForm((prev) => ({ ...DEFAULT_TEMPLATE_FORM, grade: prev.grade || gradeOptions[0] || "", subject: prev.subject || subjectOptions[0] || "" }));
    setTemplateError(null);
    setTemplateMessage(null);
  }, [gradeOptions, subjectOptions]);

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
      lunchBreakAfterPeriod: template.lunchBreakAfterPeriod ? String(template.lunchBreakAfterPeriod) : "",
      lunchBreakMinutes: String(template.lunchBreakMinutes),
      campus: template.campus ?? "主校区",
      weekdays: template.weekdays.map((item) => String(item))
    });
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    const weeklyLessonsPerClass = Number(templateForm.weeklyLessonsPerClass);
    const lessonDurationMinutes = Number(templateForm.lessonDurationMinutes);
    const periodsPerDay = Number(templateForm.periodsPerDay);
    const shortBreakMinutes = Number(templateForm.shortBreakMinutes);
    const lunchBreakMinutes = Number(templateForm.lunchBreakMinutes);
    const lunchBreakAfterPeriod = templateForm.lunchBreakAfterPeriod ? Number(templateForm.lunchBreakAfterPeriod) : undefined;
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
      setTemplateForm((prev) => ({ ...prev, id: undefined }));
    } catch (error) {
      setTemplateError(getRequestErrorMessage(error, "保存模板失败"));
    } finally {
      setTemplateSaving(false);
    }
  }, [loadData, templateForm]);


  const applyDraftTemplateToAi = useCallback(() => {
    if (!templateForm.grade || !templateForm.subject || !templateForm.weekdays.length) {
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
        weekdays: templateForm.weekdays.map((item) => Number(item)) as Array<1 | 2 | 3 | 4 | 5 | 6 | 7>,
        dayStartTime: templateForm.dayStartTime,
        shortBreakMinutes: Number(templateForm.shortBreakMinutes) || 10,
        lunchBreakAfterPeriod: templateForm.lunchBreakAfterPeriod ? Number(templateForm.lunchBreakAfterPeriod) : undefined,
        lunchBreakMinutes: Number(templateForm.lunchBreakMinutes) || 60,
        campus: templateForm.campus,
        createdAt: "",
        updatedAt: ""
      })
    );
    setTemplateMessage("模板参数已同步到 AI 排课配置区。");
  }, [templateForm]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("确定删除这个课时模板吗？")) {
      return;
    }
    setTemplateDeletingId(id);
    setTemplateError(null);
    setTemplateMessage(null);
    try {
      await requestJson(`/api/school/schedules/templates/${id}`, { method: "DELETE" });
      await loadData("refresh");
      if (templateForm.id === id) {
        resetTemplateForm();
      }
      setTemplateMessage("课时模板已删除");
    } catch (error) {
      setTemplateError(getRequestErrorMessage(error, "删除模板失败"));
    } finally {
      setTemplateDeletingId(null);
    }
  }, [loadData, resetTemplateForm, templateForm.id]);

  const handleSaveTeacherUnavailable = useCallback(async () => {
    if (!teacherUnavailableForm.teacherId) {
      setTeacherUnavailableError("请选择教师。");
      return;
    }
    setTeacherUnavailableSaving(true);
    setTeacherUnavailableError(null);
    setTeacherUnavailableMessage(null);
    try {
      await requestJson<TeacherUnavailableResponse>("/api/school/schedules/teacher-unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: teacherUnavailableForm.teacherId,
          weekday: Number(teacherUnavailableForm.weekday),
          startTime: teacherUnavailableForm.startTime,
          endTime: teacherUnavailableForm.endTime,
          reason: teacherUnavailableForm.reason
        })
      });
      await loadData("refresh");
      setTeacherUnavailableMessage("教师禁排时段已保存");
      setTeacherUnavailableForm((prev) => ({ ...DEFAULT_TEACHER_UNAVAILABLE_FORM, teacherId: prev.teacherId }));
    } catch (error) {
      setTeacherUnavailableError(getRequestErrorMessage(error, "保存教师禁排失败"));
    } finally {
      setTeacherUnavailableSaving(false);
    }
  }, [loadData, teacherUnavailableForm]);

  const handleDeleteTeacherUnavailable = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("确定删除这个教师禁排时段吗？")) {
      return;
    }
    setTeacherUnavailableDeletingId(id);
    setTeacherUnavailableError(null);
    setTeacherUnavailableMessage(null);
    try {
      await requestJson(`/api/school/schedules/teacher-unavailability/${id}`, { method: "DELETE" });
      await loadData("refresh");
      setTeacherUnavailableMessage("教师禁排时段已删除");
    } catch (error) {
      setTeacherUnavailableError(getRequestErrorMessage(error, "删除教师禁排失败"));
    } finally {
      setTeacherUnavailableDeletingId(null);
    }
  }, [loadData]);

  if (loading && !classes.length && !sessions.length && !authRequired) {
    return <StatePanel title="课程表管理加载中" description="正在汇总学校班级排课和课时覆盖情况。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要学校管理员权限"
        description="请使用学校管理员账号登录后查看课程表管理。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (!classes.length && !loading) {
    return (
      <StatePanel
        title="当前学校还没有班级"
        description="请先完成班级建档，再为班级配置课程表。"
        tone="empty"
        action={
          <Link className="button secondary" href="/school/classes">
            去看班级管理
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>课程表管理</h2>
          <div className="section-sub">由学校统一维护班级固定节次，把课程安排与作业、课程模块和学生日程联动起来。</div>
        </div>
        <div className="cta-row no-margin" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <span className="chip">School Schedule</span>
          <button className="button secondary" type="button" onClick={() => void loadData("refresh")} disabled={loading || refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? <StatePanel title="本次刷新存在异常" description={pageError} tone="error" compact /> : null}

      <Card title="排课运营概览" tag="统计">
        <div className="grid grid-3">
          <Stat label="班级总数" value={String(classes.length)} helper="学校范围" />
          <Stat label="已排课班级" value={String(summary?.activeClasses ?? 0)} helper="至少有 1 个节次" />
          <Stat label="未排课班级" value={String(summary?.classesWithoutScheduleCount ?? 0)} helper="优先补齐" />
          <Stat label="总节次" value={String(summary?.totalSessions ?? 0)} helper={`当前筛选 ${filteredSessions.length} 个`} />
          <Stat label="平均每班课时" value={String(summary?.averageLessonsPerWeek ?? 0)} helper="按周估算" />
          <Stat label="需关注班级" value={String(classes.filter((item) => (scheduleCountByClass.get(item.id) ?? 0) === 0).length)} helper="优先排首课" />
        </div>
      </Card>

      <Card title="AI 一键排课" tag="AI">
        <div className="grid" style={{ gap: 12 }}>
          <div className="section-sub">
            根据全校班级、教师绑定、每班总节数与单节课时，自动生成固定周课表，并尽量避开同一教师撞课。
          </div>

          <div className="grid grid-3">
            <Stat label="本轮目标班级" value={String(aiTargetClassCount)} helper={aiForm.mode === "replace_all" ? "全校现有课表重排" : "优先补齐不足班级"} />
            <Stat label="预计新增节次" value={String(aiRequestedLessonCount)} helper={`按每班 ${aiWeeklyLessonsTarget || 0} 节/周估算`} />
            <Stat label="待补教师班级" value={String(aiTeacherGapCount)} helper="未绑定教师会自动跳过" />
            <Stat label="已配置模板班级" value={String(aiTemplateCoverageCount)} helper="同年级同学科自动套用" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">排课模式</span>
              <select value={aiForm.mode} onChange={(event) => setAiForm((prev) => ({ ...prev, mode: event.target.value as AiMode }))} style={fieldStyle}>
                <option value="fill_missing">补齐不足课时</option>
                <option value="replace_all">全校重排课表</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">每班每周总节数</span>
              <input type="number" min={1} max={30} value={aiForm.weeklyLessonsPerClass} onChange={(event) => setAiForm((prev) => ({ ...prev, weeklyLessonsPerClass: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">单节课时（分钟）</span>
              <input type="number" min={30} max={120} value={aiForm.lessonDurationMinutes} onChange={(event) => setAiForm((prev) => ({ ...prev, lessonDurationMinutes: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">每日节次数</span>
              <input type="number" min={1} max={12} value={aiForm.periodsPerDay} onChange={(event) => setAiForm((prev) => ({ ...prev, periodsPerDay: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">首节开始时间</span>
              <input type="time" value={aiForm.dayStartTime} onChange={(event) => setAiForm((prev) => ({ ...prev, dayStartTime: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">课间（分钟）</span>
              <input type="number" min={0} max={30} value={aiForm.shortBreakMinutes} onChange={(event) => setAiForm((prev) => ({ ...prev, shortBreakMinutes: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">午休前节次</span>
              <input type="number" min={1} max={12} value={aiForm.lunchBreakAfterPeriod} onChange={(event) => setAiForm((prev) => ({ ...prev, lunchBreakAfterPeriod: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">午休（分钟）</span>
              <input type="number" min={0} max={180} value={aiForm.lunchBreakMinutes} onChange={(event) => setAiForm((prev) => ({ ...prev, lunchBreakMinutes: event.target.value }))} style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">默认校区</span>
              <input value={aiForm.campus} onChange={(event) => setAiForm((prev) => ({ ...prev, campus: event.target.value }))} placeholder="如：主校区 / 东校区" style={fieldStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">排课日</span>
            <div className="cta-row" style={{ flexWrap: "wrap" }}>
              {WEEKDAY_OPTIONS.map((item) => {
                const active = aiForm.weekdays.includes(item.value);
                return (
                  <button
                    key={item.value}
                    className={active ? "button secondary" : "button ghost"}
                    type="button"
                    onClick={() => toggleAiWeekday(item.value)}
                    disabled={aiGenerating}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {aiError ? <StatePanel compact tone="error" title="AI 排课失败" description={aiError} /> : null}
          {aiMessage ? <StatePanel compact tone="success" title="AI 排课完成" description={aiMessage} /> : null}

          <div className="cta-row">
            <button className="button primary" type="button" onClick={() => void handleAiGenerate()} disabled={aiGenerating}>
              {aiGenerating ? "AI 排课中..." : aiForm.mode === "replace_all" ? "AI 全校重排课表" : "一键 AI 辅助排课"}
            </button>
            <button className="button ghost" type="button" onClick={resetAiForm} disabled={aiGenerating}>
              重置配置
            </button>
          </div>

          {aiResult ? (
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div className="card">
                <div className="section-title">本次 AI 结果</div>
                <div className="meta-text" style={{ marginTop: 6 }}>
                  目标班级 {aiResult.summary.targetClassCount} 个 · 新增节次 {aiResult.summary.createdSessions} 个 · 未完成 {aiResult.summary.unresolvedLessons} 节
                </div>
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  {aiResult.createdSessions.slice(0, 6).map((item) => (
                    <div key={item.id} style={{ border: "1px solid var(--stroke)", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{item.className}</div>
                      <div className="section-sub" style={{ marginTop: 4 }}>{item.startTime}-{item.endTime}{item.slotLabel ? ` · ${item.slotLabel}` : ""}</div>
                      <div className="meta-text" style={{ marginTop: 6 }}>{formatSubjectLine(item)}{item.room ? ` · ${item.room}` : ""}</div>
                    </div>
                  ))}
                  {!aiResult.createdSessions.length ? <div className="section-sub">本次没有生成新节次。</div> : null}
                </div>
              </div>

              <div className="card">
                <div className="section-title">班级处理明细</div>
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  {aiResult.impactedClasses.slice(0, 8).map((item) => (
                    <div key={item.id} style={{ border: "1px solid var(--stroke)", borderRadius: 12, padding: 10 }}>
                      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                          <div className="section-sub" style={{ marginTop: 4 }}>{item.subject} · {item.grade} 年级 · 教师 {item.teacherName ?? item.teacherId ?? "未绑定"}</div>
                        </div>
                        <span className="pill">{item.status === "generated" ? "已生成" : item.status === "unchanged" ? "已达标" : "已跳过"}</span>
                      </div>
                      <div className="meta-text" style={{ marginTop: 6 }}>
                        目标 {item.requestedLessons} 节 · 新增 {item.createdLessons} 节 · 课表总数 {item.totalLessonsAfter} 节
                      </div>
                      {item.reason ? <div className="meta-text" style={{ marginTop: 6 }}>说明：{item.reason}</div> : null}
                    </div>
                  ))}
                </div>
                {aiResult.warnings.length ? (
                  <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                    <div className="section-title">需人工确认</div>
                    {aiResult.warnings.slice(0, 6).map((warning, index) => (
                      <div key={`${warning}-${index}`} className="meta-text">- {warning}</div>
                    ))}
                  </div>
                ) : (
                  <div className="meta-text" style={{ marginTop: 12 }}>本轮未发现需要人工处理的异常约束。</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Card>


      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="年级学科课时模板" tag="模板">
          <div className="grid" style={{ gap: 12 }}>
            <div className="section-sub">为同年级同学科配置默认每周节数、课时和时段参数，AI 排课时会自动优先套用。</div>
            <div className="grid grid-3">
              <Stat label="模板总数" value={String(templates.length)} helper="学校级规则库" />
              <Stat label="模板覆盖班级" value={String(aiTemplateCoverageCount)} helper="可直接套用" />
              <Stat label="禁排时段" value={String(teacherUnavailableSlots.length)} helper="教师约束" />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">年级</span>
                <select value={templateForm.grade} onChange={(event) => setTemplateForm((prev) => ({ ...prev, grade: event.target.value }))} style={fieldStyle}>
                  <option value="">请选择年级</option>
                  {gradeOptions.map((item) => <option key={item} value={item}>{item} 年级</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">学科</span>
                <select value={templateForm.subject} onChange={(event) => setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))} style={fieldStyle}>
                  <option value="">请选择学科</option>
                  {subjectOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">每周总节数</span>
                <input type="number" min={1} max={30} value={templateForm.weeklyLessonsPerClass} onChange={(event) => setTemplateForm((prev) => ({ ...prev, weeklyLessonsPerClass: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">单节课时</span>
                <input type="number" min={30} max={120} value={templateForm.lessonDurationMinutes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, lessonDurationMinutes: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">每日节次数</span>
                <input type="number" min={1} max={12} value={templateForm.periodsPerDay} onChange={(event) => setTemplateForm((prev) => ({ ...prev, periodsPerDay: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">首节时间</span>
                <input type="time" value={templateForm.dayStartTime} onChange={(event) => setTemplateForm((prev) => ({ ...prev, dayStartTime: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">课间</span>
                <input type="number" min={0} max={30} value={templateForm.shortBreakMinutes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, shortBreakMinutes: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">午休前节次</span>
                <input type="number" min={1} max={12} value={templateForm.lunchBreakAfterPeriod} onChange={(event) => setTemplateForm((prev) => ({ ...prev, lunchBreakAfterPeriod: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">午休时长</span>
                <input type="number" min={0} max={180} value={templateForm.lunchBreakMinutes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, lunchBreakMinutes: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">默认校区</span>
                <input value={templateForm.campus} onChange={(event) => setTemplateForm((prev) => ({ ...prev, campus: event.target.value }))} style={fieldStyle} />
              </label>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">模板排课日</span>
              <div className="cta-row" style={{ flexWrap: "wrap" }}>
                {WEEKDAY_OPTIONS.map((item) => {
                  const active = templateForm.weekdays.includes(item.value);
                  return (
                    <button key={item.value} className={active ? "button secondary" : "button ghost"} type="button" onClick={() => toggleTemplateWeekday(item.value)}>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {templateError ? <StatePanel compact tone="error" title="模板保存失败" description={templateError} /> : null}
            {templateMessage ? <StatePanel compact tone="success" title="模板已更新" description={templateMessage} /> : null}
            <div className="cta-row">
              <button className="button primary" type="button" onClick={() => void handleSaveTemplate()} disabled={templateSaving}>
                {templateSaving ? "保存中..." : templateForm.id ? "更新模板" : "保存模板"}
              </button>
              <button className="button ghost" type="button" onClick={resetTemplateForm} disabled={templateSaving}>重置</button>
              <button className="button secondary" type="button" onClick={applyDraftTemplateToAi} disabled={templateSaving || !templateForm.grade || !templateForm.subject}>应用到 AI 参数</button>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {templates.map((item) => (
                <div key={item.id} className="card">
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div className="section-title">{item.grade} 年级 · {item.subject}</div>
                      <div className="meta-text" style={{ marginTop: 6 }}>
                        {item.weeklyLessonsPerClass} 节/周 · {item.lessonDurationMinutes} 分钟 · 每日 {item.periodsPerDay} 节 · {item.dayStartTime} 开始
                      </div>
                    </div>
                    <span className="pill">{item.weekdays.map((day) => WEEKDAY_OPTIONS.find((option) => option.value === String(day))?.label ?? day).join(" / ")}</span>
                  </div>
                  <div className="cta-row cta-row-tight" style={{ marginTop: 10 }}>
                    <button className="button secondary" type="button" onClick={() => setAiForm(applyTemplateToAiForm(item))}>应用到 AI</button>
                    <button className="button ghost" type="button" onClick={() => startEditTemplate(item)}>编辑</button>
                    <button className="button ghost" type="button" onClick={() => void handleDeleteTemplate(item.id)} disabled={templateDeletingId === item.id}>
                      {templateDeletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
              ))}
              {!templates.length ? <div className="section-sub">还没有模板，建议先为高频年级学科配置默认课时。</div> : null}
            </div>
          </div>
        </Card>

        <Card title="教师禁排时段" tag="约束">
          <div className="grid" style={{ gap: 12 }}>
            <div className="section-sub">配置教师固定禁排窗口，AI 排课和手动新建节次都会自动避开这些时间。</div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">教师</span>
                <select value={teacherUnavailableForm.teacherId} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, teacherId: event.target.value }))} style={fieldStyle}>
                  <option value="">请选择教师</option>
                  {teacherOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">星期</span>
                <select value={teacherUnavailableForm.weekday} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, weekday: event.target.value }))} style={fieldStyle}>
                  {WEEKDAY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">开始时间</span>
                <input type="time" value={teacherUnavailableForm.startTime} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, startTime: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">结束时间</span>
                <input type="time" value={teacherUnavailableForm.endTime} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, endTime: event.target.value }))} style={fieldStyle} />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">原因说明</span>
              <input value={teacherUnavailableForm.reason} onChange={(event) => setTeacherUnavailableForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="如：教研会 / 固定值班 / 跨校区授课" style={fieldStyle} />
            </label>
            {teacherUnavailableError ? <StatePanel compact tone="error" title="教师禁排保存失败" description={teacherUnavailableError} /> : null}
            {teacherUnavailableMessage ? <StatePanel compact tone="success" title="教师禁排已更新" description={teacherUnavailableMessage} /> : null}
            <div className="cta-row">
              <button className="button primary" type="button" onClick={() => void handleSaveTeacherUnavailable()} disabled={teacherUnavailableSaving}>
                {teacherUnavailableSaving ? "保存中..." : "保存禁排时段"}
              </button>
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {teacherUnavailableSlots.map((item) => {
                const teacherName = teacherOptions.find((option) => option.id === item.teacherId)?.name ?? item.teacherId;
                return (
                  <div key={item.id} className="card">
                    <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div className="section-title">{teacherName}</div>
                        <div className="meta-text" style={{ marginTop: 6 }}>
                          {WEEKDAY_OPTIONS.find((option) => option.value === String(item.weekday))?.label ?? item.weekday} · {item.startTime}-{item.endTime}
                        </div>
                        {item.reason ? <div className="meta-text" style={{ marginTop: 6 }}>原因：{item.reason}</div> : null}
                      </div>
                      <button className="button ghost" type="button" onClick={() => void handleDeleteTeacherUnavailable(item.id)} disabled={teacherUnavailableDeletingId === item.id}>
                        {teacherUnavailableDeletingId === item.id ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!teacherUnavailableSlots.length ? <div className="section-sub">当前未配置教师禁排时段。</div> : null}
            </div>
          </div>
        </Card>
      </div>

      <Card title="筛选与检索" tag="筛选">
        <div className="grid grid-3" style={{ alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">班级</span>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} style={fieldStyle}>
              <option value="all">全部班级</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">星期</span>
            <select value={weekdayFilter} onChange={(event) => setWeekdayFilter(event.target.value)} style={fieldStyle}>
              <option value="all">全部星期</option>
              {WEEKDAY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="section-sub">搜索节次</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索班级、教室、校区或课堂焦点" style={fieldStyle} />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={() => { setClassFilter("all"); setWeekdayFilter("all"); setKeyword(""); }}>
            清空筛选
          </button>
        </div>
      </Card>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title={editingId ? "编辑课程节次" : "新建课程节次"} tag={editingId ? "编辑" : "新建"}>
          <div className="grid" style={{ gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">班级</span>
              <select value={form.classId} onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))} style={fieldStyle}>
                <option value="">请选择班级</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.subject} · {item.grade} 年级</option>
                ))}
              </select>
            </label>
            <div className="grid grid-2">
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">星期</span>
                <select value={form.weekday} onChange={(event) => setForm((prev) => ({ ...prev, weekday: event.target.value }))} style={fieldStyle}>
                  {WEEKDAY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">节次名称</span>
                <input value={form.slotLabel} onChange={(event) => setForm((prev) => ({ ...prev, slotLabel: event.target.value }))} placeholder="如：第一节 / 晚自习" style={fieldStyle} />
              </label>
            </div>
            <div className="grid grid-2">
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">开始时间</span>
                <input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">结束时间</span>
                <input type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} style={fieldStyle} />
              </label>
            </div>
            <div className="grid grid-2">
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">教室</span>
                <input value={form.room} onChange={(event) => setForm((prev) => ({ ...prev, room: event.target.value }))} placeholder="如：A201" style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="section-sub">校区</span>
                <input value={form.campus} onChange={(event) => setForm((prev) => ({ ...prev, campus: event.target.value }))} placeholder="如：主校区" style={fieldStyle} />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">课堂焦点</span>
              <input value={form.focusSummary} onChange={(event) => setForm((prev) => ({ ...prev, focusSummary: event.target.value }))} placeholder="如：分数应用、作文审题、口语演练" style={fieldStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="section-sub">补充备注</span>
              <textarea value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} rows={3} placeholder="如：课前带练习册、第三周起改到实验室" style={fieldStyle} />
            </label>
            {formError ? <div style={{ color: "#b42318", fontSize: 13 }}>{formError}</div> : null}
            {formMessage ? <div style={{ color: "#027a48", fontSize: 13 }}>{formMessage}</div> : null}
            <div className="cta-row">
              <button className="button primary" type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "保存中..." : editingId ? "保存修改" : "创建节次"}
              </button>
              <button className="button ghost" type="button" onClick={() => resetForm()} disabled={saving}>
                {editingId ? "取消编辑" : "重置表单"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="当前周视图" tag="周视图">
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(180px, 1fr))", gap: 12, minWidth: 1280 }}>
              {WEEKDAY_OPTIONS.map((weekday) => {
                const list = sessionsByWeekday.get(weekday.value) ?? [];
                return (
                  <div className="card" key={weekday.value} style={{ minHeight: 220 }}>
                    <div className="section-title">{weekday.label}</div>
                    <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                      {list.length ? (
                        list.map((item) => (
                          <div key={item.id} style={{ border: "1px solid var(--stroke)", borderRadius: 14, padding: 10, background: "rgba(255,255,255,0.72)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{item.className}</div>
                            <div className="section-sub" style={{ marginTop: 4 }}>{item.startTime}-{item.endTime}{item.slotLabel ? ` · ${item.slotLabel}` : ""}</div>
                            <div className="meta-text" style={{ marginTop: 6 }}>{formatSubjectLine(item)}{item.room ? ` · ${item.room}` : ""}</div>
                            {item.focusSummary ? <div className="meta-text" style={{ marginTop: 6 }}>课堂焦点：{item.focusSummary}</div> : null}
                            {item.note ? <div className="meta-text" style={{ marginTop: 6 }}>备注：{item.note}</div> : null}
                            <div className="cta-row cta-row-tight" style={{ marginTop: 10 }}>
                              <button className="button secondary" type="button" onClick={() => startEdit(item)}>编辑</button>
                              <button className="button ghost" type="button" onClick={() => void handleDelete(item.id)} disabled={deletingId === item.id}>
                                {deletingId === item.id ? "删除中..." : "删除"}
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="section-sub">暂无节次</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <Card title="班级排课状态" tag="覆盖">
        <div className="grid" style={{ gap: 10 }}>
          {classes.map((item) => {
            const scheduleCount = scheduleCountByClass.get(item.id) ?? 0;
            const hasSchedule = scheduleCount > 0;
            return (
              <div className="card" key={item.id}>
                <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div className="section-title">{item.name}</div>
                    <div className="section-sub" style={{ marginTop: 4 }}>
                      {item.subject} · {item.grade} 年级 · 教师 {item.teacherName ?? item.teacherId ?? "未绑定"}
                    </div>
                    <div className="meta-text" style={{ marginTop: 6 }}>
                      当前已排 {scheduleCount} 节/周 · 作业 {item.assignmentCount} 份 · 学生 {item.studentCount} 人
                    </div>
                  </div>
                  <span className="pill">{hasSchedule ? `${scheduleCount} 节/周` : "待排课"}</span>
                </div>
                <div className="cta-row" style={{ marginTop: 10 }}>
                  <button className="button ghost" type="button" onClick={() => startCreateForClass(item.id)}>
                    为该班排课
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
