"use client";

import { useCallback, useState } from "react";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import type { CoachResponse } from "./types";
import { getCoachHintCount } from "./utils";

type CoachPayload = {
  data?: CoachResponse | null;
};

export function useCoachPage() {
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [data, setData] = useState<CoachResponse | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const requestCoach = useCallback(
    async (options?: { revealAnswer?: boolean }) => {
      if (!question.trim()) {
        return;
      }

      setLoading(true);
      setError(null);
      setAuthRequired(false);

      try {
        const payload = await requestJson<CoachPayload>("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            subject,
            grade,
            studentAnswer: studentAnswer.trim() || undefined,
            revealAnswer: options?.revealAnswer
          })
        });
        const nextData = payload.data ?? null;
        setData(nextData);
        setHintIndex(
          getCoachHintCount({
            response: nextData,
            revealAnswer: options?.revealAnswer,
            studentAnswer
          })
        );
      } catch (nextError) {
        if (isAuthError(nextError)) {
          setAuthRequired(true);
          setData(null);
        } else {
          setData(null);
          setError(
            getRequestErrorMessage(
              nextError,
              "学习模式暂不可用，请稍后重试"
            )
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [grade, question, studentAnswer, subject]
  );

  const startCoach = useCallback(async () => {
    await requestCoach();
  }, [requestCoach]);

  const submitThinking = useCallback(async () => {
    if (!studentAnswer.trim()) {
      return;
    }
    await requestCoach();
  }, [requestCoach, studentAnswer]);

  const revealAnswer = useCallback(async () => {
    await requestCoach({ revealAnswer: true });
  }, [requestCoach]);

  const showNextHint = useCallback(() => {
    setHintIndex((prev) => Math.min(prev + 1, data?.hints.length ?? 0));
  }, [data?.hints.length]);

  return {
    question,
    subject,
    grade,
    studentAnswer,
    data,
    hintIndex,
    loading,
    error,
    authRequired,
    hasQuestion: Boolean(question.trim()),
    hasStudentAnswer: Boolean(studentAnswer.trim()),
    setQuestion,
    setSubject,
    setGrade,
    setStudentAnswer,
    startCoach,
    submitThinking,
    revealAnswer,
    showNextHint
  };
}
