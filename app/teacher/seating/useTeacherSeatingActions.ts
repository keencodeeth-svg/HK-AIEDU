"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type { SeatCell } from "@/lib/seat-plan-utils";
import type {
  AiOptions,
  AiPreviewResponse,
  FollowUpActionResponse,
  SeatPlan,
  TeacherSeatingStudent
} from "./types";
import {
  getTeacherSeatingRequestMessage,
  isMissingTeacherSeatingClassError
} from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type RecoverFromMissingClass = (missingClassId: string) => Promise<void>;

type TeacherSeatingActionsOptions = {
  classId: string;
  draftPlan: SeatPlan | null;
  previewPlan: SeatPlan | null;
  savedPlan: SeatPlan | null;
  aiOptions: AiOptions;
  layoutRows: number;
  layoutColumns: number;
  keepLockedSeats: boolean;
  lockedSeats: Array<SeatCell & { studentId: string }>;
  includeParentsInReminder: boolean;
  studentsNeedingProfileReminder: TeacherSeatingStudent[];
  followUpChecklist: string;
  handleAuthRequired: () => void;
  recoverFromMissingClass: RecoverFromMissingClass;
  setPreviewing: Setter<boolean>;
  setSaving: Setter<boolean>;
  setPageError: Setter<string | null>;
  setPreview: Setter<AiPreviewResponse["data"] | null>;
  setSaveMessage: Setter<string | null>;
  setSaveError: Setter<string | null>;
  setDraftPlan: Setter<SeatPlan | null>;
  setSavedPlan: Setter<SeatPlan | null>;
  setStudents: Setter<TeacherSeatingStudent[]>;
  setLayoutRows: Setter<number>;
  setLayoutColumns: Setter<number>;
  setFollowUpActing: Setter<null | "remind" | "copy">;
  setFollowUpMessage: Setter<string | null>;
  setFollowUpError: Setter<string | null>;
};

export function useTeacherSeatingActions({
  classId,
  draftPlan,
  previewPlan,
  savedPlan,
  aiOptions,
  layoutRows,
  layoutColumns,
  keepLockedSeats,
  lockedSeats,
  includeParentsInReminder,
  studentsNeedingProfileReminder,
  followUpChecklist,
  handleAuthRequired,
  recoverFromMissingClass,
  setPreviewing,
  setSaving,
  setPageError,
  setPreview,
  setSaveMessage,
  setSaveError,
  setDraftPlan,
  setSavedPlan,
  setStudents,
  setLayoutRows,
  setLayoutColumns,
  setFollowUpActing,
  setFollowUpMessage,
  setFollowUpError
}: TeacherSeatingActionsOptions) {
  const handleGeneratePreview = useCallback(async () => {
    if (!classId) {
      return;
    }

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
            ? lockedSeats.map((seat) => ({
                seatId: seat.seatId,
                row: seat.row,
                column: seat.column,
                studentId: seat.studentId
              }))
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
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      const errorMessage = getTeacherSeatingRequestMessage(error, "生成学期预览失败");
      if (isMissingTeacherSeatingClassError(error)) {
        await recoverFromMissingClass(classId);
      }
      setPageError(errorMessage);
    } finally {
      setPreviewing(false);
    }
  }, [
    aiOptions,
    classId,
    handleAuthRequired,
    keepLockedSeats,
    layoutColumns,
    layoutRows,
    lockedSeats,
    recoverFromMissingClass,
    setPageError,
    setPreview,
    setPreviewing,
    setSaveMessage
  ]);

  const handleApplyPreview = useCallback(() => {
    if (!previewPlan) {
      return;
    }

    setDraftPlan({ ...previewPlan, updatedAt: new Date().toISOString() });
    setLayoutRows(previewPlan.rows);
    setLayoutColumns(previewPlan.columns);
    setSaveMessage("已应用学期预览，请确认关键座位后保存本学期方案。");
    setSaveError(null);
  }, [
    previewPlan,
    setDraftPlan,
    setLayoutColumns,
    setLayoutRows,
    setSaveError,
    setSaveMessage
  ]);

  const handleRestoreSaved = useCallback(() => {
    if (!savedPlan) {
      return;
    }

    setDraftPlan(savedPlan);
    setLayoutRows(savedPlan.rows);
    setLayoutColumns(savedPlan.columns);
    setPreview(null);
    setSaveMessage("已恢复到本学期最近保存版本。");
    setSaveError(null);
  }, [
    savedPlan,
    setDraftPlan,
    setLayoutColumns,
    setLayoutRows,
    setPreview,
    setSaveError,
    setSaveMessage
  ]);

  const handleSavePlan = useCallback(async () => {
    if (!draftPlan || !classId) {
      return;
    }

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
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      const errorMessage = getTeacherSeatingRequestMessage(error, "保存学期排座失败");
      if (isMissingTeacherSeatingClassError(error)) {
        await recoverFromMissingClass(classId);
      }
      setSaveError(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [
    classId,
    draftPlan,
    handleAuthRequired,
    recoverFromMissingClass,
    setDraftPlan,
    setSaveError,
    setSaveMessage,
    setSavedPlan,
    setSaving,
    setStudents
  ]);

  const handleRemindIncompleteProfiles = useCallback(async () => {
    if (!classId || !studentsNeedingProfileReminder.length) {
      return;
    }

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
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      const errorMessage = getTeacherSeatingRequestMessage(error, "发送资料补充提醒失败");
      if (isMissingTeacherSeatingClassError(error)) {
        await recoverFromMissingClass(classId);
      }
      setFollowUpError(errorMessage);
    } finally {
      setFollowUpActing(null);
    }
  }, [
    classId,
    handleAuthRequired,
    includeParentsInReminder,
    recoverFromMissingClass,
    setFollowUpActing,
    setFollowUpError,
    setFollowUpMessage,
    studentsNeedingProfileReminder
  ]);

  const handleCopyFollowUpChecklist = useCallback(async () => {
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
  }, [
    followUpChecklist,
    setFollowUpActing,
    setFollowUpError,
    setFollowUpMessage
  ]);

  return {
    handleGeneratePreview,
    handleApplyPreview,
    handleRestoreSaved,
    handleSavePlan,
    handleRemindIncompleteProfiles,
    handleCopyFollowUpChecklist
  };
}
