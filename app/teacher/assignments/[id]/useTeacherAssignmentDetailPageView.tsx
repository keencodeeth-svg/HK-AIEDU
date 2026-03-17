"use client";

import type { ComponentProps } from "react";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import AssignmentExecutionLoopCard from "./_components/AssignmentExecutionLoopCard";
import AssignmentNotifyCard from "./_components/AssignmentNotifyCard";
import AssignmentOverviewPanels from "./_components/AssignmentOverviewPanels";
import AssignmentRubricEditorCard from "./_components/AssignmentRubricEditorCard";
import AssignmentStudentRosterCard from "./_components/AssignmentStudentRosterCard";
import { getDueRelativeLabel } from "./utils";
import { useTeacherAssignmentDetailPage } from "./useTeacherAssignmentDetailPage";

export function useTeacherAssignmentDetailPageView(id: string) {
  const page = useTeacherAssignmentDetailPage(id);

  const dueRelativeLabel = page.data
    ? getDueRelativeLabel(page.data.assignment.dueDate, page.now)
    : "";
  const lessonContext = page.data?.lessonLink
    ? [
        page.data.lessonLink.lessonDate,
        page.data.lessonLink.startTime && page.data.lessonLink.endTime
          ? `${page.data.lessonLink.startTime}-${page.data.lessonLink.endTime}`
          : null,
        page.data.lessonLink.slotLabel ?? null,
        page.data.lessonLink.room ?? null
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const rubricLevelCount = page.rubrics.reduce(
    (sum, item) => sum + item.levels.length,
    0
  );

  const executionLoopCardProps: ComponentProps<typeof AssignmentExecutionLoopCard> | null =
    page.data
      ? {
          assignmentId: page.data.assignment.id,
          assignmentTitle: page.data.assignment.title,
          dueDate: page.data.assignment.dueDate,
          submissionType: page.data.assignment.submissionType ?? "quiz",
          students: page.data.students,
          now: page.now
        }
      : null;

  const overviewPanelsProps: ComponentProps<typeof AssignmentOverviewPanels> | null =
    page.data
      ? {
          data: page.data,
          lessonContext,
          completedStudentsCount: page.completedStudents.length,
          reviewReadyStudentsCount: page.reviewReadyStudents.length,
          lowScoreStudentsCount: page.lowScoreStudents.length,
          completionRate: page.completionRate,
          pendingStudentsCount: page.pendingStudents.length,
          averagePercent: page.averagePercent,
          scoredStudentsCount: page.scoredStudents.length,
          rubricsCount: page.rubrics.length,
          rubricLevelCount
        }
      : null;

  const studentRosterCardProps: ComponentProps<typeof AssignmentStudentRosterCard> | null =
    page.data
      ? {
          assignmentId: page.data.assignment.id,
          assignmentOverdue: page.assignmentOverdue,
          studentFilter: page.studentFilter,
          studentKeyword: page.studentKeyword,
          hasStudentFilters: page.hasStudentFilters,
          filteredStudents: page.filteredStudents,
          latestCompletedStudentName: page.latestCompletedStudent?.name ?? null,
          onStudentFilterChange: page.setStudentFilter,
          onStudentKeywordChange: page.setStudentKeyword,
          onClearStudentFilters: page.clearStudentFilters
        }
      : null;

  const notifyCardProps: ComponentProps<typeof AssignmentNotifyCard> = {
    pendingStudentsCount: page.pendingStudents.length,
    lowScoreStudentsCount: page.lowScoreStudents.length,
    notifyPreviewStudentsCount: page.notifyPreviewStudents.length,
    notifyTarget: page.notifyTarget,
    threshold: page.threshold,
    notifyMessage: page.notifyMessage,
    notifySuccess: page.notifySuccess,
    notifyError: page.notifyError,
    notifyLoading: page.notifyLoading,
    onNotifyTargetChange: page.setNotifyTarget,
    onThresholdChange: page.setThreshold,
    onNotifyMessageChange: page.setNotifyMessage,
    onSend: () => {
      void page.handleNotify();
    }
  };

  const rubricEditorCardProps: ComponentProps<typeof AssignmentRubricEditorCard> = {
    rubrics: page.rubrics,
    rubricLevelCount,
    rubricsLoading: page.rubricsLoading,
    rubricsReady: page.rubricsReady,
    rubricLoadError: page.rubricLoadError,
    rubricError: page.rubricError,
    rubricMessage: page.rubricMessage,
    rubricSaving: page.rubricSaving,
    onUpdateRubric: page.updateRubric,
    onUpdateLevel: page.updateLevel,
    onAddRubric: page.addRubric,
    onRemoveRubric: page.removeRubric,
    onAddLevel: page.addLevel,
    onRemoveLevel: page.removeLevel,
    onSave: () => {
      void page.handleSaveRubrics();
    },
    onRetryLoad: () => {
      void page.retryRubrics();
    }
  };

  const subtitle = page.data
    ? `${page.data.class.name} · ${SUBJECT_LABELS[page.data.class.subject] ?? page.data.class.subject} · ${page.data.class.grade} 年级`
    : "";
  const submissionTypeLabel = page.data
    ? ASSIGNMENT_TYPE_LABELS[page.data.assignment.submissionType ?? "quiz"]
    : "";

  return {
    data: page.data,
    authRequired: page.authRequired,
    loading: page.loading,
    loadError: page.loadError,
    subtitle,
    submissionTypeLabel,
    dueRelativeLabel,
    completedStudentsCount: page.completedStudents.length,
    totalStudentsCount: page.data?.students.length ?? 0,
    reviewReadyStudentsCount: page.reviewReadyStudents.length,
    lowScoreStudentsCount: page.lowScoreStudents.length,
    hasLessonLink: Boolean(page.data?.lessonLink),
    executionLoopCardProps,
    overviewPanelsProps,
    studentRosterCardProps,
    notifyCardProps,
    rubricEditorCardProps,
    reload: () => {
      void page.load(page.data ? "refresh" : "initial");
    }
  };
}
