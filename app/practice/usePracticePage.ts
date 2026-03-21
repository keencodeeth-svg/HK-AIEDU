"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics-client";
import { isAuthError, requestJson } from "@/lib/client-request";
import { useMathViewSettings } from "@/lib/math-view-settings";
import { STUDENT_PRACTICE_GUIDE_KEY } from "./config";
import type {
  KnowledgePoint,
  KnowledgePointListResponse,
  KnowledgePointGroup,
  PracticeMode,
  PracticeQuestionResponse,
  PracticeRequestStatus,
  PracticeQuickFixAction,
  PracticeResult,
  PracticeSubmitResponse,
  Question,
} from "./types";
import { usePracticeGuide } from "./usePracticeGuide";
import { usePracticeQuestionSupport } from "./usePracticeQuestionSupport";
import {
  getPracticeKnowledgePointsRequestMessage,
  getPracticeNextQuestionRequestMessage,
  getPracticeSubmitRequestMessage,
  isPracticeNoQuestionsError,
  isPracticeQuestionMissingError,
  resolvePracticeKnowledgePointId
} from "./utils";

export function usePracticePage() {
  const searchParams = useSearchParams();
  const trackedPracticePageView = useRef(false);
  const questionCardRef = useRef<HTMLDivElement | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const activeQuestionIdRef = useRef<string | null>(null);
  const knowledgePointsRequestIdRef = useRef(0);
  const questionRequestIdRef = useRef(0);
  const submitRequestIdRef = useRef(0);
  const hasKnowledgePointsSnapshotRef = useRef(false);
  const timeLeftRef = useRef(0);

  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [knowledgePointsError, setKnowledgePointsError] = useState<string | null>(null);
  const [knowledgePointId, setKnowledgePointId] = useState<string | undefined>(undefined);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [mode, setMode] = useState<PracticeMode>("normal");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [questionSupportResetKey, setQuestionSupportResetKey] = useState(0);
  const [challengeCount, setChallengeCount] = useState(0);
  const [challengeCorrect, setChallengeCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixHint, setAutoFixHint] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const mathView = useMathViewSettings("student-practice");
  const { showPracticeGuide, hidePracticeGuide, showPracticeGuideAgain } = usePracticeGuide(STUDENT_PRACTICE_GUIDE_KEY);

  const applyQuestion = useCallback((nextQuestion: Question | null) => {
    activeQuestionIdRef.current = nextQuestion?.id ?? null;
    setQuestion(nextQuestion);
  }, []);

  const clearQuestionArtifacts = useCallback((options?: { preserveTimer?: boolean }) => {
    setAnswer("");
    setResult(null);
    setQuestionSupportResetKey((prev) => prev + 1);
    if (!options?.preserveTimer) {
      setTimeLeft(0);
      setTimerRunning(false);
    }
  }, []);

  const clearQuestionWorkspace = useCallback(
    (options?: { invalidateRequests?: boolean }) => {
      if (options?.invalidateRequests !== false) {
        submitRequestIdRef.current += 1;
      }
      applyQuestion(null);
      clearQuestionArtifacts();
    },
    [applyQuestion, clearQuestionArtifacts]
  );

  const clearKnowledgePointsState = useCallback(() => {
    hasKnowledgePointsSnapshotRef.current = false;
    setKnowledgePoints([]);
    setKnowledgePointsError(null);
  }, []);

  const clearPracticePageState = useCallback(() => {
    clearKnowledgePointsState();
    clearQuestionWorkspace();
    setError(null);
    setAutoFixHint(null);
    setQuestionLoading(false);
    setSubmitting(false);
    setAutoFixing(false);
    setLastLoadedAt(null);
  }, [clearKnowledgePointsState, clearQuestionWorkspace]);

  const handleAuthRequired = useCallback(() => {
    knowledgePointsRequestIdRef.current += 1;
    questionRequestIdRef.current += 1;
    submitRequestIdRef.current += 1;
    clearPracticePageState();
    setAuthRequired(true);
  }, [clearPracticePageState]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const filtered = useMemo(
    () =>
      knowledgePoints
        .filter((kp) => kp.subject === subject && kp.grade === grade)
        .sort((a, b) => {
          const unitA = a.unit ?? "未分单元";
          const unitB = b.unit ?? "未分单元";
          if (unitA !== unitB) {
            return unitA.localeCompare(unitB, "zh-CN");
          }
          const chapterA = a.chapter ?? "未分章节";
          const chapterB = b.chapter ?? "未分章节";
          if (chapterA !== chapterB) {
            return chapterA.localeCompare(chapterB, "zh-CN");
          }
          return a.title.localeCompare(b.title, "zh-CN");
        }),
    [grade, knowledgePoints, subject]
  );

  const loadKnowledgePoints = useCallback(async (): Promise<PracticeRequestStatus> => {
    const requestId = knowledgePointsRequestIdRef.current + 1;
    knowledgePointsRequestIdRef.current = requestId;
    setKnowledgePointsError(null);

    try {
      const payload = await requestJson<KnowledgePointListResponse>("/api/knowledge-points");
      if (knowledgePointsRequestIdRef.current !== requestId) {
        return "stale";
      }

      hasKnowledgePointsSnapshotRef.current = true;
      setAuthRequired(false);
      setKnowledgePoints(payload.data ?? []);
      setLastLoadedAt(new Date().toISOString());
      return "ok";
    } catch (nextError) {
      if (knowledgePointsRequestIdRef.current !== requestId) {
        return "stale";
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return "auth";
      }

      setAuthRequired(false);
      if (!hasKnowledgePointsSnapshotRef.current) {
        setKnowledgePoints([]);
      }
      setKnowledgePointsError(getPracticeKnowledgePointsRequestMessage(nextError, "知识点列表加载失败"));
      return "error";
    }
  }, [handleAuthRequired]);

  useEffect(() => {
    void loadKnowledgePoints();
  }, [loadKnowledgePoints]);

  useEffect(() => {
    if (trackedPracticePageView.current) {
      return;
    }
    trackEvent({
      eventName: "practice_page_view",
      page: "/practice",
      subject,
      grade,
      props: { mode }
    });
    trackedPracticePageView.current = true;
  }, [subject, grade, mode]);

  useEffect(() => {
    const next = searchParams.get("mode");
    if (!next) {
      return;
    }
    if (["normal", "challenge", "timed", "wrong", "adaptive", "review"].includes(next)) {
      setMode(next as PracticeMode);
    }
  }, [searchParams]);

  const requestQuestion = useCallback(
    async (next: {
      subject: string;
      grade: string;
      knowledgePointId?: string;
      mode: PracticeMode;
    }): Promise<PracticeRequestStatus> => {
      const requestId = questionRequestIdRef.current + 1;
      questionRequestIdRef.current = requestId;
      setQuestionLoading(true);
      setError(null);

      try {
        const data = await requestJson<PracticeQuestionResponse>("/api/practice/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next)
        });

        if (questionRequestIdRef.current !== requestId) {
          return "stale";
        }

        const shouldPreserveTimedCountdown = next.mode === "timed" && timeLeftRef.current > 0;
        setAuthRequired(false);
        clearQuestionArtifacts({ preserveTimer: shouldPreserveTimedCountdown });
        applyQuestion(data.question ?? null);
        if (next.mode === "timed" && !shouldPreserveTimedCountdown) {
          setTimeLeft(60);
          setTimerRunning(true);
        }
        setError(null);
        setLastLoadedAt(new Date().toISOString());
        return "ok";
      } catch (nextError) {
        if (questionRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(nextError)) {
          handleAuthRequired();
          return "auth";
        }

        setAuthRequired(false);
        if (isPracticeNoQuestionsError(nextError)) {
          clearQuestionWorkspace();
        }
        setError(getPracticeNextQuestionRequestMessage(nextError, next));
        return "error";
      } finally {
        if (questionRequestIdRef.current === requestId) {
          setQuestionLoading(false);
        }
      }
    },
    [applyQuestion, clearQuestionArtifacts, clearQuestionWorkspace, handleAuthRequired]
  );

  const loadQuestion = useCallback(async () => {
    if (questionLoading || submitting || autoFixing) {
      return;
    }

    const nextKnowledgePointId = resolvePracticeKnowledgePointId(filtered, knowledgePointId);
    if (nextKnowledgePointId !== knowledgePointId) {
      setKnowledgePointId(nextKnowledgePointId);
    }
    setAutoFixHint(null);

    await requestQuestion({
      subject,
      grade,
      knowledgePointId: nextKnowledgePointId,
      mode
    });
  }, [autoFixing, filtered, grade, knowledgePointId, mode, questionLoading, requestQuestion, subject, submitting]);

  const applyPracticeQuickFix = useCallback(
    async (action: PracticeQuickFixAction) => {
      if (autoFixing || questionLoading || submitting) {
        return;
      }

      const next = {
        subject,
        grade,
        knowledgePointId: resolvePracticeKnowledgePointId(filtered, knowledgePointId),
        mode
      };
      let hint = "";

      if (action === "clear_filters") {
        next.knowledgePointId = undefined;
        setKnowledgePointId(undefined);
        setKnowledgeSearch("");
        hint = "已清空知识点筛选，正在重新获取题目。";
      } else if (action === "switch_normal") {
        next.mode = "normal";
        setMode("normal");
        hint = "已切换到普通练习模式，正在重新获取题目。";
      } else if (action === "switch_adaptive") {
        next.mode = "adaptive";
        setMode("adaptive");
        hint = "已切换到自适应推荐模式，正在重新获取题目。";
      }

      setAutoFixHint(hint);
      setAutoFixing(true);
      try {
        await requestQuestion(next);
      } finally {
        setAutoFixing(false);
      }
    },
    [autoFixing, filtered, grade, knowledgePointId, mode, questionLoading, requestQuestion, subject, submitting]
  );

  const submitAnswer = useCallback(async () => {
    if (!question || !answer || submitting || questionLoading) {
      return;
    }

    const requestId = submitRequestIdRef.current + 1;
    const questionId = question.id;
    const startedAt = Date.now();
    submitRequestIdRef.current = requestId;
    setSubmitting(true);

    try {
      const data = await requestJson<PracticeSubmitResponse>("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer })
      });

      if (submitRequestIdRef.current !== requestId || activeQuestionIdRef.current !== questionId) {
        return;
      }

      setAuthRequired(false);
      setError(null);
      setResult({
        correct: data.correct,
        explanation: data.explanation,
        answer: data.answer,
        masteryScore: data.masteryScore,
        masteryDelta: data.masteryDelta,
        confidenceScore: data?.mastery?.confidenceScore,
        recencyWeight: data?.mastery?.recencyWeight,
        masteryTrend7d: data?.mastery?.masteryTrend7d,
        weaknessRank: data?.weaknessRank ?? data?.mastery?.weaknessRank ?? null
      });
      trackEvent({
        eventName: "practice_submit_success",
        page: "/practice",
        subject,
        grade,
        entityId: questionId,
        props: {
          mode,
          correct: Boolean(data.correct),
          durationMs: Date.now() - startedAt
        }
      });

      if (mode === "challenge") {
        setChallengeCount((prev) => prev + 1);
        setChallengeCorrect((prev) => prev + (data.correct ? 1 : 0));
      }
    } catch (nextError) {
      if (submitRequestIdRef.current !== requestId || activeQuestionIdRef.current !== questionId) {
        return;
      }

      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }

      const errorMessage = getPracticeSubmitRequestMessage(nextError, "提交失败");
      if (isPracticeQuestionMissingError(nextError)) {
        clearQuestionWorkspace();
      }
      setError(errorMessage);
      trackEvent({
        eventName: "practice_submit_fail",
        page: "/practice",
        subject,
        grade,
        entityId: questionId,
        props: {
          mode,
          error: errorMessage,
          durationMs: Date.now() - startedAt
        }
      });
    } finally {
      if (submitRequestIdRef.current === requestId) {
        setSubmitting(false);
      }
    }
  }, [answer, clearQuestionWorkspace, grade, handleAuthRequired, mode, question, questionLoading, subject, submitting]);

  const questionSupport = usePracticeQuestionSupport({
    question,
    answer,
    resultAnswer: result?.answer,
    resetSignal: questionSupportResetKey,
    clearQuestionWorkspace,
    handleAuthRequired,
    setError
  });

  const filteredKnowledgePoints = useMemo(() => {
    const keyword = knowledgeSearch.trim().toLowerCase();
    if (!keyword) {
      return filtered;
    }
    return filtered.filter((kp) => {
      const title = kp.title.toLowerCase();
      const chapter = (kp.chapter ?? "").toLowerCase();
      const unit = (kp.unit ?? "").toLowerCase();
      return title.includes(keyword) || chapter.includes(keyword) || unit.includes(keyword);
    });
  }, [filtered, knowledgeSearch]);

  const groupedKnowledgePoints = useMemo(() => {
    const groupMap = new Map<string, KnowledgePointGroup>();
    filteredKnowledgePoints.forEach((kp) => {
      const unit = kp.unit ?? "未分单元";
      const chapter = kp.chapter ?? "未分章节";
      const key = `${unit}__${chapter}`;
      const current = groupMap.get(key) ?? { unit, chapter, items: [] };
      current.items.push(kp);
      groupMap.set(key, current);
    });
    return Array.from(groupMap.values());
  }, [filteredKnowledgePoints]);

  useEffect(() => {
    const nextKnowledgePointId = resolvePracticeKnowledgePointId(filtered, knowledgePointId);
    if (nextKnowledgePointId !== knowledgePointId) {
      setKnowledgePointId(nextKnowledgePointId);
    }
  }, [filtered, knowledgePointId]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    if (!question?.id || questionLoading) {
      return;
    }
    questionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [question?.id, questionLoading]);

  useEffect(() => {
    if (!result) {
      return;
    }
    resultCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const resetChallenge = useCallback(() => {
    setChallengeCount(0);
    setChallengeCorrect(0);
  }, []);

  const selectedKnowledgeTitle = useMemo(() => {
    if (!knowledgePointId) {
      return "全部知识点";
    }
    const current = filtered.find((kp) => kp.id === knowledgePointId);
    return current?.title ?? "全部知识点";
  }, [filtered, knowledgePointId]);

  const canSubmitCurrentQuestion = Boolean(question && answer && !result && !(mode === "timed" && timeLeft === 0));

  const stageTitle = result
    ? result.correct
      ? "这题已经吃透，继续下一题最省时间"
      : "先把这题吸收掉，再继续往前推"
    : questionLoading
      ? "正在按你的设置准备题目"
      : question
        ? "题目已准备好，选答案后就能提交"
        : "先选模式与知识点，再开始练习";

  const stageDescription = result
    ? result.correct
      ? "建议保持答题节奏，继续下一题；如果想更稳，也可以做一组变式巩固。"
      : "建议先看 AI 讲解，再做变式训练；错题不要急着跳过，吸收后进步更快。"
    : questionLoading
      ? "系统会根据当前模式、学科、年级和知识点重新生成更合适的题目。"
      : question
        ? "这一步只需要完成一次选择并提交，系统会自动给出解析和掌握度变化。"
        : "最顺手的练习节奏是：选模式 → 获取题目 → 提交答案 → 看解析 → 做变式训练。";

  const stageBusy = questionLoading || submitting || autoFixing;

  const handleModeChange = useCallback(
    (next: PracticeMode) => {
      questionRequestIdRef.current += 1;
      clearQuestionWorkspace();
      setMode(next);
      setQuestionLoading(false);
      setSubmitting(false);
      setAutoFixing(false);
      setError(null);
      setAutoFixHint(null);
      resetChallenge();
    },
    [clearQuestionWorkspace, resetChallenge]
  );

  return {
    subject,
    setSubject,
    grade,
    setGrade,
    knowledgeSearch,
    setKnowledgeSearch,
    knowledgePointId,
    setKnowledgePointId,
    mode,
    question,
    answer,
    setAnswer,
    result,
    challengeCount,
    challengeCorrect,
    timeLeft,
    authRequired,
    error,
    knowledgePointsError,
    questionLoading,
    submitting,
    autoFixing,
    autoFixHint,
    lastLoadedAt,
    mathView,
    showPracticeGuide,
    hidePracticeGuide,
    showPracticeGuideAgain,
    groupedKnowledgePoints,
    filteredKnowledgePointsCount: filteredKnowledgePoints.length,
    filteredCount: filtered.length,
    selectedKnowledgeTitle,
    canSubmitCurrentQuestion,
    stageTitle,
    stageDescription,
    stageBusy,
    questionCardRef,
    resultCardRef,
    handleModeChange,
    reloadKnowledgePoints: loadKnowledgePoints,
    loadQuestion,
    applyPracticeQuickFix,
    submitAnswer,
    ...questionSupport,
    resetChallenge
  };
}
