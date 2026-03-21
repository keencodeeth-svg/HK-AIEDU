"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  ExplainPack,
  ExplainPackResponse,
  FavoriteResponse,
  Question,
  VariantPack,
  VariantResponse
} from "./types";
import {
  getPracticeExplainRequestMessage,
  getPracticeFavoriteRequestMessage,
  getPracticeVariantRequestMessage,
  isPracticeQuestionMissingError
} from "./utils";

type PracticeQuestionSupportOptions = {
  question: Question | null;
  answer: string;
  resultAnswer?: string;
  resetSignal: number;
  clearQuestionWorkspace: () => void;
  handleAuthRequired: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function usePracticeQuestionSupport({
  question,
  answer,
  resultAnswer,
  resetSignal,
  clearQuestionWorkspace,
  handleAuthRequired,
  setError
}: PracticeQuestionSupportOptions) {
  const activeQuestionIdRef = useRef<string | null>(null);
  const explainRequestIdRef = useRef(0);
  const variantRequestIdRef = useRef(0);
  const favoriteRequestIdRef = useRef(0);
  const [variantPack, setVariantPack] = useState<VariantPack | null>(null);
  const [variantAnswers, setVariantAnswers] = useState<Record<number, string>>({});
  const [variantResults, setVariantResults] = useState<Record<number, boolean | null>>({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [favorite, setFavorite] = useState<{ tags: string[] } | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [explainMode, setExplainMode] = useState<"text" | "visual" | "analogy">("text");
  const [explainPack, setExplainPack] = useState<ExplainPack | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const resetQuestionSupport = useCallback(() => {
    explainRequestIdRef.current += 1;
    variantRequestIdRef.current += 1;
    favoriteRequestIdRef.current += 1;
    setFavorite(null);
    setFavoriteLoading(false);
    setVariantPack(null);
    setVariantAnswers({});
    setVariantResults({});
    setLoadingVariants(false);
    setExplainPack(null);
    setExplainMode("text");
    setExplainLoading(false);
  }, []);

  const loadExplainPack = useCallback(
    async (questionId: string) => {
      const requestId = explainRequestIdRef.current + 1;
      explainRequestIdRef.current = requestId;
      setExplainLoading(true);

      try {
        const payload = await requestJson<ExplainPackResponse>("/api/practice/explanation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId })
        });

        if (requestId !== explainRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
          return;
        }

        setExplainPack(payload.data ?? null);
      } catch (nextError) {
        if (requestId !== explainRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
          return;
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }

        setExplainPack(null);
        if (isPracticeQuestionMissingError(nextError)) {
          clearQuestionWorkspace();
        }
        setError(getPracticeExplainRequestMessage(nextError, "AI 讲解生成失败"));
      } finally {
        if (requestId === explainRequestIdRef.current) {
          setExplainLoading(false);
        }
      }
    },
    [clearQuestionWorkspace, handleAuthRequired, setError]
  );

  const loadFavorite = useCallback(
    async (questionId: string) => {
      const requestId = favoriteRequestIdRef.current + 1;
      favoriteRequestIdRef.current = requestId;

      try {
        const payload = await requestJson<FavoriteResponse>(`/api/favorites/${questionId}`);
        if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
          return;
        }

        setFavorite(payload.data ? { tags: payload.data.tags ?? [] } : null);
      } catch (nextError) {
        if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
          return;
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return;
        }

        setFavorite(null);
        if (isPracticeQuestionMissingError(nextError)) {
          clearQuestionWorkspace();
          setError(getPracticeFavoriteRequestMessage(nextError, "收藏信息加载失败"));
        }
      }
    },
    [clearQuestionWorkspace, handleAuthRequired, setError]
  );

  const toggleFavorite = useCallback(async () => {
    if (!question) {
      return;
    }

    const requestId = favoriteRequestIdRef.current + 1;
    const questionId = question.id;
    favoriteRequestIdRef.current = requestId;
    setFavoriteLoading(true);

    try {
      if (favorite) {
        await requestJson(`/api/favorites/${questionId}`, { method: "DELETE" });
        if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
          return;
        }

        setFavorite(null);
      } else {
        const payload = await requestJson<FavoriteResponse>("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, tags: [] })
        });

        if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
          return;
        }

        setFavorite(payload.data ? { tags: payload.data.tags ?? [] } : null);
      }
    } catch (nextError) {
      if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }

      if (isPracticeQuestionMissingError(nextError)) {
        clearQuestionWorkspace();
      }
      setError(getPracticeFavoriteRequestMessage(nextError, favorite ? "取消收藏失败" : "收藏失败"));
    } finally {
      if (requestId === favoriteRequestIdRef.current) {
        setFavoriteLoading(false);
      }
    }
  }, [clearQuestionWorkspace, favorite, handleAuthRequired, question, setError]);

  const editFavoriteTags = useCallback(async () => {
    if (!question) {
      return;
    }

    const input = prompt("输入标签（用逗号分隔）", favorite?.tags?.join(",") ?? "");
    if (input === null) {
      return;
    }

    const tags = input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const requestId = favoriteRequestIdRef.current + 1;
    const questionId = question.id;
    favoriteRequestIdRef.current = requestId;
    setFavoriteLoading(true);

    try {
      const payload = await requestJson<FavoriteResponse>(`/api/favorites/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags })
      });

      if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
        return;
      }

      setFavorite(payload.data ? { tags: payload.data.tags ?? [] } : null);
    } catch (nextError) {
      if (requestId !== favoriteRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }

      if (isPracticeQuestionMissingError(nextError)) {
        clearQuestionWorkspace();
      }
      setError(getPracticeFavoriteRequestMessage(nextError, "更新收藏标签失败"));
    } finally {
      if (requestId === favoriteRequestIdRef.current) {
        setFavoriteLoading(false);
      }
    }
  }, [clearQuestionWorkspace, favorite?.tags, handleAuthRequired, question, setError]);

  const loadVariants = useCallback(async () => {
    if (!question) {
      return;
    }

    const requestId = variantRequestIdRef.current + 1;
    const questionId = question.id;
    variantRequestIdRef.current = requestId;
    setLoadingVariants(true);

    try {
      const payload = await requestJson<VariantResponse>("/api/practice/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, studentAnswer: answer })
      });

      if (requestId !== variantRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
        return;
      }

      setVariantPack({
        analysis: payload.data?.explanation?.analysis ?? "",
        hints: payload.data?.explanation?.hints ?? [],
        variants: payload.data?.variants ?? []
      });
      setVariantAnswers({});
      setVariantResults({});
    } catch (nextError) {
      if (requestId !== variantRequestIdRef.current || activeQuestionIdRef.current !== questionId) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }

      if (isPracticeQuestionMissingError(nextError)) {
        clearQuestionWorkspace();
      }
      setError(getPracticeVariantRequestMessage(nextError, "变式生成失败，请稍后重试"));
    } finally {
      if (requestId === variantRequestIdRef.current) {
        setLoadingVariants(false);
      }
    }
  }, [answer, clearQuestionWorkspace, handleAuthRequired, question, setError]);

  useEffect(() => {
    const nextQuestionId = question?.id ?? null;
    activeQuestionIdRef.current = nextQuestionId;
    resetQuestionSupport();
  }, [question?.id, resetQuestionSupport, resetSignal]);

  const questionId = question?.id;

  useEffect(() => {
    if (!questionId) {
      return;
    }
    void loadFavorite(questionId);
  }, [loadFavorite, questionId]);

  useEffect(() => {
    if (!questionId || !resultAnswer) {
      return;
    }
    void loadExplainPack(questionId);
  }, [loadExplainPack, questionId, resultAnswer]);

  return {
    variantPack,
    variantAnswers,
    setVariantAnswers,
    variantResults,
    setVariantResults,
    loadingVariants,
    favorite,
    favoriteLoading,
    explainMode,
    setExplainMode,
    explainPack,
    explainLoading,
    resetQuestionSupport,
    toggleFavorite,
    editFavoriteTags,
    loadVariants
  };
}
