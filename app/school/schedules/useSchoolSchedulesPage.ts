"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { SchoolClassRecord, SchoolUserRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import type { TeacherUnavailableSlot } from "@/lib/teacher-unavailability";
import type {
  AiMode,
  AiOperationSummary,
  AiRollbackResponse,
  AiScheduleResponse,
  AiScheduleFormState,
  LatestAiOperationResponse,
  ScheduleFormState,
  ScheduleMutationResponse,
  ScheduleTemplateResponse,
  ScheduleViewItem,
  SchoolSchedulesData,
  SchoolSchedulesResponse,
  SchoolUsersResponse,
  TeacherRuleFormState,
  TeacherRuleListResponse,
  TeacherRuleMutationResponse,
  TeacherUnavailableFormState,
  TeacherUnavailableResponse,
  TemplateFormState
} from "./types";
import {
  DEFAULT_AI_FORM,
  DEFAULT_TEACHER_RULE_FORM,
  DEFAULT_TEACHER_UNAVAILABLE_FORM,
  DEFAULT_TEMPLATE_FORM,
  EMPTY_FORM,
  WEEKDAY_OPTIONS,
  addMinutesToTime,
  applyTemplateToAiForm,
  formatTeacherRuleSummary,
  toOptionalNumber
} from "./utils";

