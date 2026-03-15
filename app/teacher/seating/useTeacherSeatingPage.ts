"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatLoadedTime,
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import {
  getFrontRowCount,
  getUnassignedStudentIds,
  resizeSeatGrid,
  swapSeatAssignment,
  type SeatCell
} from "@/lib/seat-plan-utils";
import type {
  AiOptions,
  AiPreviewResponse,
  FollowUpActionResponse,
  SeatPlan,
  SeatingResponse,
  TeacherClassItem,
  TeacherSeatingStudent
} from "./types";
import { DEFAULT_AI_OPTIONS, buildFollowUpChecklist, isFocusPriorityStudent, isFrontPriorityStudent, summarizePlan } from "./utils";

export function useTeacherSeatingPage() {
  const [classes, setClasses] = useState<TeacherClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<TeacherSeatingStudent[]>([]);
  const [draftPlan, setDraftPlan] = useState<SeatPlan | null>(null);
  const [savedPlan, setSavedPlan] = useState<SeatPlan | null>(null);
  const [preview, setPreview] = useState<AiPreviewResponse["data"] | null>(null);
  const [aiOptions, setAiOptions] = useState<AiOptions>(DEFAULT_AI_OPTIONS);
  const [keepLockedSeats, setKeepLockedSeats] = useState(true);
  const [lockedSeatIds, setLockedSeatIds] = useState<string[]>([]);
  const [layoutRows, setLayoutRows] = useState(4);
  const [layoutColumns, setLayoutColumns] = useState(6);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [includeParentsInReminder, setIncludeParentsInReminder] = useState(false);
  const [followUpActing, setFollowUpActing] = useState<null | "remind" | "copy">(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial", targetClassId?: string) => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);
    setSaveError(null);

    try {
      const query = targetClassId
        ? `?classId=${encodeURIComponent(targetClassId)}`
        : classId
          ? `?classId=${encodeURIComponent(classId)}`
          : "";
      const payload = await requestJson<SeatingResponse>(`/api/teacher/seating${query}`);
      const data = payload.data;
      const nextClasses = data?.classes ?? [];
      const nextClassId = data?.class?.id ?? nextClasses[0]?.id ?? "";
      const nextPlan = data?.plan ?? null;

      setClasses(nextClasses);
      setClassId(nextClassId);
      setStudents(data?.students ?? []);
      setSavedPlan(data?.savedPlan ?? null);
      setDraftPlan(nextPlan);
      setLayoutRows(nextPlan?.rows ?? data?.recommendedLayout?.rows ?? 4);
      setLayoutColumns(nextPlan?.columns ?? data?.recommendedLayout?.columns ?? 6);
      setPreview(null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setClasses([]);
        setClassId("");
        setStudents([]);
        setDraftPlan(null);
        setSavedPlan(null);
        setPreview(null);
      } else {
        setPageError(getRequestErrorMessage(nextError, "加载学期排座配置失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!draftPlan) {
      setLockedSeatIds([]);
      return;
    }

    const validSeatIds = new Set(draftPlan.seats.filter((seat) => Boolean(seat.studentId)).map((seat) => seat.seatId));
    setLockedSeatIds((prev) => prev.filter((seatId) => validSeatIds.has(seatId)));
  }, [draftPlan]);

  const lockedSeats = useMemo(() => {
    if (!draftPlan) return [] as Array<SeatCell & { studentId: string }>;
    return draftPlan.seats.filter(
      (seat): seat is SeatCell & { studentId: string } => Boolean(seat.studentId) && lockedSeatIds.includes(seat.seatId)
    );
  }, [draftPlan, lockedSeatIds]);
  const draftSummary = useMemo(() => summarizePlan(draftPlan, students, lockedSeats.length), [draftPlan, lockedSeats.length, students]);
  const previewPlan = preview?.plan ?? null;
  const previewSummary = preview?.summary ?? null;
  const previewWarnings = preview?.warnings ?? [];
  const previewInsights = preview?.insights ?? [];
  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const unassignedStudents = useMemo(() => {
    if (!draftPlan) return students;
    const unassignedIds = getUnassignedStudentIds(draftPlan.seats, students.map((student) => student.id));
    return unassignedIds.map((studentId) => studentMap.get(studentId)).filter(Boolean) as TeacherSeatingStudent[];
  }, [draftPlan, studentMap, students]);
  const roster = useMemo(
    () =>
      [...students].sort(
        (left, right) =>
          left.profileCompleteness - right.profileCompleteness ||
          Number(isFrontPriorityStudent(right) || isFocusPriorityStudent(right)) -
            Number(isFrontPriorityStudent(left) || isFocusPriorityStudent(left)) ||
          right.placementScore - left.placementScore
      ),
    [students]
  );
  const studentsNeedingProfileReminder = useMemo(
    () => roster.filter((student) => student.missingProfileFields.length > 0),
    [roster]
  );
  const watchStudents = useMemo(
    () =>
      roster.filter(
        (student) => isFrontPriorityStudent(student) || isFocusPriorityStudent(student) || student.missingProfileFields.length > 0
      ),
    [roster]
  );
  const classLabel = useMemo(() => classes.find((item) => item.id === classId)?.name ?? "当前班级", [classId, classes]);
  const followUpChecklist = useMemo(
    () =>
      buildFollowUpChecklist({
        classLabel,
        studentsNeedingProfileReminder,
        watchStudents,
        summary: draftSummary,
        lockedSeatCount: lockedSeats.length
      }),
    [classLabel, draftSummary, lockedSeats.length, studentsNeedingProfileReminder, watchStudents]
  );
  const frontPriorityGap = Math.max(
    0,
    (draftSummary?.frontPriorityStudentCount ?? 0) - (draftSummary?.frontPrioritySatisfiedCount ?? 0)
  );
  const focusPriorityGap = Math.max(
    0,
    (draftSummary?.focusPriorityStudentCount ?? 0) - (draftSummary?.focusPrioritySatisfiedCount ?? 0)
  );
  const semesterReplanReasons = useMemo(() => {
    const reasons: string[] = [];

    if (!savedPlan) {
      reasons.push("本学期还没有保存正式座位方案");
    }
    if ((draftSummary?.unassignedCount ?? 0) > 0) {
      reasons.push(`仍有 ${draftSummary?.unassignedCount ?? 0} 名学生未分配座位`);
    }
    if (frontPriorityGap > 0) {
      reasons.push(`${frontPriorityGap} 名前排需求学生仍需优先照顾`);
    }
    if (focusPriorityGap > 0) {
      reasons.push(`${focusPriorityGap} 名低干扰需求学生仍需优化`);
    }
    if (studentsNeedingProfileReminder.length > 0) {
      reasons.push(`${studentsNeedingProfileReminder.length} 名学生关键画像待补`);
    }
    if (previewPlan) {
      reasons.push("当前有一份未应用的学期预览");
    }

    return reasons;
  }, [draftSummary, focusPriorityGap, frontPriorityGap, previewPlan, savedPlan, studentsNeedingProfileReminder]);
  const semesterStatus = !savedPlan ? "待初始化" : semesterReplanReasons.length ? "建议重排" : "本学期稳定";
  const semesterStatusTone =
    semesterStatus === "本学期稳定" ? "#027a48" : semesterStatus === "建议重排" ? "#b54708" : "#4f46e5";
  const frontRowCount = draftPlan ? getFrontRowCount(draftPlan.rows) : 1;

  function toggleLockedSeat(seatId: string) {
    setLockedSeatIds((prev) => (prev.includes(seatId) ? prev.filter((item) => item !== seatId) : [...prev, seatId]));
    setSaveMessage(null);
  }

  function handleLayoutChange(type: "rows" | "columns", value: number) {
    if (!draftPlan) return;
    const nextRows = type === "rows" ? value : layoutRows;
    const nextColumns = type === "columns" ? value : layoutColumns;
    setLayoutRows(nextRows);
    setLayoutColumns(nextColumns);
    setDraftPlan((prev) =>
      prev
        ? {
            ...prev,
            rows: nextRows,
            columns: nextColumns,
            seats: resizeSeatGrid(prev.seats, nextRows, nextColumns),
            updatedAt: new Date().toISOString()
          }
        : prev
    );
    setPreview(null);
    setSaveMessage(null);
  }

  async function handleGeneratePreview() {
    if (!classId) return;
    setPreviewing(true);
    setPageError(null);

    try {
      const payload = await requestJson<AiPreviewResponse>("/api/teacher/seating/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          rows: layoutRows,
          columns: layoutColumns,
          lockedSeats: keepLockedSeats
            ? lockedSeats.map((seat) => ({ seatId: seat.seatId, row: seat.row, column: seat.column, studentId: seat.studentId }))
            : undefined,
          ...aiOptions
        })
      });
      setPreview(payload.data ?? null);
      setSaveMessage(
        keepLockedSeats && lockedSeats.length
          ? `学期预览已生成，已保留 ${lockedSeats.length} 个锁定座位。`
          : "学期预览已生成，可先应用再做少量调整。"
      );
    } catch (nextError) {
      setPageError(getRequestErrorMessage(nextError, "生成学期预览失败"));
    } finally {
      setPreviewing(false);
    }
  }

  function handleApplyPreview() {
    if (!previewPlan) return;
    setDraftPlan({ ...previewPlan, updatedAt: new Date().toISOString() });
    setLayoutRows(previewPlan.rows);
    setLayoutColumns(previewPlan.columns);
    setSaveMessage("已应用学期预览，请确认关键座位后保存本学期方案。");
    setSaveError(null);
  }

  function handleRestoreSaved() {
    if (!savedPlan) return;
    setDraftPlan(savedPlan);
    setLayoutRows(savedPlan.rows);
    setLayoutColumns(savedPlan.columns);
    setPreview(null);
    setSaveMessage("已恢复到本学期最近保存版本。");
    setSaveError(null);
  }

  async function handleSavePlan() {
    if (!draftPlan || !classId) return;
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const payload = await requestJson<AiPreviewResponse>("/api/teacher/seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          rows: draftPlan.rows,
          columns: draftPlan.columns,
          generatedBy: draftPlan.generatedBy,
          seats: draftPlan.seats.map((seat) => ({
            seatId: seat.seatId,
            row: seat.row,
            column: seat.column,
            studentId: seat.studentId ?? null
          }))
        })
      });
      if (payload.data?.plan) {
        setDraftPlan(payload.data.plan);
        setSavedPlan(payload.data.plan);
      }
      if (payload.data?.students) {
        setStudents(payload.data.students);
      }
      setSaveMessage("本学期座位方案已保存，后续可按需做少量微调。");
    } catch (nextError) {
      setSaveError(getRequestErrorMessage(nextError, "保存学期排座失败"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemindIncompleteProfiles() {
    if (!classId || !studentsNeedingProfileReminder.length) return;
    setFollowUpActing("remind");
    setFollowUpMessage(null);
    setFollowUpError(null);

    try {
      const payload = await requestJson<{ data?: FollowUpActionResponse }>("/api/teacher/seating/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          action: "remind_incomplete_profiles",
          includeParents: includeParentsInReminder,
          limit: Math.min(studentsNeedingProfileReminder.length, 30)
        })
      });
      const result = payload.data;
      setFollowUpMessage(
        `已发送资料补充提醒：学生 ${result?.students ?? 0} 人${includeParentsInReminder ? `，家长 ${result?.parents ?? 0} 人` : ""}。`
      );
    } catch (nextError) {
      setFollowUpError(getRequestErrorMessage(nextError, "发送资料补充提醒失败"));
    } finally {
      setFollowUpActing(null);
    }
  }

  async function handleCopyFollowUpChecklist() {
    setFollowUpActing("copy");
    setFollowUpMessage(null);
    setFollowUpError(null);

    try {
      await navigator.clipboard.writeText(followUpChecklist);
      setFollowUpMessage("已复制本学期排座观察清单。");
    } catch {
      setFollowUpError("复制失败，请稍后重试。");
    } finally {
      setFollowUpActing(null);
    }
  }

  function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    void loadData("refresh", nextClassId);
  }

  function handleSeatAssignmentChange(seatId: string, nextStudentId?: string) {
    setDraftPlan((prev) =>
      prev
        ? {
            ...prev,
            seats: swapSeatAssignment(prev.seats, seatId, nextStudentId),
            generatedBy: "manual",
            updatedAt: new Date().toISOString()
          }
        : prev
    );
    if (!nextStudentId) {
      setLockedSeatIds((prev) => prev.filter((item) => item !== seatId));
    }
    setSaveMessage(null);
  }

  return {
    classes,
    classId,
    students,
    draftPlan,
    savedPlan,
    preview,
    aiOptions,
    keepLockedSeats,
    lockedSeatIds,
    layoutRows,
    layoutColumns,
    loading,
    refreshing,
    previewing,
    saving,
    authRequired,
    pageError,
    saveMessage,
    saveError,
    followUpMessage,
    followUpError,
    includeParentsInReminder,
    followUpActing,
    lastLoadedAt,
    lockedSeats,
    draftSummary,
    previewPlan,
    previewSummary,
    previewWarnings,
    previewInsights,
    studentMap,
    unassignedStudents,
    roster,
    studentsNeedingProfileReminder,
    watchStudents,
    classLabel,
    followUpChecklist,
    semesterReplanReasons,
    semesterStatus,
    semesterStatusTone,
    frontRowCount,
    formatLoadedTime,
    setAiOptions,
    setKeepLockedSeats,
    setIncludeParentsInReminder,
    toggleLockedSeat,
    handleLayoutChange,
    handleGeneratePreview,
    handleApplyPreview,
    handleRestoreSaved,
    handleSavePlan,
    handleRemindIncompleteProfiles,
    handleCopyFollowUpChecklist,
    handleClassChange,
    handleSeatAssignmentChange,
    loadData
  };
}
