"use client";

import type { ComponentProps } from "react";
import { TeacherSeatingDraftPlanCard } from "./_components/TeacherSeatingDraftPlanCard";
import { TeacherSeatingFollowUpCard } from "./_components/TeacherSeatingFollowUpCard";
import { TeacherSeatingHeader } from "./_components/TeacherSeatingHeader";
import { TeacherSeatingPreviewCard } from "./_components/TeacherSeatingPreviewCard";
import { TeacherSeatingSemesterStatusCard } from "./_components/TeacherSeatingSemesterStatusCard";
import { TeacherSeatingStrategyCard } from "./_components/TeacherSeatingStrategyCard";
import { TeacherSeatingStudentFactorsCard } from "./_components/TeacherSeatingStudentFactorsCard";
import { useTeacherSeatingPage } from "./useTeacherSeatingPage";

export function useTeacherSeatingPageView() {
  const page = useTeacherSeatingPage();

  const headerProps: ComponentProps<typeof TeacherSeatingHeader> = {
    classLabel: page.classLabel,
    lastLoadedAt: page.lastLoadedAt
  };

  const semesterStatusCardProps: ComponentProps<typeof TeacherSeatingSemesterStatusCard> = {
    semesterStatus: page.semesterStatus,
    semesterStatusTone: page.semesterStatusTone,
    savedPlan: page.savedPlan,
    classLabel: page.classLabel,
    semesterReplanReasons: page.semesterReplanReasons
  };

  const strategyCardProps: ComponentProps<typeof TeacherSeatingStrategyCard> = {
    classes: page.classes,
    classId: page.classId,
    draftSummary: page.draftSummary,
    aiOptions: page.aiOptions,
    keepLockedSeats: page.keepLockedSeats,
    lockedSeats: page.lockedSeats,
    layoutRows: page.layoutRows,
    layoutColumns: page.layoutColumns,
    studentsCount: page.students.length,
    lastLoadedAt: page.lastLoadedAt,
    studentMap: page.studentMap,
    pageError: page.pageError,
    saveError: page.saveError,
    saveMessage: page.saveMessage,
    refreshing: page.refreshing,
    previewing: page.previewing,
    saving: page.saving,
    hasPreviewPlan: Boolean(page.previewPlan),
    hasSavedPlan: Boolean(page.savedPlan),
    setAiOptions: page.setAiOptions,
    onKeepLockedSeatsChange: page.setKeepLockedSeats,
    onRefresh: () => {
      void page.loadData("refresh", page.classId);
    },
    onGeneratePreview: () => {
      void page.handleGeneratePreview();
    },
    onApplyPreview: page.handleApplyPreview,
    onRestoreSaved: page.handleRestoreSaved,
    onSavePlan: () => {
      void page.handleSavePlan();
    },
    onClassChange: page.handleClassChange,
    onLayoutChange: page.handleLayoutChange
  };

  const previewCardProps: ComponentProps<typeof TeacherSeatingPreviewCard> = {
    previewPlan: page.previewPlan,
    previewSummary: page.previewSummary,
    previewWarnings: page.previewWarnings,
    previewInsights: page.previewInsights,
    studentMap: page.studentMap,
    lockedSeatIds: page.lockedSeatIds
  };

  const followUpCardProps: ComponentProps<typeof TeacherSeatingFollowUpCard> = {
    draftSummary: page.draftSummary,
    studentsNeedingProfileReminder: page.studentsNeedingProfileReminder,
    watchStudents: page.watchStudents,
    includeParentsInReminder: page.includeParentsInReminder,
    followUpActing: page.followUpActing,
    followUpError: page.followUpError,
    followUpMessage: page.followUpMessage,
    onIncludeParentsChange: page.setIncludeParentsInReminder,
    onRemindIncompleteProfiles: () => {
      void page.handleRemindIncompleteProfiles();
    },
    onCopyFollowUpChecklist: () => {
      void page.handleCopyFollowUpChecklist();
    }
  };

  const draftPlanCardProps: ComponentProps<typeof TeacherSeatingDraftPlanCard> | null = page.draftPlan
    ? {
        draftPlan: page.draftPlan,
        draftSummary: page.draftSummary,
        savedPlan: page.savedPlan,
        lockedSeatsCount: page.lockedSeats.length,
        frontRowCount: page.frontRowCount,
        studentMap: page.studentMap,
        lockedSeatIds: page.lockedSeatIds,
        students: page.students,
        unassignedStudents: page.unassignedStudents,
        onToggleLockedSeat: page.toggleLockedSeat,
        onSeatAssignmentChange: page.handleSeatAssignmentChange
      }
    : null;

  const studentFactorsCardProps: ComponentProps<typeof TeacherSeatingStudentFactorsCard> = {
    roster: page.roster
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    hasClasses: page.classes.length > 0,
    hasDraftPlan: Boolean(page.draftPlan),
    headerProps,
    semesterStatusCardProps,
    strategyCardProps,
    previewCardProps,
    followUpCardProps,
    draftPlanCardProps,
    studentFactorsCardProps
  };
}
