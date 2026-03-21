"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import type { DiagnosticQuestion, DiagnosticResult, DiagnosticStartResponse } from "./types";
import { getDiagnosticStartRequestMessage, getDiagnosticSubmitRequestMessage } from "./utils";

export function useDiagnosticPage() {
  const startRequestIdRef = useRef(0);
  const submitRequestIdRef = useRef(0);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const clearDiagnosticState = useCallback(() => {
    setQuestions([]);
    setIndex(0);
    setAnswers({});
    setReasons({});
    setResult(null);
    setPageError(null);
    setLoadingQuestions(false);
    setSubmitting(false);
  }, []);

  const handleAuthRequired = useCallback(() => {
    startRequestIdRef.current += 1;
    submitRequestIdRef.current += 1;
    clearDiagnosticState();
    setAuthRequired(true);
  }, [clearDiagnosticState]);

  const startDiagnostic = useCallback(async () => {
    const requestId = startRequestIdRef.current + 1;
    startRequestIdRef.current = requestId;
    setLoadingQuestions(true);
    setPageError(null);
    setQuestions([]);
    setIndex(0);
    setAnswers({});
    setReasons({});
    setResult(null);

    try {
      const payload = await requestJson<DiagnosticStartResponse>("/api/diagnostic/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, grade })
      });
      if (requestId !== startRequestIdRef.current) {
        return;
      }
      const nextQuestions = payload.questions ?? [];
      setQuestions(nextQuestions);
      setAuthRequired(false);
      if (!nextQuestions.length) {
        setPageError("当前暂无可用的诊断题目，请稍后重试。");
      }
    } catch (error) {
      if (requestId !== startRequestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setPageError(getDiagnosticStartRequestMessage(error, "开始诊断失败"));
      }
    } finally {
      if (requestId === startRequestIdRef.current) {
        setLoadingQuestions(false);
      }
    }
  }, [grade, handleAuthRequired, subject]);

  const submitDiagnostic = useCallback(async () => {
    const requestId = submitRequestIdRef.current + 1;
    submitRequestIdRef.current = requestId;
    setSubmitting(true);
    setPageError(null);
    const payload = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
      reason: reasons[questionId]
    }));
    try {
      const data = await requestJson<DiagnosticResult>("/api/diagnostic/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, grade, answers: payload })
      });
      if (requestId !== submitRequestIdRef.current) {
        return;
      }
      setResult({
        total: data.total,
        correct: data.correct,
        accuracy: data.accuracy,
        breakdown: data.breakdown,
        wrongReasons: data.wrongReasons
      });
      setAuthRequired(false);
    } catch (error) {
      if (requestId !== submitRequestIdRef.current) {
        return;
      }
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setPageError(getDiagnosticSubmitRequestMessage(error, "提交诊断失败"));
      }
    } finally {
      if (requestId === submitRequestIdRef.current) {
        setSubmitting(false);
      }
    }
  }, [answers, grade, handleAuthRequired, reasons, subject]);

  const exportImage = useCallback(async () => {
    if (!reportRef.current) return;
    setPageError(null);
    try {
      const dataUrl = await toPng(reportRef.current, { backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = "diagnostic-report.png";
      link.href = dataUrl;
      link.click();
    } catch (error) {
      setPageError(getRequestErrorMessage(error, "导出图片失败"));
    }
  }, []);

  return {
    subject,
    grade,
    questions,
    index,
    answers,
    reasons,
    result,
    loadingQuestions,
    submitting,
    pageError,
    authRequired,
    reportRef,
    setSubject,
    setGrade,
    setIndex,
    setAnswers,
    setReasons,
    startDiagnostic,
    submitDiagnostic,
    exportImage
  };
}