export function useSchoolSchedulesPage() {
  const manualEditorRef = useRef<HTMLDivElement | null>(null);
  const weekViewRef = useRef<HTMLDivElement | null>(null);
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
  const [aiRollingBack, setAiRollingBack] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiScheduleResponse["data"] | null>(null);
  const [latestAiOperation, setLatestAiOperation] = useState<AiOperationSummary | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SchoolScheduleTemplate[]>([]);
  const [teacherRules, setTeacherRules] = useState<TeacherScheduleRule[]>([]);
  const [teacherUnavailableSlots, setTeacherUnavailableSlots] = useState<TeacherUnavailableSlot[]>([]);
  const [teachers, setTeachers] = useState<SchoolUserRecord[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(DEFAULT_TEMPLATE_FORM);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateDeletingId, setTemplateDeletingId] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [teacherRuleForm, setTeacherRuleForm] = useState<TeacherRuleFormState>(DEFAULT_TEACHER_RULE_FORM);
  const [teacherRuleSaving, setTeacherRuleSaving] = useState(false);
  const [teacherRuleDeletingId, setTeacherRuleDeletingId] = useState<string | null>(null);
  const [teacherRuleMessage, setTeacherRuleMessage] = useState<string | null>(null);
  const [teacherRuleError, setTeacherRuleError] = useState<string | null>(null);
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
      const [payload, templatesPayload, teacherRulesPayload, teacherUnavailablePayload, teachersPayload, latestAiOperationPayload] =
        await Promise.all([
          requestJson<SchoolSchedulesResponse>("/api/school/schedules"),
          requestJson<ScheduleTemplateResponse>("/api/school/schedules/templates"),
          requestJson<TeacherRuleListResponse>("/api/school/schedules/teacher-rules"),
          requestJson<TeacherUnavailableResponse>("/api/school/schedules/teacher-unavailability"),
          requestJson<SchoolUsersResponse>("/api/school/users?role=teacher"),
          requestJson<LatestAiOperationResponse>("/api/school/schedules/ai-operations/latest")
        ]);
      setClasses(payload.data?.classes ?? []);
      setSessions(payload.data?.sessions ?? []);
      setSummary(payload.data?.summary ?? null);
      setTemplates(templatesPayload.data ?? []);
      setTeacherRules(teacherRulesPayload.data ?? []);
      setTeacherUnavailableSlots(teacherUnavailablePayload.data ?? []);
      setTeachers(teachersPayload.data ?? []);
      setLatestAiOperation(latestAiOperationPayload.data ?? null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
      if (payload.data?.classes?.[0]?.id) {
        const firstClass = payload.data.classes[0];
        setForm((prev) => (prev.classId ? prev : { ...prev, classId: firstClass.id }));
        setTemplateForm((prev) =>
          prev.grade && prev.subject ? prev : { ...DEFAULT_TEMPLATE_FORM, grade: firstClass.grade, subject: firstClass.subject }
        );
        setTeacherRuleForm((prev) =>
          prev.teacherId ? prev : { ...DEFAULT_TEACHER_RULE_FORM, teacherId: firstClass.teacherId ?? "" }
        );
        setTeacherUnavailableForm((prev) =>
          prev.teacherId ? prev : { ...DEFAULT_TEACHER_UNAVAILABLE_FORM, teacherId: firstClass.teacherId ?? "" }
        );
      }
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setClasses([]);
        setSessions([]);
        setSummary(null);
        setTemplates([]);
        setTeacherRules([]);
        setTeacherUnavailableSlots([]);
        setTeachers([]);
        setLatestAiOperation(null);
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

  const templateByKey = useMemo(() => new Map(templates.map((item) => [`${item.grade}:${item.subject}`, item])), [templates]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    teachers.forEach((item) => {
      map.set(item.id, { id: item.id, name: item.name || item.email || item.id });
    });
    classes.forEach((item) => {
      if (!item.teacherId || map.has(item.teacherId)) return;
      map.set(item.teacherId, { id: item.teacherId, name: item.teacherName ?? item.teacherId });
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [classes, teachers]);

  const teacherRuleByTeacherId = useMemo(() => new Map(teacherRules.map((item) => [item.teacherId, item])), [teacherRules]);
  const teacherRuleCoverageCount = useMemo(
    () => classes.filter((item) => item.teacherId && teacherRuleByTeacherId.has(item.teacherId)).length,
    [classes, teacherRuleByTeacherId]
  );
  const crossCampusRuleCount = useMemo(
    () => teacherRules.filter((item) => item.minCampusGapMinutes).length,
    [teacherRules]
  );

  const gradeOptions = useMemo(
    () => Array.from(new Set(classes.map((item) => item.grade))).sort((left, right) => Number(left) - Number(right)),
    [classes]
  );
  const subjectOptions = useMemo(
    () => Array.from(new Set(classes.map((item) => item.subject))).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [classes]
  );

  const aiWeeklyLessonsTarget = Math.max(0, Number(aiForm.weeklyLessonsPerClass) || 0);
  const getPreviewTargetForClass = useCallback(
    (item: SchoolClassRecord) => templateByKey.get(`${item.grade}:${item.subject}`)?.weeklyLessonsPerClass ?? aiWeeklyLessonsTarget,
    [aiWeeklyLessonsTarget, templateByKey]
  );

  const aiTargetClassCount = useMemo(
    () =>
      classes.filter((item) =>
        aiForm.mode === "replace_all" ? true : (scheduleCountByClass.get(item.id) ?? 0) < getPreviewTargetForClass(item)
      ).length,
    [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]
  );

  const aiRequestedLessonCount = useMemo(
    () =>
      classes.reduce((sum, item) => {
        const current = scheduleCountByClass.get(item.id) ?? 0;
        const target = getPreviewTargetForClass(item);
        return sum + (aiForm.mode === "replace_all" ? target : Math.max(target - current, 0));
      }, 0),
    [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]
  );

  const aiTeacherGapCount = useMemo(
    () =>
      classes.filter((item) => {
        if (item.teacherId) return false;
        return aiForm.mode === "replace_all" ? true : (scheduleCountByClass.get(item.id) ?? 0) < getPreviewTargetForClass(item);
      }).length,
    [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]
  );

  const aiTemplateCoverageCount = useMemo(
    () => classes.filter((item) => templateByKey.has(`${item.grade}:${item.subject}`)).length,
    [classes, templateByKey]
  );

  const lockedSessionCount = useMemo(() => sessions.filter((item) => item.locked).length, [sessions]);

  const targetedAiClasses = useMemo(
    () =>
      classes.filter((item) =>
        aiForm.mode === "replace_all" ? true : (scheduleCountByClass.get(item.id) ?? 0) < getPreviewTargetForClass(item)
      ),
    [aiForm.mode, classes, getPreviewTargetForClass, scheduleCountByClass]
  );
  const aiTeacherBoundTargetCount = useMemo(
    () => targetedAiClasses.filter((item) => Boolean(item.teacherId)).length,
    [targetedAiClasses]
  );
  const aiMissingTemplateTargetCount = useMemo(
    () => targetedAiClasses.filter((item) => !templateByKey.has(`${item.grade}:${item.subject}`)).length,
    [targetedAiClasses, templateByKey]
  );
  const aiTeacherRuleGapTargetCount = useMemo(
    () => targetedAiClasses.filter((item) => item.teacherId && !teacherRuleByTeacherId.has(item.teacherId)).length,
    [targetedAiClasses, teacherRuleByTeacherId]
  );
  const aiZeroScheduleTargetCount = useMemo(
    () => targetedAiClasses.filter((item) => (scheduleCountByClass.get(item.id) ?? 0) === 0).length,
    [scheduleCountByClass, targetedAiClasses]
  );

  const aiPreviewBlockingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!aiForm.weekdays.length) reasons.push("至少选择 1 个排课日");
    if (!aiForm.dayStartTime) reasons.push("需要设置首节开始时间");
    if ((Number(aiForm.periodsPerDay) || 0) <= 0) reasons.push("每日节次数需要大于 0");
    if ((Number(aiForm.lessonDurationMinutes) || 0) <= 0) reasons.push("单节课时需要大于 0 分钟");
    if (aiTargetClassCount <= 0 || aiRequestedLessonCount <= 0) {
      reasons.push(
        aiForm.mode === "replace_all" ? "当前没有可处理的班级" : "当前没有需要补齐的课时，可切换为全校重排或调整模板"
      );
    }
    if (aiTeacherBoundTargetCount <= 0) reasons.push("目标班级里还没有绑定教师的班级，AI 排课无法落位");
    return reasons;
  }, [
    aiForm.dayStartTime,
    aiForm.lessonDurationMinutes,
    aiForm.mode,
    aiForm.periodsPerDay,
    aiForm.weekdays.length,
    aiRequestedLessonCount,
    aiTargetClassCount,
    aiTeacherBoundTargetCount
  ]);

  const aiPreviewWarningReasons = useMemo(() => {
    const reasons: string[] = [];
    if (aiTeacherGapCount > 0) reasons.push(`${aiTeacherGapCount} 个目标班级未绑定教师，将在 AI 排课时自动跳过`);
    if (aiMissingTemplateTargetCount > 0) reasons.push(`${aiMissingTemplateTargetCount} 个目标班级缺少年级学科模板，将回退到当前全局参数`);
    if (aiTeacherRuleGapTargetCount > 0) reasons.push(`${aiTeacherRuleGapTargetCount} 个目标班级还未配置教师排课规则，建议先补齐约束`);
    if (teacherUnavailableSlots.length === 0) reasons.push("当前还没有教师禁排时段，教研会或固定值班时间不会被提前避开");
    if (aiForm.mode === "replace_all" && lockedSessionCount === 0) reasons.push("当前没有锁定节次，全校重排时不会保留关键课时");
    return reasons;
  }, [
    aiForm.mode,
    aiTeacherGapCount,
    aiMissingTemplateTargetCount,
    aiTeacherRuleGapTargetCount,
    lockedSessionCount,
    teacherUnavailableSlots.length
  ]);

  const aiReadinessLabel = aiPreviewBlockingReasons.length ? "暂不可预演" : aiPreviewWarningReasons.length ? "建议补配置" : "可直接预演";
  const aiReadinessTone = aiPreviewBlockingReasons.length ? "#b42318" : aiPreviewWarningReasons.length ? "#b54708" : "#027a48";

  const lockedCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((item) => {
      if (!item.locked) return;
      map.set(item.classId, (map.get(item.classId) ?? 0) + 1);
    });
    return map;
  }, [sessions]);
  const classWeekdayCountByClass = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    sessions.forEach((item) => {
      const weekdayMap = map.get(item.classId) ?? new Map<string, number>();
      const weekdayKey = String(item.weekday);
      weekdayMap.set(weekdayKey, (weekdayMap.get(weekdayKey) ?? 0) + 1);
      map.set(item.classId, weekdayMap);
    });
    return map;
  }, [sessions]);
  const selectedManualClass = useMemo(() => classes.find((item) => item.id === form.classId) ?? null, [classes, form.classId]);
  const selectedManualClassTemplate = useMemo(
    () => (selectedManualClass ? templateByKey.get(`${selectedManualClass.grade}:${selectedManualClass.subject}`) ?? null : null),
    [selectedManualClass, templateByKey]
  );
  const selectedManualTeacherRule = useMemo(
    () => (selectedManualClass?.teacherId ? teacherRuleByTeacherId.get(selectedManualClass.teacherId) ?? null : null),
    [selectedManualClass, teacherRuleByTeacherId]
  );
  const selectedManualClassScheduleCount = selectedManualClass ? scheduleCountByClass.get(selectedManualClass.id) ?? 0 : 0;
  const selectedManualClassLockedCount = selectedManualClass ? lockedCountByClass.get(selectedManualClass.id) ?? 0 : 0;
  const selectedWeekViewClass = useMemo(
    () => (classFilter === "all" ? null : classes.find((item) => item.id === classFilter) ?? null),
    [classFilter, classes]
  );
  const selectedWeekdayOption = useMemo(
    () => (weekdayFilter === "all" ? null : WEEKDAY_OPTIONS.find((item) => item.value === weekdayFilter) ?? null),
    [weekdayFilter]
  );
  const trimmedKeyword = keyword.trim();
  const activeWeekViewFilterCount =
    Number(Boolean(selectedWeekViewClass)) + Number(Boolean(selectedWeekdayOption)) + Number(Boolean(trimmedKeyword));

  const filteredSessions = useMemo(() => {
    const keywordLower = trimmedKeyword.toLowerCase();
    return sessions.filter((item) => {
      if (classFilter !== "all" && item.classId !== classFilter) return false;
      if (weekdayFilter !== "all" && String(item.weekday) !== weekdayFilter) return false;
      if (!keywordLower) return true;
      return [item.className, item.subject, item.grade, item.room ?? "", item.campus ?? "", item.focusSummary ?? "", item.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [classFilter, sessions, trimmedKeyword, weekdayFilter]);
  const filteredLockedSessionCount = useMemo(() => filteredSessions.filter((item) => item.locked).length, [filteredSessions]);

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

  const scrollToManualEditor = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      manualEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const scrollToWeekView = useCallback(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      weekViewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const buildManualScheduleDraft = useCallback((classId: string) => {
    const klass = classes.find((item) => item.id === classId);
    const template = klass ? templateByKey.get(`${klass.grade}:${klass.subject}`) ?? null : null;
    const weekdayCountMap = classWeekdayCountByClass.get(classId) ?? new Map<string, number>();
    const candidateWeekdays = template?.weekdays?.length ? template.weekdays.map((item) => String(item)) : WEEKDAY_OPTIONS.map((item) => item.value);
    const weekday =
      candidateWeekdays
        .slice()
        .sort((left, right) => (weekdayCountMap.get(left) ?? 0) - (weekdayCountMap.get(right) ?? 0) || Number(left) - Number(right))[0] ??
      EMPTY_FORM.weekday;
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
  }, [classWeekdayCountByClass, classes, templateByKey]);

  const resetForm = useCallback((options?: { preserveMessage?: boolean; nextClassId?: string }) => {
    setEditingId(null);
    setFormError(null);
    if (!options?.preserveMessage) {
      setFormMessage(null);
    }
    const nextClassId = options?.nextClassId ?? classes[0]?.id ?? "";
    setForm(nextClassId ? buildManualScheduleDraft(nextClassId) : { ...EMPTY_FORM, classId: nextClassId });
  }, [buildManualScheduleDraft, classes]);

  const startCreateForClass = useCallback((classId: string) => {
    setEditingId(null);
    setFormError(null);
    setFormMessage(null);
    setForm(buildManualScheduleDraft(classId));
    scrollToManualEditor();
  }, [buildManualScheduleDraft, scrollToManualEditor]);

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
    scrollToManualEditor();
  }, [scrollToManualEditor]);

  const clearWeekViewFilters = useCallback(() => {
    setClassFilter("all");
    setWeekdayFilter("all");
    setKeyword("");
  }, []);

  const keepFocusedClassWeekView = useCallback(() => {
    if (classFilter === "all") return;
    setWeekdayFilter("all");
    setKeyword("");
  }, [classFilter]);

  const focusClassInWeekView = useCallback((classId: string) => {
    setClassFilter(classId);
    setWeekdayFilter("all");
    setKeyword("");
    scrollToWeekView();
  }, [scrollToWeekView]);

  const applySelectedClassTemplateToForm = useCallback(() => {
    if (!selectedManualClass) return;
    const draft = buildManualScheduleDraft(selectedManualClass.id);
    setForm((prev) => ({
      ...prev,
      classId: selectedManualClass.id,
      weekday: draft.weekday,
      startTime: draft.startTime,
      endTime: draft.endTime,
      campus: draft.campus || prev.campus
    }));
    setFormMessage("已带入该班模板的推荐星期、时间和校区，可继续微调后保存。");
    setFormError(null);
  }, [buildManualScheduleDraft, selectedManualClass]);

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
      await requestJson<ScheduleMutationResponse>(`/api/school/schedules/${id}`, { method: "DELETE" });
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

  const buildAiRequestBody = useCallback(() => {
    const weeklyLessonsPerClass = Number(aiForm.weeklyLessonsPerClass);
    const lessonDurationMinutes = Number(aiForm.lessonDurationMinutes);
    const periodsPerDay = Number(aiForm.periodsPerDay);
    const shortBreakMinutes = Number(aiForm.shortBreakMinutes);
    const lunchBreakMinutes = Number(aiForm.lunchBreakMinutes);
    const lunchBreakAfterPeriod = aiForm.lunchBreakAfterPeriod ? Number(aiForm.lunchBreakAfterPeriod) : undefined;

    if (!aiForm.weekdays.length) {
      throw new Error("请至少选择 1 个排课日。");
    }
    if (!Number.isFinite(weeklyLessonsPerClass) || weeklyLessonsPerClass < 1) {
      throw new Error("请填写有效的每班每周总节数。");
    }

    return {
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
    };
  }, [aiForm]);

  const handleAiPreview = useCallback(async () => {
    try {
      const payload = buildAiRequestBody();
      setAiGenerating(true);
      setAiError(null);
      setAiMessage(null);
      const result = await requestJson<AiScheduleResponse>("/api/school/schedules/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setAiResult(result.data ?? null);
      setAiMessage(`AI 预演已完成，预计新增 ${result.data?.summary.createdSessions ?? 0} 个节次。`);
    } catch (error) {
      setAiError(getRequestErrorMessage(error, "AI 预演失败"));
    } finally {
      setAiGenerating(false);
    }
  }, [buildAiRequestBody]);

  const handleAiApplyPreview = useCallback(async () => {
    if (!aiResult?.previewId) {
      setAiError("请先完成一次 AI 预演。");
      return;
    }
    if (aiForm.mode === "replace_all" && typeof window !== "undefined") {
      const confirmed = window.confirm("确认将本次 AI 预演正式写入课表吗？系统会保留已锁定节次，并支持回滚最近一次 AI 排课。");
      if (!confirmed) return;
    }

    setAiGenerating(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const result = await requestJson<AiScheduleResponse>(`/api/school/schedules/ai-preview/${aiResult.previewId}/apply`, {
        method: "POST"
      });
      setAiResult(result.data ?? null);
      await loadData("refresh");
      setAiMessage(`AI 排课已写入课表，本次新增 ${result.data?.summary.createdSessions ?? 0} 个节次。`);
    } catch (error) {
      setAiError(getRequestErrorMessage(error, "确认写入 AI 排课失败"));
    } finally {
      setAiGenerating(false);
    }
  }, [aiForm.mode, aiResult?.previewId, loadData]);

  const handleAiRollback = useCallback(async () => {
    if (!latestAiOperation?.id) {
      setAiError("当前没有可回滚的 AI 排课记录。");
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("确定回滚最近一次已写入的 AI 排课吗？仅在课表未被后续人工调整时可成功回滚。");
      if (!confirmed) return;
    }

    setAiRollingBack(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const result = await requestJson<AiRollbackResponse>("/api/school/schedules/ai-operations/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: latestAiOperation.id })
      });
      setAiResult(null);
      await loadData("refresh");
      setAiMessage(`已回滚最近一次 AI 排课，恢复 ${result.data?.restoredSessionCount ?? 0} 个节次。`);
    } catch (error) {
      setAiError(getRequestErrorMessage(error, "回滚 AI 排课失败"));
    } finally {
      setAiRollingBack(false);
    }
  }, [latestAiOperation?.id, loadData]);

  const handleToggleLock = useCallback(async (item: ScheduleViewItem) => {
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
      setPageError(getRequestErrorMessage(error, item.locked ? "解锁节次失败" : "锁定节次失败"));
    } finally {
      setLockingId(null);
    }
  }, [editingId, loadData, resetForm]);

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
    setTemplateForm((prev) => ({
      ...DEFAULT_TEMPLATE_FORM,
      grade: prev.grade || gradeOptions[0] || "",
      subject: prev.subject || subjectOptions[0] || ""
    }));
    setTemplateError(null);
    setTemplateMessage(null);
  }, [gradeOptions, subjectOptions]);

  const resetTeacherRuleForm = useCallback(() => {
    setTeacherRuleForm((prev) => ({
      ...DEFAULT_TEACHER_RULE_FORM,
      teacherId: prev.teacherId || teacherOptions[0]?.id || ""
    }));
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
  }, [teacherOptions]);

  const startEditTeacherRule = useCallback((rule: TeacherScheduleRule) => {
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    setTeacherRuleForm({
      id: rule.id,
      teacherId: rule.teacherId,
      weeklyMaxLessons: rule.weeklyMaxLessons ? String(rule.weeklyMaxLessons) : "",
      maxConsecutiveLessons: rule.maxConsecutiveLessons ? String(rule.maxConsecutiveLessons) : "",
      minCampusGapMinutes: rule.minCampusGapMinutes ? String(rule.minCampusGapMinutes) : ""
    });
  }, []);

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

  const handleSaveTeacherRule = useCallback(async () => {
    const weeklyMaxLessons = toOptionalNumber(teacherRuleForm.weeklyMaxLessons);
    const maxConsecutiveLessons = toOptionalNumber(teacherRuleForm.maxConsecutiveLessons);
    const minCampusGapMinutes = toOptionalNumber(teacherRuleForm.minCampusGapMinutes);
    if (!teacherRuleForm.teacherId) {
      setTeacherRuleError("请选择教师。");
      return;
    }
    if (weeklyMaxLessons === undefined && maxConsecutiveLessons === undefined && minCampusGapMinutes === undefined) {
      setTeacherRuleError("请至少填写一项教师排课规则。");
      return;
    }
    setTeacherRuleSaving(true);
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    try {
      await requestJson<TeacherRuleMutationResponse>("/api/school/schedules/teacher-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: teacherRuleForm.id,
          teacherId: teacherRuleForm.teacherId,
          weeklyMaxLessons,
          maxConsecutiveLessons,
          minCampusGapMinutes
        })
      });
      await loadData("refresh");
      setTeacherRuleMessage(teacherRuleForm.id ? "教师排课规则已更新" : "教师排课规则已保存");
      setTeacherRuleForm((prev) => ({ ...DEFAULT_TEACHER_RULE_FORM, teacherId: prev.teacherId }));
    } catch (error) {
      setTeacherRuleError(getRequestErrorMessage(error, "保存教师排课规则失败"));
    } finally {
      setTeacherRuleSaving(false);
    }
  }, [loadData, teacherRuleForm]);

  const handleDeleteTeacherRule = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("确定删除这个教师排课规则吗？")) {
      return;
    }
    setTeacherRuleDeletingId(id);
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    try {
      await requestJson(`/api/school/schedules/teacher-rules/${id}`, { method: "DELETE" });
      await loadData("refresh");
      if (teacherRuleForm.id === id) {
        resetTeacherRuleForm();
      }
      setTeacherRuleMessage("教师排课规则已删除");
    } catch (error) {
      setTeacherRuleError(getRequestErrorMessage(error, "删除教师排课规则失败"));
    } finally {
      setTeacherRuleDeletingId(null);
    }
  }, [loadData, resetTeacherRuleForm, teacherRuleForm.id]);

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

  return {
    manualEditorRef,
    weekViewRef,
    classes,
    sessions,
    summary,
    loading,
    refreshing,
    saving,
    deletingId,
    authRequired,
    pageError,
    lastLoadedAt,
    classFilter,
    weekdayFilter,
    keyword,
    editingId,
    form,
    formMessage,
    formError,
    aiForm,
    aiGenerating,
    aiRollingBack,
    aiMessage,
    aiError,
    aiResult,
    latestAiOperation,
    lockingId,
    templates,
    teacherRules,
    teacherUnavailableSlots,
    teachers,
    templateForm,
    templateSaving,
    templateDeletingId,
    templateMessage,
    templateError,
    teacherRuleForm,
    teacherRuleSaving,
    teacherRuleDeletingId,
    teacherRuleMessage,
    teacherRuleError,
    teacherUnavailableForm,
    teacherUnavailableSaving,
    teacherUnavailableDeletingId,
    teacherUnavailableMessage,
    teacherUnavailableError,
    scheduleCountByClass,
    templateByKey,
    teacherOptions,
    teacherRuleByTeacherId,
    teacherRuleCoverageCount,
    crossCampusRuleCount,
    gradeOptions,
    subjectOptions,
    aiWeeklyLessonsTarget,
    aiTargetClassCount,
    aiRequestedLessonCount,
    aiTeacherGapCount,
    aiTemplateCoverageCount,
    lockedSessionCount,
    targetedAiClasses,
    aiTeacherBoundTargetCount,
    aiMissingTemplateTargetCount,
    aiTeacherRuleGapTargetCount,
    aiZeroScheduleTargetCount,
    aiPreviewBlockingReasons,
    aiPreviewWarningReasons,
    aiReadinessLabel,
    aiReadinessTone,
    lockedCountByClass,
    classWeekdayCountByClass,
    selectedManualClass,
    selectedManualClassTemplate,
    selectedManualTeacherRule,
    selectedManualClassScheduleCount,
    selectedManualClassLockedCount,
    selectedWeekViewClass,
    selectedWeekdayOption,
    trimmedKeyword,
    activeWeekViewFilterCount,
    filteredSessions,
    filteredLockedSessionCount,
    sessionsByWeekday,
    setClassFilter,
    setWeekdayFilter,
    setKeyword,
    setForm,
    setAiForm,
    setTemplateForm,
    setTeacherRuleForm,
    setTeacherUnavailableForm,
    handleSave,
    handleDelete,
    toggleAiWeekday,
    resetAiForm,
    handleAiPreview,
    handleAiApplyPreview,
    handleAiRollback,
    handleToggleLock,
    toggleTemplateWeekday,
    resetTemplateForm,
    resetTeacherRuleForm,
    startEditTeacherRule,
    startEditTemplate,
    handleSaveTemplate,
    applyDraftTemplateToAi,
    handleDeleteTemplate,
    handleSaveTeacherRule,
    handleDeleteTeacherRule,
    handleSaveTeacherUnavailable,
    handleDeleteTeacherUnavailable,
    loadData,
    clearWeekViewFilters,
    keepFocusedClassWeekView,
    focusClassInWeekView,
    buildManualScheduleDraft,
    resetForm,
    startCreateForClass,
    startEdit,
    applySelectedClassTemplateToForm,
    formatTeacherRuleSummary
  };
}
