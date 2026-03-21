"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { MAX_IMAGE_COUNT } from "./config";
import { buildTutorStageState } from "./tutorStageState";
import { useTutorEntrySync } from "./useTutorEntrySync";
import { useTutorHistory } from "./useTutorHistory";
import { useTutorImageFlow } from "./useTutorImageFlow";
import { useTutorPageActions } from "./useTutorPageActions";
import { useTutorPageState } from "./useTutorPageState";
import { useTutorShareResult } from "./useTutorShareResult";
import { useTutorSolveFlow } from "./useTutorSolveFlow";
import { useTutorVariantTraining } from "./useTutorVariantTraining";
import { resolveTutorModeLabels } from "./tutorPageUtils";

export function useTutorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageState = useTutorPageState();

  const {
    history,
    filteredHistory,
    showFavorites,
    historyKeyword,
    historyOriginFilter,
    hasActiveHistoryFilters,
    historyImageCount,
    favoriteHistoryCount,
    setShowFavorites,
    setHistoryKeyword,
    setHistoryOriginFilter,
    saveHistory,
    refreshHistory,
    clearHistoryFilters,
    toggleFavorite,
    editTags,
    deleteHistory,
    reuseHistoryItem: applyHistoryReuse
  } = useTutorHistory({
    onAuthRequired: pageState.handleAuthRequired,
    onReuseHistoryItem: (item) => {
      handleReuseHistoryItem(item);
    }
  });
  const {
    learningMode,
    setLearningMode,
    resultAnswerMode,
    answer,
    setAnswer,
    studyThinking,
    setStudyThinking,
    studyHintCount,
    setStudyHintCount,
    editableQuestion,
    setEditableQuestion,
    activeAction,
    resultOrigin,
    setResultOrigin,
    actionMessage,
    setActionMessage,
    error,
    setError,
    loading,
    studyResult,
    canLoadVariants,
    handleAsk: runAskFlow,
    handleStartStudyMode: runStartStudyModeFlow,
    handleSubmitStudyThinking: runSubmitStudyThinkingFlow,
    handleRevealStudyAnswer: runRevealStudyAnswerFlow,
    handleImageAsk: runImageAskFlow,
    handleRefineSolve: runRefineSolveFlow
  } = useTutorSolveFlow({
    question: pageState.question,
    subject: pageState.subject,
    grade: pageState.grade,
    answerMode: pageState.answerMode,
    saveHistory,
    refreshHistory,
    setLaunchIntent: pageState.setLaunchIntent,
    setLaunchMessage: pageState.setLaunchMessage,
    onAuthRequired: pageState.handleAuthRequired
  });
  const {
    selectedImages,
    cropSelections,
    previewItems,
    selectedCropCount,
    clearCropSelection,
    removeSelectedImage,
    clearSelectedImages,
    handleImageSelect,
    handleCropPointerDown,
    handleCropPointerMove,
    finishCropPointer,
    requestImageAssist
  } = useTutorImageFlow({
    activeAction,
    question: pageState.question,
    subject: pageState.subject,
    grade: pageState.grade,
    onLaunchIntentChange: pageState.setLaunchIntent,
    onActionMessageChange: setActionMessage,
    onError: setError
  });
  const {
    shareTargets,
    shareTargetsLoaded,
    shareTargetsLoading,
    shareTargetsLoadError,
    shareSubmittingTargetId,
    shareError,
    shareSuccess,
    resetShareFeedback,
    reloadShareTargets,
    handleShareResult
  } = useTutorShareResult({
    answer,
    question: pageState.question,
    editableQuestion,
    subject: pageState.subject,
    grade: pageState.grade,
    resultOrigin,
    resultAnswerMode,
    onAuthRequired: pageState.handleAuthRequired
  });
  const {
    variantPack,
    variantAnswers,
    variantResults,
    variantCommittedAnswers,
    loadingVariants,
    variantProgress,
    savingVariantProgressIndex,
    variantReflection,
    loadingVariantReflection,
    submittedVariantCount,
    resetVariantTraining,
    handleLoadVariants,
    loadVariantReflection,
    handleVariantAnswerChange,
    handleVariantSubmit
  } = useTutorVariantTraining({
    answer,
    question: pageState.question,
    editableQuestion,
    subject: pageState.subject,
    grade: pageState.grade,
    onError: setError,
    onAuthRequired: pageState.handleAuthRequired
  });

  useTutorEntrySync({
    searchParams,
    questionInputRef: pageState.questionInputRef,
    setLaunchIntent: pageState.setLaunchIntent,
    setLaunchMessage: pageState.setLaunchMessage,
    setShowFavorites,
    setSubject: pageState.setSubject,
    setGrade: pageState.setGrade,
    setAnswerMode: pageState.setAnswerMode
  });

  useEffect(() => {
    if (!answer) return;
    requestAnimationFrame(() => {
      pageState.answerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [answer, pageState.answerSectionRef]);

  const {
    focusComposerInput,
    handleStartOver,
    handleReuseHistoryItem,
    handleCopy,
    handleAsk,
    handleStartStudyMode,
    handleSubmitStudyThinking,
    handleRevealStudyAnswer,
    handleImageAsk,
    handleRefineSolve
  } = useTutorPageActions({
    questionInputRef: pageState.questionInputRef,
    selectedImagesCount: selectedImages.length,
    requestImageAssist,
    resetShareFeedback,
    resetVariantTraining,
    clearSelectedImages,
    runAskFlow,
    runStartStudyModeFlow,
    runSubmitStudyThinkingFlow,
    runRevealStudyAnswerFlow,
    runImageAskFlow,
    runRefineSolveFlow,
    setLaunchIntent: pageState.setLaunchIntent,
    setLaunchMessage: pageState.setLaunchMessage,
    setActionMessage,
    setLearningMode,
    setSubject: pageState.setSubject,
    setGrade: pageState.setGrade,
    setAnswerMode: pageState.setAnswerMode,
    setAnswer,
    setStudyThinking,
    setStudyHintCount,
    setEditableQuestion,
    setQuestion: pageState.setQuestion,
    setResultOrigin,
    setError
  });

  const { selectedModeLabel, resolvedModeLabel } = resolveTutorModeLabels({
    learningMode,
    answerMode: pageState.answerMode,
    resultAnswerMode,
    studyResult
  });
  const { stageCopy, tutorFlowSteps } = buildTutorStageState({
    loading,
    activeAction,
    answer,
    shareSuccess,
    studyResult,
    resultOrigin,
    editableQuestion,
    selectedImagesCount: selectedImages.length,
    selectedCropCount,
    question: pageState.question,
    learningMode,
    canLoadVariants,
    launchIntent: pageState.launchIntent
  });

  return {
    authRequired: pageState.authRequired,
    answerSectionRef: pageState.answerSectionRef,
    stageOverviewProps: {
      launchMessage: pageState.launchMessage,
      learningMode,
      subject: pageState.subject,
      grade: pageState.grade,
      resolvedModeLabel,
      selectedModeLabel,
      selectedImagesCount: selectedImages.length,
      selectedCropCount,
      maxImageCount: MAX_IMAGE_COUNT,
      hasAnswer: Boolean(answer),
      stageCopy,
      tutorFlowSteps
    },
    composerCardProps: {
      subject: pageState.subject,
      grade: pageState.grade,
      learningMode,
      answerMode: pageState.answerMode,
      question: pageState.question,
      studyThinking,
      launchIntent: pageState.launchIntent,
      selectedImages,
      cropSelections,
      previewItems,
      selectedCropCount,
      questionInputRef: pageState.questionInputRef,
      loading,
      activeAction,
      actionMessage: actionMessage && !answer ? actionMessage : null,
      error,
      onSubjectChange: pageState.setSubject,
      onGradeChange: pageState.setGrade,
      onLearningModeChange: setLearningMode,
      onAnswerModeChange: pageState.setAnswerMode,
      onQuestionChange: pageState.setQuestion,
      onStudyThinkingChange: setStudyThinking,
      onImageSelect: handleImageSelect,
      onClearSelectedImages: clearSelectedImages,
      onClearCropSelection: clearCropSelection,
      onRemoveSelectedImage: removeSelectedImage,
      onCropPointerDown: handleCropPointerDown,
      onCropPointerMove: handleCropPointerMove,
      onCropPointerFinish: finishCropPointer,
      onAsk: handleAsk,
      onStartStudyMode: handleStartStudyMode,
      onImageAsk: handleImageAsk
    },
    answerCardProps: answer
      ? {
          answer,
          subject: pageState.subject,
          grade: pageState.grade,
          resolvedModeLabel,
          resultOrigin,
          resultAnswerMode,
          loading,
          activeAction,
          actionMessage,
          studyThinking,
          studyHintCount,
          editableQuestion,
          loadingVariants,
          variantPack,
          variantAnswers,
          variantResults,
          variantCommittedAnswers,
          submittedVariantCount,
          variantProgress,
          savingVariantProgressIndex,
          variantReflection,
          loadingVariantReflection,
          shareTargets,
          shareTargetsLoaded,
          shareTargetsLoading,
          shareTargetsLoadError,
          shareSubmittingTargetId,
          shareError,
          shareSuccess,
          onStartOver: handleStartOver,
          onFocusComposerInput: focusComposerInput,
          onStudyThinkingChange: setStudyThinking,
          onSubmitStudyThinking: handleSubmitStudyThinking,
          onIncreaseStudyHintCount: () => setStudyHintCount((prev) => Math.min(prev + 1, answer.hints?.length ?? 0)),
          onRevealStudyAnswer: handleRevealStudyAnswer,
          onEditableQuestionChange: setEditableQuestion,
          onRefineSolve: handleRefineSolve,
          onSyncEditableQuestion: () => pageState.setQuestion(editableQuestion.trim()),
          onCopyEditableQuestion: () => {
            void handleCopy(editableQuestion, "已复制题目");
          },
          onCopyAnswer: () => {
            void handleCopy(answer.answer, "已复制答案");
          },
          onLoadVariants: () => {
            void handleLoadVariants();
          },
          onShareResult: (target: Parameters<typeof handleShareResult>[0]) => {
            void handleShareResult(target);
          },
          onReloadShareTargets: () => {
            void reloadShareTargets();
          },
          onOpenShareThread: (threadId: string) => {
            router.push(`/inbox?threadId=${encodeURIComponent(threadId)}`);
          },
          onVariantAnswerChange: handleVariantAnswerChange,
          onVariantSubmit: handleVariantSubmit,
          onLoadVariantReflection: () => {
            void loadVariantReflection("manual");
          }
        }
      : null,
    historyCardProps: {
      history,
      filteredHistory,
      showFavorites,
      historyKeyword,
      historyOriginFilter,
      hasActiveHistoryFilters,
      historyImageCount,
      favoriteHistoryCount,
      onHistoryKeywordChange: setHistoryKeyword,
      onHistoryOriginFilterChange: setHistoryOriginFilter,
      onToggleFavorites: () => setShowFavorites((prev) => !prev),
      onClearHistoryFilters: clearHistoryFilters,
      onReuseHistoryItem: applyHistoryReuse,
      onToggleFavorite: (item: Parameters<typeof toggleFavorite>[0]) => {
        void toggleFavorite(item);
      },
      onEditTags: (item: Parameters<typeof editTags>[0]) => {
        void editTags(item);
      },
      onCopyAnswer: (value: string) => {
        void handleCopy(value, "已复制历史答案");
      },
      onDeleteHistory: (item: Parameters<typeof deleteHistory>[0]) => {
        void deleteHistory(item);
      }
    }
  };
}
