"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import type { SchoolClassRecord, SchoolUserRecord } from "@/lib/school-admin-types";
import type { SchoolScheduleTemplate } from "@/lib/school-schedule-templates";
import type { TeacherScheduleRule } from "@/lib/teacher-schedule-rules";
import type { TeacherUnavailableSlot } from "@/lib/teacher-unavailability";
import { isSchoolAdminAuthRequiredError } from "../utils";
import type {
  AiMode,
  AiOperationSummary,
  AiScheduleResponse,
  AiScheduleFormState,
  LatestAiOperationResponse,
  ScheduleFormState,
  ScheduleTemplateResponse,
  ScheduleViewItem,
  SchoolSchedulesData,
  SchoolSchedulesResponse,
  SchoolUsersResponse,
  TeacherRuleFormState,
  TeacherRuleListResponse,
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
  formatTeacherRuleSummary,
  getSchoolSchedulesRequestMessage
} from "./utils";
import { useSchoolSchedulesAiActions } from "./useSchoolSchedulesAiActions";
import { useSchoolSchedulesConstraintActions } from "./useSchoolSchedulesConstraintActions";
import { useSchoolSchedulesManualActions } from "./useSchoolSchedulesManualActions";

export function useSchoolSchedulesPage() {
  const loadRequestIdRef = useRef(0);
  const manualEditorRef = useRef<HTMLDivElement | null>(null);
  const weekViewRef = useRef<HTMLDivElement | null>(null);
  const noStoreRequestInit = useMemo(() => ({ cache: "no-store" as const }), []);
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

  const clearSchoolSchedulesState = useCallback(() => {
    setClasses([]);
    setSessions([]);
    setSummary(null);
    setLastLoadedAt(null);
    setClassFilter("all");
    setWeekdayFilter("all");
    setKeyword("");
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setFormMessage(null);
    setAiForm({ ...DEFAULT_AI_FORM, weekdays: [...DEFAULT_AI_FORM.weekdays] });
    setAiError(null);
    setAiMessage(null);
    setAiResult(null);
    setLatestAiOperation(null);
    setDeletingId(null);
    setLockingId(null);
    setTemplates([]);
    setTeacherRules([]);
    setTeacherUnavailableSlots([]);
    setTeachers([]);
    setTemplateForm({ ...DEFAULT_TEMPLATE_FORM, weekdays: [...DEFAULT_TEMPLATE_FORM.weekdays] });
    setTemplateSaving(false);
    setTemplateDeletingId(null);
    setTemplateError(null);
    setTemplateMessage(null);
    setTeacherRuleForm({ ...DEFAULT_TEACHER_RULE_FORM });
    setTeacherRuleSaving(false);
    setTeacherRuleDeletingId(null);
    setTeacherRuleError(null);
    setTeacherRuleMessage(null);
    setTeacherUnavailableForm({ ...DEFAULT_TEACHER_UNAVAILABLE_FORM });
    setTeacherUnavailableSaving(false);
    setTeacherUnavailableDeletingId(null);
    setTeacherUnavailableError(null);
    setTeacherUnavailableMessage(null);
    setPageError(null);
  }, []);

  const handleAuthRequired = useCallback(() => {
    clearSchoolSchedulesState();
    setAuthRequired(true);
  }, [clearSchoolSchedulesState]);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [payload, templatesPayload, teacherRulesPayload, teacherUnavailablePayload, teachersPayload, latestAiOperationPayload] =
        await Promise.all([
          requestJson<SchoolSchedulesResponse>("/api/school/schedules", noStoreRequestInit),
          requestJson<ScheduleTemplateResponse>("/api/school/schedules/templates", noStoreRequestInit),
          requestJson<TeacherRuleListResponse>("/api/school/schedules/teacher-rules", noStoreRequestInit),
          requestJson<TeacherUnavailableResponse>("/api/school/schedules/teacher-unavailability", noStoreRequestInit),
          requestJson<SchoolUsersResponse>("/api/school/users?role=teacher", noStoreRequestInit),
          requestJson<LatestAiOperationResponse>("/api/school/schedules/ai-operations/latest", noStoreRequestInit)
        ]);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      const nextClasses = payload.data?.classes ?? [];

      setClasses(payload.data?.classes ?? []);
      setSessions(payload.data?.sessions ?? []);
      setSummary(payload.data?.summary ?? null);
      setTemplates(templatesPayload.data ?? []);
      setTeacherRules(teacherRulesPayload.data ?? []);
      setTeacherUnavailableSlots(teacherUnavailablePayload.data ?? []);
      setTeachers(teachersPayload.data ?? []);
      setLatestAiOperation(latestAiOperationPayload.data ?? null);
      setAuthRequired(false);
      setClassFilter((prev) => (prev === "all" || nextClasses.some((item) => item.id === prev) ? prev : "all"));
      setLastLoadedAt(new Date().toISOString());
      if (nextClasses[0]?.id) {
        const firstClass = nextClasses[0];
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
      } else {
        setForm({ ...EMPTY_FORM });
        setTemplateForm({ ...DEFAULT_TEMPLATE_FORM, weekdays: [...DEFAULT_TEMPLATE_FORM.weekdays] });
        setTeacherRuleForm({ ...DEFAULT_TEACHER_RULE_FORM });
        setTeacherUnavailableForm({ ...DEFAULT_TEACHER_UNAVAILABLE_FORM });
      }
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      if (isSchoolAdminAuthRequiredError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setPageError(getSchoolSchedulesRequestMessage(error, "加载课程表管理失败"));
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [handleAuthRequired, noStoreRequestInit]);

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

  const {
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
  } = useSchoolSchedulesManualActions({
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
  });

  const { toggleAiWeekday, resetAiForm, handleAiPreview, handleAiApplyPreview, handleAiRollback } =
    useSchoolSchedulesAiActions({
      aiForm,
      aiResult,
      latestAiOperation,
      loadData,
      handleAuthRequired,
      setAiForm,
      setAiGenerating,
      setAiRollingBack,
      setAiMessage,
      setAiError,
      setAiResult,
      setLatestAiOperation
    });

  const {
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
    handleDeleteTeacherUnavailable
  } = useSchoolSchedulesConstraintActions({
    gradeOptions,
    subjectOptions,
    teacherOptions,
    templateForm,
    teacherRuleForm,
    teacherUnavailableForm,
    loadData,
    handleAuthRequired,
    setAiForm,
    setTemplateForm,
    setTemplateSaving,
    setTemplateDeletingId,
    setTemplateMessage,
    setTemplateError,
    setTeacherRuleForm,
    setTeacherRuleSaving,
    setTeacherRuleDeletingId,
    setTeacherRuleMessage,
    setTeacherRuleError,
    setTeacherUnavailableForm,
    setTeacherUnavailableSaving,
    setTeacherUnavailableDeletingId,
    setTeacherUnavailableMessage,
    setTeacherUnavailableError
  });

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
