"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import { type TutorLaunchIntent } from "@/lib/tutor-launch";
import {
  ANSWER_MODE_OPTIONS,
  DEFAULT_ANSWER_MODE,
  DEFAULT_GRADE,
  DEFAULT_SUBJECT,
  LEARNING_MODE_OPTIONS,
  MAX_IMAGE_COUNT
} from "./config";
import type { TutorAnswerMode } from "./types";
import { buildTutorStageState } from "./tutorStageState";
import { useTutorEntrySync } from "./useTutorEntrySync";
import { useTutorHistory } from "./useTutorHistory";
import { useTutorImageFlow } from "./useTutorImageFlow";
import { useTutorShareResult } from "./useTutorShareResult";
import { useTutorSolveFlow } from "./useTutorSolveFlow";
import { useTutorVariantTraining } from "./useTutorVariantTraining";
import { copyToClipboard } from "./utils";

export function useTutorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const answerSectionRef = useRef<HTMLDivElement | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchIntent, setLaunchIntent] = useState<TutorLaunchIntent | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [grade, setGrade] = useState(DEFAULT_GRADE);
  const [answerMode, setAnswerMode] = useState<TutorAnswerMode>(DEFAULT_ANSWER_MODE);

  const handleAuthRequired = useCallback(() => {
    setAuthRequired(true);
  }, []);

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
    onAuthRequired: handleAuthRequired,
    onReuseHistoryItem: (item) => {
      const nextQuestion = item.meta?.recognizedQuestion?.trim() || item.question.trim();
      if (item.meta?.subject) {
        setSubject(item.meta.subject);
      }
      if (item.meta?.grade) {
        setGrade(item.meta.grade);
      }
      if (item.meta?.answerMode) {
        setAnswerMode(item.meta.answerMode);
      }
      setLearningMode(item.meta?.learningMode === "study" ? "study" : "direct");
      resetShareFeedback();
      resetVariantTraining();
      setLaunchIntent((item.meta?.origin ?? "text") === "image" ? "image" : "text");
      setActionMessage("已从历史记录回填到提问区，可继续追问或重新求解。");
      clearSelectedImages();
      setQuestion(nextQuestion);
      setStudyThinking("");
      setStudyHintCount(0);
      setEditableQuestion(nextQuestion);
      setAnswer(null);
      setResultOrigin(null);
      setError(null);
      focusComposerInput();
      pushAppToast("已回填到提问区，可继续追问或重新求解");
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
    question,
    subject,
    grade,
    answerMode,
    saveHistory,
    refreshHistory,
    setLaunchIntent,
    setLaunchMessage,
    onAuthRequired: handleAuthRequired
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
    question,
    subject,
    grade,
    onLaunchIntentChange: setLaunchIntent,
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
    question,
    editableQuestion,
    subject,
    grade,
    resultOrigin,
    resultAnswerMode,
    onAuthRequired: handleAuthRequired
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
    question,
    editableQuestion,
    subject,
    grade,
    onError: setError,
    onAuthRequired: handleAuthRequired
  });

  useTutorEntrySync({
    searchParams,
    questionInputRef,
    setLaunchIntent,
    setLaunchMessage,
    setShowFavorites,
    setSubject,
    setGrade,
    setAnswerMode
  });

  useEffect(() => {
    if (!answer) return;
    requestAnimationFrame(() => {
      answerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [answer]);

  function focusComposerInput() {
    requestAnimationFrame(() => {
      document.getElementById("tutor-composer-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      questionInputRef.current?.focus();
    });
  }

  function handleStartOver() {
    resetShareFeedback();
    resetVariantTraining();
    setLaunchIntent("text");
    setLaunchMessage(null);
    setActionMessage(null);
    setAnswer(null);
    setStudyThinking("");
    setStudyHintCount(0);
    setEditableQuestion("");
    setQuestion("");
    setResultOrigin(null);
    clearSelectedImages();
    setError(null);
    focusComposerInput();
    pushAppToast("已清空当前结果，可以开始新一轮提问");
  }

  async function handleCopy(value: string, message: string) {
    if (!value.trim()) {
      pushAppToast("暂无可复制内容", "error");
      return;
    }
    try {
      await copyToClipboard(value.trim());
      pushAppToast(message);
    } catch {
      pushAppToast("复制失败，请稍后重试", "error");
    }
  }

  function handleAsk() {
    resetShareFeedback();
    resetVariantTraining();
    void runAskFlow();
  }

  function handleStartStudyMode() {
    resetShareFeedback();
    resetVariantTraining();
    void runStartStudyModeFlow({
      selectedImagesCount: selectedImages.length,
      requestImageAssist
    });
  }

  function handleSubmitStudyThinking() {
    resetShareFeedback();
    void runSubmitStudyThinkingFlow();
  }

  function handleRevealStudyAnswer() {
    resetShareFeedback();
    void runRevealStudyAnswerFlow();
  }

  function handleImageAsk() {
    resetShareFeedback();
    resetVariantTraining();
    void runImageAskFlow({
      selectedImagesCount: selectedImages.length,
      requestImageAssist
    });
  }

  function handleRefineSolve() {
    resetShareFeedback();
    resetVariantTraining();
    void runRefineSolveFlow();
  }

  const selectedLearningMode = LEARNING_MODE_OPTIONS.find((item) => item.value === learningMode) ?? LEARNING_MODE_OPTIONS[0];
  const selectedAnswerMode = ANSWER_MODE_OPTIONS.find((item) => item.value === answerMode) ?? ANSWER_MODE_OPTIONS[1];
  const resolvedAnswerMode = ANSWER_MODE_OPTIONS.find((item) => item.value === resultAnswerMode) ?? selectedAnswerMode;
  const selectedModeLabel = learningMode === "study" ? selectedLearningMode.label : selectedAnswerMode.label;
  const resolvedModeLabel = studyResult ? "学习模式" : resolvedAnswerMode.label;
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
    question,
    learningMode,
    canLoadVariants,
    launchIntent
  });

  return {
    authRequired,
    answerSectionRef,
    stageOverviewProps: {
      launchMessage,
      learningMode,
      subject,
      grade,
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
      subject,
      grade,
      learningMode,
      answerMode,
      question,
      studyThinking,
      launchIntent,
      selectedImages,
      cropSelections,
      previewItems,
      selectedCropCount,
      questionInputRef,
      loading,
      activeAction,
      actionMessage: actionMessage && !answer ? actionMessage : null,
      error,
      onSubjectChange: setSubject,
      onGradeChange: setGrade,
      onLearningModeChange: setLearningMode,
      onAnswerModeChange: setAnswerMode,
      onQuestionChange: setQuestion,
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
          subject,
          grade,
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
          onSyncEditableQuestion: () => setQuestion(editableQuestion.trim()),
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
