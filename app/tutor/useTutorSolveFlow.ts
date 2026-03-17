"use client";

import { useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import { trackEvent } from "@/lib/analytics-client";
import {
  getRequestErrorMessage,
  isAuthError
} from "@/lib/client-request";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import type { TutorLaunchIntent } from "@/lib/tutor-launch";
import { DEFAULT_ANSWER_MODE } from "./config";
import {
  normalizeTutorAnswer,
  requestTutorAssist,
  requestTutorCoach
} from "./tutorRequests";
import type {
  TutorAnswer,
  TutorAnswerMode,
  TutorAskResponse,
  TutorHistoryCreatePayload,
  TutorHistoryOrigin
} from "./types";
import {
  type ActiveAction,
  type ResultOrigin,
  type StudyQuestionResolution,
  type TutorLearningMode,
  isStudyResult
} from "./utils";

type UseTutorSolveFlowParams = {
  question: string;
  subject: string;
  grade: string;
  answerMode: TutorAnswerMode;
  saveHistory: (payload: TutorHistoryCreatePayload) => Promise<void>;
  refreshHistory: () => Promise<void>;
  setLaunchIntent: (intent: TutorLaunchIntent | null) => void;
  setLaunchMessage: (message: string | null) => void;
  onAuthRequired: () => void;
};

type TutorImageAssistRequest = (answerMode: TutorAnswerMode) => Promise<{
  data: TutorAskResponse;
  processedImages: File[];
}>;

export function useTutorSolveFlow({
  question,
  subject,
  grade,
  answerMode,
  saveHistory,
  refreshHistory,
  setLaunchIntent,
  setLaunchMessage,
  onAuthRequired
}: UseTutorSolveFlowParams) {
  const [learningMode, setLearningMode] = useState<TutorLearningMode>("direct");
  const [resultAnswerMode, setResultAnswerMode] = useState<TutorAnswerMode>(DEFAULT_ANSWER_MODE);
  const [answer, setAnswer] = useState<TutorAnswer | null>(null);
  const [studyThinking, setStudyThinking] = useState("");
  const [studyHintCount, setStudyHintCount] = useState(0);
  const [editableQuestion, setEditableQuestion] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [resultOrigin, setResultOrigin] = useState<ResultOrigin>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRequestError(cause: unknown, fallback: string) {
    if (isAuthError(cause)) {
      onAuthRequired();
      setError("请先登录后继续使用 AI 家教");
      return;
    }
    setError(getRequestErrorMessage(cause, fallback));
  }

  async function saveDirectHistory(input: {
    question: string;
    origin: TutorHistoryOrigin;
    nextAnswer: TutorAnswer;
    recognizedQuestion?: string;
    imageCount?: number;
  }) {
    if (!input.nextAnswer.answer) {
      return;
    }

    await saveHistory({
      question: input.question,
      answer: input.nextAnswer.answer,
      meta: {
        origin: input.origin,
        learningMode: "direct",
        subject,
        grade,
        answerMode,
        provider: input.nextAnswer.provider,
        recognizedQuestion: input.recognizedQuestion,
        imageCount: input.imageCount,
        quality: input.nextAnswer.quality
      }
    });
  }

  async function handleAsk() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    setLaunchIntent("text");
    setLaunchMessage(null);
    setActionMessage(null);
    setActiveAction("text");
    setError(null);
    setAnswer(null);
    setStudyHintCount(0);

    try {
      const data = await requestTutorAssist({
        question: trimmedQuestion,
        subject,
        grade,
        answerMode
      });
      setLearningMode("direct");
      setAnswer(data);
      setActionMessage("文字求解完成，可继续看下方讲解、复制答案，或修改题干后重新求解。");
      setResultAnswerMode(answerMode);
      setEditableQuestion(trimmedQuestion);
      setResultOrigin("text");
      await saveDirectHistory({
        question: trimmedQuestion,
        origin: "text",
        nextAnswer: data,
        recognizedQuestion: trimmedQuestion
      });
      trackEvent({
        eventName: "tutor_direct_answer_completed",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: "text",
          answerMode
        }
      });
    } catch (cause) {
      handleRequestError(cause, "AI 辅导暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleStartStudyMode(
    input?: Partial<StudyQuestionResolution> & {
      activeAction?: ActiveAction;
      selectedImagesCount?: number;
      requestImageAssist?: TutorImageAssistRequest;
    }
  ) {
    const selectedImagesCount = input?.selectedImagesCount ?? 0;
    const requestImageAssist = input?.requestImageAssist;
    setLaunchIntent(selectedImagesCount && !input?.question ? "image" : "text");
    setLaunchMessage(null);
    setActionMessage(null);
    setActiveAction(input?.activeAction ?? (selectedImagesCount && !input?.question ? "study_image" : "study"));
    setError(null);
    setAnswer(null);

    try {
      let resolved: StudyQuestionResolution | null = null;

      if (input?.question?.trim()) {
        resolved = {
          question: input.question.trim(),
          origin: input.origin ?? "refine",
          imageCount: input.imageCount ?? 0
        };
      } else if (selectedImagesCount) {
        if (!requestImageAssist) {
          throw new Error("拍照识题暂不可用，请稍后重试");
        }
        const { data, processedImages } = await requestImageAssist("hints_first");
        const recognizedQuestion = data.recognizedQuestion?.trim() || question.trim();
        if (!recognizedQuestion) {
          throw new Error("暂时没能识别出清晰题干，请补充文字或重拍后再试");
        }
        resolved = {
          question: recognizedQuestion,
          origin: "image",
          imageCount: processedImages.length
        };
      } else if (question.trim()) {
        resolved = {
          question: question.trim(),
          origin: "text",
          imageCount: 0
        };
      }

      if (!resolved) {
        setError("请先输入题目或上传题图");
        return;
      }

      const nextAnswer = await requestTutorCoach({
        question: resolved.question,
        subject,
        grade,
        origin: resolved.origin,
        studentAnswer: studyThinking.trim() || undefined
      });

      setLearningMode("study");
      setAnswer(nextAnswer);
      setEditableQuestion(resolved.question);
      setResultOrigin(resolved.origin);
      setResultAnswerMode(answerMode);
      setStudyHintCount(Math.min(studyThinking.trim() ? 2 : 1, nextAnswer.hints?.length ?? 0));
      setActionMessage(
        studyThinking.trim()
          ? "学习模式已结合你的思路生成追问和提示，先完成知识检查，再决定是否查看完整讲解。"
          : "学习模式已开始，系统会先给提示和追问，不会直接把答案摊开。"
      );
      await refreshHistory();
      trackEvent({
        eventName: "tutor_study_mode_started",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: resolved.origin,
          hasStudentAnswer: Boolean(studyThinking.trim()),
          imageCount: resolved.imageCount
        }
      });
      if (resolved.origin === "image") {
        pushAppToast("已根据题图识别结果进入学习模式");
      }
    } catch (cause) {
      handleRequestError(cause, "学习模式暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSubmitStudyThinking() {
    const trimmedQuestion = editableQuestion.trim() || question.trim();
    const thinking = studyThinking.trim();
    if (!trimmedQuestion || !thinking) {
      return;
    }

    setActionMessage(null);
    setActiveAction("study");
    setError(null);

    try {
      const nextAnswer = await requestTutorCoach({
        question: trimmedQuestion,
        subject,
        grade,
        origin: resultOrigin ?? "text",
        studentAnswer: thinking
      });
      setAnswer(nextAnswer);
      setStudyHintCount(Math.min(Math.max(studyHintCount, 2), nextAnswer.hints?.length ?? 0));
      setActionMessage("已根据你的思路做了校准，先看知识检查，再决定是否查看完整讲解。");
      await refreshHistory();
      trackEvent({
        eventName: "tutor_study_mode_reply_submitted",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: resultOrigin ?? "text"
        }
      });
    } catch (cause) {
      handleRequestError(cause, "思路反馈失败，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRevealStudyAnswer() {
    const trimmedQuestion = editableQuestion.trim() || question.trim();
    if (!trimmedQuestion) {
      return;
    }

    setActionMessage(null);
    setActiveAction("study");
    setError(null);

    try {
      const nextAnswer = await requestTutorCoach({
        question: trimmedQuestion,
        subject,
        grade,
        origin: resultOrigin ?? "text",
        studentAnswer: studyThinking.trim() || undefined,
        revealAnswer: true
      });
      setAnswer(nextAnswer);
      setStudyHintCount(nextAnswer.hints?.length ?? 0);
      setActionMessage("完整讲解已揭晓。现在请对照答案，再复述一遍关键转折。");
      await refreshHistory();
      trackEvent({
        eventName: "tutor_study_mode_answer_revealed",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: resultOrigin ?? "text",
          hasStudentAnswer: Boolean(studyThinking.trim())
        }
      });
      pushAppToast("已揭晓完整讲解");
    } catch (cause) {
      handleRequestError(cause, "完整讲解暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleImageAsk(input: {
    selectedImagesCount: number;
    requestImageAssist: TutorImageAssistRequest;
  }) {
    if (!input.selectedImagesCount) {
      return;
    }

    setLaunchIntent("image");
    setLaunchMessage(null);
    setActionMessage(null);
    setActiveAction("image");
    setError(null);
    setAnswer(null);
    setStudyHintCount(0);

    try {
      const { data: rawData, processedImages } = await input.requestImageAssist(answerMode);
      const recognizedQuestion = rawData.recognizedQuestion?.trim() || question.trim();
      const data = normalizeTutorAnswer(rawData as TutorAnswer, "direct", recognizedQuestion);
      setLearningMode("direct");
      setAnswer(data);
      setActionMessage("识题完成，先核对下方识别题干；如果有误，直接编辑后重新求解会更稳。");
      setResultAnswerMode(answerMode);
      setEditableQuestion(recognizedQuestion);
      setResultOrigin("image");
      await saveDirectHistory({
        question: recognizedQuestion || `${SUBJECT_LABELS[subject] ?? subject} · ${getGradeLabel(grade)} · 图片识题`,
        origin: "image",
        nextAnswer: data,
        recognizedQuestion: recognizedQuestion || undefined,
        imageCount: processedImages.length
      });
      trackEvent({
        eventName: "tutor_direct_answer_completed",
        page: "/tutor",
        subject,
        grade,
        props: {
          origin: "image",
          answerMode,
          imageCount: processedImages.length
        }
      });
      pushAppToast("识题完成，可继续编辑题干再重算");
    } catch (cause) {
      handleRequestError(cause, "拍照识题暂不可用，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRefineSolve() {
    const trimmedQuestion = editableQuestion.trim();
    if (!trimmedQuestion) {
      return;
    }

    setActionMessage(null);
    setActiveAction("refine");
    setError(null);

    try {
      if (isStudyResult(answer)) {
        const nextAnswer = await requestTutorCoach({
          question: trimmedQuestion,
          subject,
          grade,
          origin: "refine"
        });
        setAnswer(nextAnswer);
        setLearningMode("study");
        setStudyThinking("");
        setStudyHintCount(Math.min(1, nextAnswer.hints?.length ?? 0));
        setActionMessage("已按编辑后的题目重新开始学习模式，可继续先说思路，再决定是否查看完整讲解。");
        setResultAnswerMode(answerMode);
        setEditableQuestion(trimmedQuestion);
        setResultOrigin("refine");
        await refreshHistory();
        pushAppToast("已按编辑后的题目重新开始学习模式");
        return;
      }

      const data = await requestTutorAssist({
        question: trimmedQuestion,
        subject,
        grade,
        answerMode
      });
      setLearningMode("direct");
      setAnswer(data);
      setActionMessage("已按编辑后的题目重新求解，可直接对比下方新结果。");
      setResultAnswerMode(answerMode);
      setEditableQuestion(trimmedQuestion);
      setResultOrigin("refine");
      await saveDirectHistory({
        question: trimmedQuestion,
        origin: "refine",
        nextAnswer: data,
        recognizedQuestion: trimmedQuestion
      });
      pushAppToast("已按编辑后的题目重新求解");
    } catch (cause) {
      handleRequestError(cause, "重新求解失败，请稍后重试");
    } finally {
      setActiveAction(null);
    }
  }

  return {
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
    loading: activeAction !== null,
    studyResult: isStudyResult(answer),
    canLoadVariants: Boolean(answer?.answer.trim()),
    handleAsk,
    handleStartStudyMode,
    handleSubmitStudyThinking,
    handleRevealStudyAnswer,
    handleImageAsk,
    handleRefineSolve
  };
}
