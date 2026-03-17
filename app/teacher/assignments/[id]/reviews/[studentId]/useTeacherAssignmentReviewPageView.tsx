"use client";

import type { ComponentProps } from "react";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";
import AssignmentReviewAiCard from "./_components/AssignmentReviewAiCard";
import AssignmentReviewExecutionLoopCard from "./_components/AssignmentReviewExecutionLoopCard";
import AssignmentReviewFormCard from "./_components/AssignmentReviewFormCard";
import AssignmentReviewOverviewCard from "./_components/AssignmentReviewOverviewCard";
import AssignmentReviewSubmissionTextCard from "./_components/AssignmentReviewSubmissionTextCard";
import AssignmentReviewUploadsCard from "./_components/AssignmentReviewUploadsCard";
import AssignmentReviewWorkbenchCard from "./_components/AssignmentReviewWorkbenchCard";
import type { TeacherAssignmentReviewRouteParams } from "./types";
import { useTeacherAssignmentReviewPage } from "./useTeacherAssignmentReviewPage";

export function useTeacherAssignmentReviewPageView(params: TeacherAssignmentReviewRouteParams) {
  const page = useTeacherAssignmentReviewPage(params);
  const mathView = useMathViewSettings("teacher-assignment-review");

  const uploadCount = page.data?.uploads?.length ?? 0;
  const hasSubmissionText = Boolean(page.data?.submission?.submissionText?.trim());
  const evidenceCount = uploadCount + (hasSubmissionText ? 1 : 0);

  const subtitle = page.data
    ? `${page.data.class.name} · ${SUBJECT_LABELS[page.data.class.subject] ?? page.data.class.subject} · ${page.data.class.grade} 年级`
    : "";

  const mathViewControlsProps = {
    fontScale: mathView.fontScale,
    lineMode: mathView.lineMode,
    onDecrease: mathView.decreaseFontScale,
    onIncrease: mathView.increaseFontScale,
    onReset: mathView.resetView,
    onLineModeChange: mathView.setLineMode
  };

  const executionLoopCardProps: ComponentProps<typeof AssignmentReviewExecutionLoopCard> | null =
    page.data
      ? {
          assignment: page.data.assignment,
          student: page.data.student,
          wrongQuestionsCount: page.wrongQuestions.length,
          uploadCount,
          hasSubmissionText,
          hasAiReview: Boolean(page.aiReview),
          canAiReview: page.canAiReview,
          saveMessage: page.message,
          backHref: `/teacher/assignments/${page.id}`
        }
      : null;

  const overviewCardProps: ComponentProps<typeof AssignmentReviewOverviewCard> | null =
    page.data
      ? {
          assignment: page.data.assignment,
          submission: page.data.submission,
          wrongQuestionsCount: page.wrongQuestions.length,
          isQuiz: page.isQuiz,
          backHref: `/teacher/assignments/${page.id}`
        }
      : null;

  const workbenchCardProps: ComponentProps<typeof AssignmentReviewWorkbenchCard> = {
    wrongQuestionsCount: page.wrongQuestions.length,
    evidenceCount,
    rubricsCount: page.data?.rubrics.length ?? 0,
    isQuiz: page.isQuiz,
    isEssay: page.isEssay,
    canAiReview: page.canAiReview,
    hasAiReview: Boolean(page.aiReview),
    hasSubmissionText,
    uploadCount,
    saveMessage: page.message,
    saveError: page.saveError,
    aiError: page.aiError
  };

  const uploadsCardProps: ComponentProps<typeof AssignmentReviewUploadsCard> | null = page.data?.uploads?.length
    ? { uploads: page.data.uploads }
    : null;

  const submissionTextCardProps: ComponentProps<typeof AssignmentReviewSubmissionTextCard> | null =
    hasSubmissionText
      ? {
          text: page.data?.submission?.submissionText ?? "",
          isEssay: page.isEssay
        }
      : null;

  const aiCardProps: ComponentProps<typeof AssignmentReviewAiCard> = {
    aiLoading: page.aiLoading,
    canAiReview: page.canAiReview,
    aiReview: page.aiReview,
    error: page.aiError,
    onGenerate: () => {
      void page.handleAiReview();
    }
  };

  const formCardProps: ComponentProps<typeof AssignmentReviewFormCard> | null = page.data
    ? {
        isQuiz: page.isQuiz,
        isEssay: page.isEssay,
        wrongQuestions: page.wrongQuestions,
        overallComment: page.overallComment,
        itemState: page.itemState,
        rubricState: page.rubricState,
        rubrics: page.data.rubrics,
        saving: page.saving,
        message: page.message,
        error: page.saveError,
        onSubmit: page.handleSubmit,
        onOverallCommentChange: page.setOverallComment,
        onQuestionWrongTagChange: page.handleQuestionWrongTagChange,
        onQuestionCommentChange: page.handleQuestionCommentChange,
        onRubricScoreChange: page.handleRubricScoreChange,
        onRubricCommentChange: page.handleRubricCommentChange
      }
    : null;

  return {
    data: page.data,
    authRequired: page.authRequired,
    loading: page.loading,
    loadError: page.loadError,
    subtitle,
    wrongQuestionsCount: page.wrongQuestions.length,
    evidenceCount,
    rubricsCount: page.data?.rubrics.length ?? 0,
    hasAiReview: Boolean(page.aiReview),
    canAiReview: page.canAiReview,
    saveMessage: page.message,
    reload: () => {
      void page.load(page.data ? "refresh" : "initial");
    },
    mathViewStyle: mathView.style,
    mathViewControlsProps,
    executionLoopCardProps,
    overviewCardProps,
    workbenchCardProps,
    uploadsCardProps,
    submissionTextCardProps,
    aiCardProps,
    formCardProps
  };
}
