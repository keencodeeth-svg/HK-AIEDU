"use client";

import { useCallback, useEffect, useState } from "react";
import { pushAppToast } from "@/components/AppToastHub";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type {
  TutorAnswer,
  TutorAnswerMode,
  TutorShareResultResponse,
  TutorShareTarget,
  TutorShareTargetsResponse
} from "./types";
import { isStudyResult } from "./utils";

type UseTutorShareResultParams = {
  answer: TutorAnswer | null;
  question: string;
  editableQuestion: string;
  subject: string;
  grade: string;
  resultOrigin: "text" | "image" | "refine" | null;
  resultAnswerMode: TutorAnswerMode;
  onAuthRequired: () => void;
};

export function useTutorShareResult({
  answer,
  question,
  editableQuestion,
  subject,
  grade,
  resultOrigin,
  resultAnswerMode,
  onAuthRequired
}: UseTutorShareResultParams) {
  const [shareTargets, setShareTargets] = useState<TutorShareTarget[]>([]);
  const [shareTargetsLoaded, setShareTargetsLoaded] = useState(false);
  const [shareTargetsLoading, setShareTargetsLoading] = useState(false);
  const [shareSubmittingTargetId, setShareSubmittingTargetId] = useState("");
  const [shareTargetsLoadError, setShareTargetsLoadError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<{ threadId: string; targetName: string; reused: boolean } | null>(null);

  const loadShareTargets = useCallback(
    async (force = false) => {
      if (!answer || (shareTargetsLoaded && !force) || shareTargetsLoading) {
        return;
      }

      setShareTargetsLoading(true);
      setShareTargetsLoadError(null);
      try {
        const data = await requestJson<TutorShareTargetsResponse>(
          "/api/ai/share-targets",
          { cache: "no-store" }
        );
        setShareTargets(data.data ?? []);
        setShareTargetsLoaded(true);
        setShareTargetsLoadError(null);
      } catch (error) {
        setShareTargets([]);
        setShareTargetsLoaded(true);
        if (isAuthError(error)) {
          onAuthRequired();
          setShareTargetsLoadError("请先登录后再分享结果");
        } else {
          setShareTargetsLoadError(
            getRequestErrorMessage(error, "可分享对象加载失败，请稍后重试")
          );
        }
      } finally {
        setShareTargetsLoading(false);
      }
    },
    [answer, onAuthRequired, shareTargetsLoaded, shareTargetsLoading]
  );

  useEffect(() => {
    if (!answer || shareTargetsLoaded || shareTargetsLoading) {
      return;
    }

    void loadShareTargets();
  }, [answer, loadShareTargets, shareTargetsLoaded, shareTargetsLoading]);

  function resetShareFeedback() {
    setShareError(null);
    setShareSuccess(null);
    setShareSubmittingTargetId("");
  }

  async function handleShareResult(target: TutorShareTarget) {
    if (!answer) return;

    const composedQuestion = editableQuestion.trim() || answer.recognizedQuestion?.trim() || question.trim();
    if (!composedQuestion || !answer.answer.trim()) {
      const message = "当前结果不完整，暂时无法分享";
      setShareError(message);
      pushAppToast(message, "error");
      return;
    }

    setShareSubmittingTargetId(target.id);
    setShareError(null);
    setShareSuccess(null);

    try {
      const data = await requestJson<TutorShareResultResponse>("/api/ai/share-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          question: composedQuestion,
          recognizedQuestion: editableQuestion.trim() || answer.recognizedQuestion?.trim() || undefined,
          answer: answer.answer,
          origin: resultOrigin ?? undefined,
          subject,
          grade,
          answerMode: isStudyResult(answer) ? "hints_first" : resultAnswerMode,
          provider: answer.provider,
          steps: answer.steps ?? [],
          hints: answer.hints ?? [],
          quality: answer.quality
        })
      });
      if (!data.data) {
        const message = data.error ?? data.message ?? "分享失败，请稍后重试";
        setShareError(message);
        pushAppToast(message, "error");
        return;
      }

      setShareSuccess({
        threadId: data.data.threadId,
        targetName: data.data.target.name,
        reused: data.data.reused
      });
      pushAppToast(data.data.reused ? `已继续发送给${data.data.target.name}` : `已发送给${data.data.target.name}`);
    } catch (error) {
      const message = isAuthError(error)
        ? "请先登录后再分享结果"
        : getRequestErrorMessage(error, "分享失败，请稍后重试");
      if (isAuthError(error)) {
        onAuthRequired();
      }
      setShareError(message);
      pushAppToast(message, "error");
    } finally {
      setShareSubmittingTargetId("");
    }
  }

  return {
    shareTargets,
    shareTargetsLoaded,
    shareTargetsLoading,
    shareTargetsLoadError,
    shareSubmittingTargetId,
    shareError,
    shareSuccess,
    resetShareFeedback,
    reloadShareTargets: () => {
      void loadShareTargets(true);
    },
    handleShareResult
  };
}
