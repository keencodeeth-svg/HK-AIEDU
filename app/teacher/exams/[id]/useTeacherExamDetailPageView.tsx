"use client";

import type { ComponentProps } from "react";
import { SUBJECT_LABELS } from "@/lib/constants";
import MathViewControls from "@/components/MathViewControls";
import ExamExecutionLoopCard from "./_components/ExamExecutionLoopCard";
import ExamOverviewCard from "./_components/ExamOverviewCard";
import ExamQuestionsCard from "./_components/ExamQuestionsCard";
import ExamStudentsCard from "./_components/ExamStudentsCard";
import ExamDetailOpsCard from "./_components/ExamDetailOpsCard";
import { useTeacherExamDetailPage } from "./useTeacherExamDetailPage";

export function useTeacherExamDetailPageView(id: string) {
  const page = useTeacherExamDetailPage(id);

  const mathViewControlsProps: ComponentProps<typeof MathViewControls> = {
    fontScale: page.mathView.fontScale,
    lineMode: page.mathView.lineMode,
    onDecrease: page.mathView.decreaseFontScale,
    onIncrease: page.mathView.increaseFontScale,
    onReset: page.mathView.resetView,
    onLineModeChange: page.mathView.setLineMode
  };

  const executionLoopCardProps: ComponentProps<typeof ExamExecutionLoopCard> | null = page.data
    ? {
        data: page.data,
        now: page.now
      }
    : null;

  const overviewCardProps: ComponentProps<typeof ExamOverviewCard> | null = page.data
    ? {
        data: page.data,
        updatingStatus: page.updatingStatus,
        publishingReviewPack: page.publishingReviewPack,
        statusError: page.statusError,
        publishMessage: page.publishMessage,
        publishError: page.publishError,
        onStatusAction: (action) => {
          void page.handleStatusAction(action);
        },
        onPublishReviewPack: (dryRun) => {
          void page.handlePublishReviewPack(dryRun);
        }
      }
    : null;

  const opsCardProps: ComponentProps<typeof ExamDetailOpsCard> | null = page.data
    ? {
        submittedRate: page.submittedRate,
        submittedCount: page.data.summary.submitted,
        assignedCount: page.data.summary.assigned,
        highRiskCount: page.data.summary.highRiskCount,
        mediumRiskCount: page.data.summary.mediumRiskCount,
        totalVisibilityHiddenCount: page.data.summary.totalVisibilityHiddenCount,
        totalBlurCount: page.data.summary.totalBlurCount,
        questionCount: page.data.questions.length,
        totalQuestionScore: page.totalQuestionScore,
        pendingCount: page.data.summary.pending,
        antiCheatLabel: page.data.exam.antiCheatLevel === "basic" ? "基础监测" : "关闭",
        publishModeLabel: page.data.exam.publishMode === "teacher_assigned" ? "班级统一" : "定向",
        durationLabel: page.data.exam.durationMinutes ? `${page.data.exam.durationMinutes} 分钟` : "不限",
        topRiskStudent: page.topRiskStudent,
        loadError: page.loadError,
        onRefresh: () => {
          void page.load("refresh");
        }
      }
    : null;

  const studentsCardProps: ComponentProps<typeof ExamStudentsCard> = {
    students: page.rankedStudents
  };

  const questionsCardProps: ComponentProps<typeof ExamQuestionsCard> = {
    questions: page.data?.questions ?? []
  };

  const subtitle = page.data
    ? `${page.data.class.name} · ${SUBJECT_LABELS[page.data.class.subject] ?? page.data.class.subject} · ${page.data.class.grade} 年级`
    : "";

  return {
    data: page.data,
    authRequired: page.authRequired,
    loading: page.loading,
    loadError: page.loadError,
    refreshing: page.refreshing,
    lastLoadedAtLabel: page.lastLoadedAtLabel,
    dueRelativeLabel: page.dueRelativeLabel,
    mathViewStyle: page.mathView.style,
    mathViewControlsProps,
    subtitle,
    refreshDisabled: page.loading || page.refreshing,
    refresh: () => {
      void page.load("refresh");
    },
    reload: () => {
      void page.load();
    },
    executionLoopCardProps,
    overviewCardProps,
    opsCardProps,
    studentsCardProps,
    questionsCardProps
  };
}
