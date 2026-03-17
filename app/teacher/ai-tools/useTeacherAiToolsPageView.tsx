"use client";

import type { ComponentProps } from "react";
import { formatLoadedTime } from "@/lib/client-request";
import TeacherAiGuideCard from "./_components/TeacherAiGuideCard";
import TeacherOutlineGeneratorPanel from "./_components/TeacherOutlineGeneratorPanel";
import TeacherPaperGeneratorPanel from "./_components/TeacherPaperGeneratorPanel";
import TeacherQuestionCheckPanel from "./_components/TeacherQuestionCheckPanel";
import TeacherReviewPackPanel from "./_components/TeacherReviewPackPanel";
import TeacherWrongReviewPanel from "./_components/TeacherWrongReviewPanel";
import { useTeacherAiToolsPage } from "./useTeacherAiToolsPage";

export function useTeacherAiToolsPageView() {
  const page = useTeacherAiToolsPage();

  const guideCardProps: ComponentProps<typeof TeacherAiGuideCard> = {
    showGuideCard: page.showGuideCard,
    onHideGuideCard: page.hideGuideCard,
    onShowGuideAgain: page.showGuideAgain
  };

  const paperGeneratorPanelProps: ComponentProps<typeof TeacherPaperGeneratorPanel> = {
    classes: page.classes,
    paperForm: page.paperForm,
    setPaperForm: page.setPaperForm,
    paperPoints: page.paperPoints,
    loading: page.loading,
    paperAutoFixing: page.paperAutoFixing,
    paperAutoFixHint: page.paperAutoFixHint,
    paperResult: page.paperResult,
    paperError: page.paperError,
    paperErrorSuggestions: page.paperErrorSuggestions,
    onGeneratePaper: page.handleGeneratePaper,
    onApplyPaperQuickFix: page.applyPaperQuickFix
  };

  const outlineGeneratorPanelProps: ComponentProps<typeof TeacherOutlineGeneratorPanel> = {
    classes: page.classes,
    outlineForm: page.outlineForm,
    setOutlineForm: page.setOutlineForm,
    outlinePoints: page.outlinePoints,
    loading: page.loading,
    outlineError: page.outlineError,
    outlineResult: page.outlineResult,
    onGenerateOutline: page.handleGenerateOutline
  };

  const wrongReviewPanelProps: ComponentProps<typeof TeacherWrongReviewPanel> = {
    classes: page.classes,
    wrongForm: page.wrongForm,
    setWrongForm: page.setWrongForm,
    loading: page.loading,
    wrongError: page.wrongError,
    wrongResult: page.wrongResult,
    onWrongReview: page.handleWrongReview
  };

  const reviewPackPanelProps: ComponentProps<typeof TeacherReviewPackPanel> = {
    classes: page.classes,
    wrongForm: page.wrongForm,
    setWrongForm: page.setWrongForm,
    loading: page.loading,
    reviewPackError: page.reviewPackError,
    reviewPackResult: page.reviewPackResult,
    reviewPackDispatchIncludeIsolated: page.reviewPackDispatchIncludeIsolated,
    setReviewPackDispatchIncludeIsolated: page.setReviewPackDispatchIncludeIsolated,
    reviewPackAssigningAll: page.reviewPackAssigningAll,
    reviewPackRetryingFailed: page.reviewPackRetryingFailed,
    reviewPackAssigningId: page.reviewPackAssigningId,
    reviewPackAssignMessage: page.reviewPackAssignMessage,
    reviewPackAssignError: page.reviewPackAssignError,
    reviewPackFailedItems: page.reviewPackFailedItems,
    reviewPackRelaxedItems: page.reviewPackRelaxedItems,
    reviewPackDispatchQuality: page.reviewPackDispatchQuality,
    onReviewPack: page.handleReviewPack,
    onAssignAllReviewSheets: page.handleAssignAllReviewSheets,
    onRetryFailedReviewSheets: page.handleRetryFailedReviewSheets,
    onAssignReviewSheet: page.handleAssignReviewSheet
  };

  const questionCheckPanelProps: ComponentProps<typeof TeacherQuestionCheckPanel> = {
    checkForm: page.checkForm,
    setCheckForm: page.setCheckForm,
    checkPreviewOptions: page.checkPreviewOptions,
    hasCheckPreview: page.hasCheckPreview,
    checkError: page.checkError,
    checkResult: page.checkResult,
    loading: page.loading,
    onCheckQuestion: page.handleCheckQuestion
  };

  return {
    authRequired: page.authRequired,
    pageError: page.pageError,
    pageLoading: page.pageLoading && !page.pageReady && !page.authRequired,
    refreshing: page.pageLoading,
    bootstrapNotice: page.bootstrapNotice,
    knowledgePointsNotice: page.knowledgePointsNotice,
    reload: page.reload,
    loading: page.loading,
    lastLoadedAtLabel: page.lastLoadedAt ? formatLoadedTime(page.lastLoadedAt) : null,
    guideCardProps,
    paperGeneratorPanelProps,
    outlineGeneratorPanelProps,
    wrongReviewPanelProps,
    reviewPackPanelProps,
    questionCheckPanelProps
  };
}
