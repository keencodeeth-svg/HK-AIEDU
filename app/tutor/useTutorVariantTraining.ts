"use client";

import { useMemo, useRef, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import { trackEvent } from "@/lib/analytics-client";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  TutorAnswer,
  TutorVariantPack,
  TutorVariantPackResponse,
  TutorVariantProgress,
  TutorVariantProgressResponse,
  TutorVariantReflection,
  TutorVariantReflectionResponse
} from "./types";
import { isStudyResult } from "./utils";

type UseTutorVariantTrainingParams = {
  answer: TutorAnswer | null;
  question: string;
  editableQuestion: string;
  subject: string;
  grade: string;
  onError: (message: string | null) => void;
  onAuthRequired: () => void;
};

export function useTutorVariantTraining({
  answer,
  question,
  editableQuestion,
  subject,
  grade,
  onError,
  onAuthRequired
}: UseTutorVariantTrainingParams) {
  const variantProgressRequestIdRef = useRef(0);
  const [variantPack, setVariantPack] = useState<TutorVariantPack | null>(null);
  const [variantAnswers, setVariantAnswers] = useState<Record<number, string>>({});
  const [variantResults, setVariantResults] = useState<Record<number, boolean | null>>({});
  const [variantCommittedAnswers, setVariantCommittedAnswers] = useState<Record<number, string>>({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantProgress, setVariantProgress] = useState<TutorVariantProgress | null>(null);
  const [savingVariantProgressIndex, setSavingVariantProgressIndex] = useState<number | null>(null);
  const [variantReflection, setVariantReflection] = useState<TutorVariantReflection | null>(null);
  const [loadingVariantReflection, setLoadingVariantReflection] = useState(false);

  const submittedVariantCount = useMemo(
    () =>
      variantPack?.variants.reduce((count, _, index) => (typeof variantResults[index] === "boolean" ? count + 1 : count), 0) ?? 0,
    [variantPack, variantResults]
  );

  function resetVariantTraining() {
    setVariantPack(null);
    setVariantAnswers({});
    setVariantResults({});
    setVariantCommittedAnswers({});
    setLoadingVariants(false);
    setVariantProgress(null);
    setSavingVariantProgressIndex(null);
    setVariantReflection(null);
    setLoadingVariantReflection(false);
  }

  async function handleLoadVariants() {
    if (!answer?.answer.trim()) {
      return;
    }

    const composedQuestion = editableQuestion.trim() || answer.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion) {
      onError("请先确认题目后再生成变式巩固");
      return;
    }

    setLoadingVariants(true);
    onError(null);

    try {
      const payload = await requestJson<TutorVariantPackResponse>(
        "/api/ai/study-variants",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: composedQuestion,
            answer: answer.answer,
            subject,
            grade,
            count: 2
          })
        }
      );
      if (!payload.data) {
        onError(payload.error ?? payload.message ?? "变式生成失败，请稍后重试");
        return;
      }

      setVariantPack(payload.data);
      setVariantAnswers({});
      setVariantResults({});
      setVariantCommittedAnswers({});
      setVariantProgress(null);
      setSavingVariantProgressIndex(null);
      setVariantReflection(null);
      trackEvent({
        eventName: "tutor_variant_pack_loaded",
        page: "/tutor",
        subject,
        grade,
        props: {
          learningMode: isStudyResult(answer) ? "study" : "direct",
          sourceMode: payload.data.sourceMode ?? "fallback",
          variantCount: payload.data.variants.length
        }
      });
      pushAppToast(
        payload.data.sourceMode === "pool"
          ? "已加载题库中的同类变式题"
          : payload.data.sourceMode === "fallback"
            ? "已生成概念迁移练习，可先做一轮巩固"
          : "已生成 AI 变式巩固题"
      );
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired();
        onError("请先登录后再使用变式巩固");
        return;
      }
      onError(getRequestErrorMessage(error, "变式生成失败，请稍后重试"));
    } finally {
      setLoadingVariants(false);
    }
  }

  async function loadVariantReflection(
    trigger: "auto" | "manual" = "manual",
    nextAnswers?: Record<number, string>,
    submittedResults?: Record<number, boolean | null>
  ) {
    if (!variantPack?.variants.length) {
      return;
    }

    const composedQuestion = editableQuestion.trim() || answer?.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion) {
      onError("请先确认题目后再生成学习复盘");
      return;
    }

    const answerMap = nextAnswers ?? variantAnswers;
    const submittedMap = submittedResults ?? variantResults;
    const reflectionVariants = variantPack.variants.map((variant, index) => ({
      stem: variant.stem,
      answer: variant.answer,
      explanation: variant.explanation,
      studentAnswer: typeof submittedMap[index] === "boolean" ? answerMap[index] ?? "" : ""
    }));

    const answeredCount = reflectionVariants.filter((variant) => variant.studentAnswer.trim()).length;
    if (!answeredCount) {
      onError("请先至少提交 1 道变式题，再生成学习复盘");
      return;
    }

    setLoadingVariantReflection(true);
    onError(null);

    try {
      const payload = await requestJson<TutorVariantReflectionResponse>(
        "/api/ai/study-reflection",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: composedQuestion,
            subject,
            grade,
            knowledgePointTitle: variantPack.knowledgePointTitle,
            variants: reflectionVariants
          })
        }
      );
      if (!payload.data) {
        onError(payload.error ?? payload.message ?? "学习复盘生成失败，请稍后重试");
        return;
      }

      setVariantReflection(payload.data);
      trackEvent({
        eventName: "tutor_variant_reflection_loaded",
        page: "/tutor",
        subject,
        grade,
        props: {
          trigger,
          learningMode: isStudyResult(answer) ? "study" : "direct",
          masteryLevel: payload.data.masteryLevel,
          answeredCount: payload.data.answeredCount,
          correctCount: payload.data.correctCount,
          total: payload.data.total,
          detailSource: payload.data.detailSource
        }
      });
      pushAppToast(
        payload.data.masteryLevel === "secure"
          ? "这轮迁移做得很稳，可以继续拉开难度"
          : "已生成学习复盘，先看错因再决定下一步"
      );
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired();
        onError("请先登录后再生成学习复盘");
        return;
      }
      onError(getRequestErrorMessage(error, "学习复盘生成失败，请稍后重试"));
    } finally {
      setLoadingVariantReflection(false);
    }
  }

  async function syncVariantProgress(index: number, variant: TutorVariantPack["variants"][number], selected: string) {
    const composedQuestion = editableQuestion.trim() || answer?.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion) {
      return;
    }

    const requestId = ++variantProgressRequestIdRef.current;
    setSavingVariantProgressIndex(index);
    setVariantProgress(null);
    onError(null);
    try {
      const payload = await requestJson<TutorVariantProgressResponse>(
        "/api/ai/study-variant-progress",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: composedQuestion,
            subject,
            grade,
            knowledgePointId: variantPack?.knowledgePointId,
            knowledgePointTitle: variantPack?.knowledgePointTitle,
            variant: {
              stem: variant.stem,
              answer: variant.answer,
              explanation: variant.explanation,
              studentAnswer: selected
            }
          })
        }
      );
      if (!payload.data) {
        onError(payload.error ?? payload.message ?? "学习成长同步失败，请稍后重试");
        return;
      }

      setVariantCommittedAnswers((prev) => ({
        ...prev,
        [index]: selected
      }));
      if (variantProgressRequestIdRef.current === requestId) {
        setVariantProgress(payload.data);
      }
      trackEvent({
        eventName: "tutor_variant_progress_synced",
        page: "/tutor",
        subject,
        grade,
        props: {
          variantIndex: index,
          persisted: payload.data.persisted,
          masteryScore: payload.data.mastery?.masteryScore ?? null,
          masteryDelta: payload.data.mastery?.masteryDelta ?? null,
          weaknessRank: payload.data.mastery?.weaknessRank ?? null
        }
      });
      if (!payload.data.persisted) {
        pushAppToast(payload.data.message);
      }
    } catch (error) {
      if (isAuthError(error)) {
        onAuthRequired();
        onError("请先登录后再同步学习成长");
        return;
      }
      if (variantProgressRequestIdRef.current === requestId) {
        setVariantProgress(null);
      }
      onError(getRequestErrorMessage(error, "学习成长同步失败，请稍后重试"));
    } finally {
      setSavingVariantProgressIndex((current) => (current === index ? null : current));
    }
  }

  function handleVariantAnswerChange(index: number, value: string) {
    setVariantAnswers((prev) => ({
      ...prev,
      [index]: value
    }));
    setVariantResults((prev) => {
      if (!(index in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setVariantCommittedAnswers((prev) => {
      if (!(index in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setVariantProgress(null);
    setVariantReflection(null);
  }

  function handleVariantSubmit(index: number, selected: string, correctAnswer: string) {
    if (!variantPack) {
      return;
    }
    if (savingVariantProgressIndex !== null) {
      return;
    }
    if (variantCommittedAnswers[index] === selected && typeof variantResults[index] === "boolean") {
      return;
    }

    const correct = selected === correctAnswer;
    const nextResults = {
      ...variantResults,
      [index]: correct
    };
    const nextAnswers = {
      ...variantAnswers,
      [index]: selected
    };
    setVariantResults(nextResults);
    trackEvent({
      eventName: "tutor_variant_answer_submitted",
      page: "/tutor",
      subject,
      grade,
      props: {
        learningMode: isStudyResult(answer) ? "study" : "direct",
        variantIndex: index,
        correct
      }
    });
    void syncVariantProgress(index, variantPack.variants[index]!, selected);
    if (variantPack.variants.every((_, variantIndex) => typeof nextResults[variantIndex] === "boolean")) {
      void loadVariantReflection("auto", nextAnswers, nextResults);
    }
    pushAppToast(correct ? "这道变式答对了" : "这道变式还没稳，先看下方解析");
  }

  return {
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
  };
}
