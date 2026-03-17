"use client";

import type { ComponentProps } from "react";
import MathViewControls from "@/components/MathViewControls";
import AssignmentFeedbackPanels from "./_components/AssignmentFeedbackPanels";
import AssignmentLessonContextCard from "./_components/AssignmentLessonContextCard";
import AssignmentOverviewCard from "./_components/AssignmentOverviewCard";
import AssignmentSubmissionCard from "./_components/AssignmentSubmissionCard";
import { formatLessonLinkSchedule } from "./utils";
import { useStudentAssignmentDetailPage } from "./useStudentAssignmentDetailPage";

export function useStudentAssignmentDetailPageView(assignmentId: string) {
  const page = useStudentAssignmentDetailPage(assignmentId);

  const mathViewProps: ComponentProps<typeof MathViewControls> = {
    fontScale: page.mathView.fontScale,
    lineMode: page.mathView.lineMode,
    onDecrease: page.mathView.decreaseFontScale,
    onIncrease: page.mathView.increaseFontScale,
    onReset: page.mathView.resetView,
    onLineModeChange: page.mathView.setLineMode
  };

  const lessonLinkCardProps: ComponentProps<typeof AssignmentLessonContextCard> | null = page.data?.lessonLink
    ? {
        lessonLink: page.data.lessonLink,
        lessonSchedule: formatLessonLinkSchedule(page.data.lessonLink)
      }
    : null;

  const overviewCardProps: ComponentProps<typeof AssignmentOverviewCard> | null = page.data
    ? {
        data: page.data,
        isUpload: page.isUpload,
        isEssay: page.isEssay
      }
    : null;

  const submissionCardProps: ComponentProps<typeof AssignmentSubmissionCard> | null = page.data
    ? {
        data: page.data,
        review: page.review,
        alreadyCompleted: page.alreadyCompleted,
        isUpload: page.isUpload,
        isEssay: page.isEssay,
        uploads: page.uploads,
        uploading: page.uploading,
        deletingUploadId: page.deletingUploadId,
        submissionText: page.submissionText,
        answers: page.answers,
        answeredCount: page.answeredCount,
        loading: page.submitting,
        error: page.actionError,
        message: page.actionMessage,
        hasUploads: page.hasUploads,
        hasText: page.hasText,
        maxUploads: page.maxUploads,
        canSubmit: page.canSubmit,
        stageTitle: page.stageCopy.title,
        stageDescription: page.stageCopy.description,
        hasFeedback: page.hasFeedbackContent,
        onUpload: page.handleUpload,
        onDeleteUpload: page.handleDeleteUpload,
        onSubmit: page.handleSubmit,
        onSubmissionTextChange: page.setSubmissionText,
        onAnswerChange: page.handleAnswerChange
      }
    : null;

  const feedbackPanelsProps: ComponentProps<typeof AssignmentFeedbackPanels> | null = page.data && page.hasFeedbackContent
    ? {
        feedbackSectionRef: page.feedbackSectionRef,
        questions: page.data.questions,
        result: page.result,
        review: page.review,
        isQuiz: page.isQuiz,
        isUpload: page.isUpload,
        isEssay: page.isEssay
      }
    : null;

  return {
    data: page.data,
    authRequired: page.authRequired,
    loadError: page.loadError,
    pageNotice: page.pageNotice,
    showLoadErrorState: Boolean(page.loadError && !page.data),
    showLoadingState: page.pageLoading && !page.data && !page.loadError && !page.authRequired,
    mathViewStyle: page.mathView.style,
    mathViewProps,
    lessonLinkCardProps,
    overviewCardProps,
    submissionCardProps,
    feedbackPanelsProps,
    statusLabel: page.statusLabel,
    dueDateLabel: page.data ? new Date(page.data.assignment.dueDate).toLocaleDateString("zh-CN") : "",
    reload: () => {
      void page.load();
    }
  };
}
