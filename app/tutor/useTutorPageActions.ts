"use client";

import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { pushAppToast } from "@/components/AppToastHub";
import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import type { TutorAskResponse, TutorAnswer, TutorAnswerMode, TutorHistoryItem } from "./types";
import { buildTutorHistoryReuseFlowState, buildTutorStartOverFlowState } from "./tutorPageUtils";
import { copyToClipboard } from "./utils";
import type { TutorLearningMode } from "./utils";

type Setter<T> = Dispatch<SetStateAction<T>>;

type TutorImageAssistRequest = (answerMode: TutorAnswerMode) => Promise<{
  data: TutorAskResponse;
  processedImages: File[];
}>;

type TutorPageActionsOptions = {
  questionInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  selectedImagesCount: number;
  requestImageAssist: TutorImageAssistRequest;
  resetShareFeedback: () => void;
  resetVariantTraining: () => void;
  clearSelectedImages: () => void;
  runAskFlow: () => Promise<void>;
  runStartStudyModeFlow: (input?: {
    selectedImagesCount?: number;
    requestImageAssist?: TutorImageAssistRequest;
  }) => Promise<void>;
  runSubmitStudyThinkingFlow: () => Promise<void>;
  runRevealStudyAnswerFlow: () => Promise<void>;
  runImageAskFlow: (input: {
    selectedImagesCount: number;
    requestImageAssist: TutorImageAssistRequest;
  }) => Promise<void>;
  runRefineSolveFlow: () => Promise<void>;
  setLaunchIntent: Setter<TutorLaunchIntent | null>;
  setLaunchMessage: Setter<string | null>;
  setActionMessage: Setter<string | null>;
  setLearningMode: Setter<TutorLearningMode>;
  setSubject: Setter<string>;
  setGrade: Setter<string>;
  setAnswerMode: Setter<TutorAnswerMode>;
  setAnswer: Setter<TutorAnswer | null>;
  setStudyThinking: Setter<string>;
  setStudyHintCount: Setter<number>;
  setEditableQuestion: Setter<string>;
  setQuestion: Setter<string>;
  setResultOrigin: Setter<"text" | "image" | "refine" | null>;
  setError: Setter<string | null>;
};

export function useTutorPageActions({
  questionInputRef,
  selectedImagesCount,
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
  setLaunchIntent,
  setLaunchMessage,
  setActionMessage,
  setLearningMode,
  setSubject,
  setGrade,
  setAnswerMode,
  setAnswer,
  setStudyThinking,
  setStudyHintCount,
  setEditableQuestion,
  setQuestion,
  setResultOrigin,
  setError
}: TutorPageActionsOptions) {
  const focusComposerInput = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .getElementById("tutor-composer-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      questionInputRef.current?.focus();
    });
  }, [questionInputRef]);

  const handleStartOver = useCallback(() => {
    const resetState = buildTutorStartOverFlowState();
    resetShareFeedback();
    resetVariantTraining();
    setLaunchIntent(resetState.launchIntent);
    setLaunchMessage(resetState.launchMessage);
    setActionMessage(resetState.actionMessage);
    setAnswer(resetState.nextAnswer);
    setStudyThinking(resetState.nextStudyThinking);
    setStudyHintCount(resetState.nextStudyHintCount);
    setEditableQuestion(resetState.nextEditableQuestion);
    setQuestion(resetState.nextQuestion);
    setResultOrigin(resetState.nextResultOrigin);
    clearSelectedImages();
    setError(resetState.nextError);
    focusComposerInput();
    pushAppToast(resetState.toastMessage);
  }, [
    clearSelectedImages,
    focusComposerInput,
    resetShareFeedback,
    resetVariantTraining,
    setActionMessage,
    setAnswer,
    setEditableQuestion,
    setError,
    setLaunchIntent,
    setLaunchMessage,
    setQuestion,
    setResultOrigin,
    setStudyHintCount,
    setStudyThinking
  ]);

  const handleReuseHistoryItem = useCallback((item: TutorHistoryItem) => {
    const reuseState = buildTutorHistoryReuseFlowState(item);
    if (reuseState.nextSubject) {
      setSubject(reuseState.nextSubject);
    }
    if (reuseState.nextGrade) {
      setGrade(reuseState.nextGrade);
    }
    if (reuseState.nextAnswerMode) {
      setAnswerMode(reuseState.nextAnswerMode);
    }
    setLearningMode(reuseState.nextLearningMode);
    resetShareFeedback();
    resetVariantTraining();
    setLaunchIntent(reuseState.launchIntent);
    setActionMessage(reuseState.actionMessage);
    clearSelectedImages();
    setQuestion(reuseState.nextQuestion);
    setStudyThinking(reuseState.nextStudyThinking);
    setStudyHintCount(reuseState.nextStudyHintCount);
    setEditableQuestion(reuseState.nextEditableQuestion);
    setAnswer(reuseState.nextAnswer);
    setResultOrigin(reuseState.nextResultOrigin);
    setError(reuseState.nextError);
    focusComposerInput();
    pushAppToast(reuseState.toastMessage);
  }, [
    clearSelectedImages,
    focusComposerInput,
    resetShareFeedback,
    resetVariantTraining,
    setActionMessage,
    setAnswer,
    setAnswerMode,
    setEditableQuestion,
    setError,
    setGrade,
    setLaunchIntent,
    setLearningMode,
    setQuestion,
    setResultOrigin,
    setStudyHintCount,
    setStudyThinking,
    setSubject
  ]);

  const handleCopy = useCallback(async (value: string, message: string) => {
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
  }, []);

  const handleAsk = useCallback(() => {
    resetShareFeedback();
    resetVariantTraining();
    void runAskFlow();
  }, [resetShareFeedback, resetVariantTraining, runAskFlow]);

  const handleStartStudyMode = useCallback(() => {
    resetShareFeedback();
    resetVariantTraining();
    void runStartStudyModeFlow({
      selectedImagesCount,
      requestImageAssist
    });
  }, [
    requestImageAssist,
    resetShareFeedback,
    resetVariantTraining,
    runStartStudyModeFlow,
    selectedImagesCount
  ]);

  const handleSubmitStudyThinking = useCallback(() => {
    resetShareFeedback();
    void runSubmitStudyThinkingFlow();
  }, [resetShareFeedback, runSubmitStudyThinkingFlow]);

  const handleRevealStudyAnswer = useCallback(() => {
    resetShareFeedback();
    void runRevealStudyAnswerFlow();
  }, [resetShareFeedback, runRevealStudyAnswerFlow]);

  const handleImageAsk = useCallback(() => {
    resetShareFeedback();
    resetVariantTraining();
    void runImageAskFlow({
      selectedImagesCount,
      requestImageAssist
    });
  }, [
    requestImageAssist,
    resetShareFeedback,
    resetVariantTraining,
    runImageAskFlow,
    selectedImagesCount
  ]);

  const handleRefineSolve = useCallback(() => {
    resetShareFeedback();
    resetVariantTraining();
    void runRefineSolveFlow();
  }, [resetShareFeedback, resetVariantTraining, runRefineSolveFlow]);

  return {
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
  };
}
