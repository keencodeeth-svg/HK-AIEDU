import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRequestStatus,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { useMathViewSettings } from "@/lib/math-view-settings";
import type { ExamDetail, LocalDraft, ReviewPack, ReviewPackSummary, SubmitResult } from "./types";
import {
  formatRemain,
  getStudentExamDetailRequestMessage,
  getStudentExamReviewPackRequestMessage,
  isMissingStudentExamDetailError,
  LOCAL_DRAFT_PREFIX
} from "./utils";

type ExamEventResponse = {
  data?: {
    blurCount?: number;
    visibilityHiddenCount?: number;
  } | null;
};

type ExamReviewPackResponse = {
  data?: ReviewPack | null;
};

type ExamAutosaveResponse = {
  savedAt?: string | null;
  status?: ExamDetail["assignment"]["status"];
  startedAt?: string | null;
};

type ExamSubmitResponse = SubmitResult & {
  alreadySubmitted?: boolean;
};

export function useStudentExamDetailPage(examId: string) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [clientStartedAt, setClientStartedAt] = useState<string | null>(null);
  const [pendingLocalSync, setPendingLocalSync] = useState(false);
  const [reviewPack, setReviewPack] = useState<ReviewPack | null>(null);
  const [reviewPackLoading, setReviewPackLoading] = useState(false);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [timeupTriggered, setTimeupTriggered] = useState(false);
  const mathView = useMathViewSettings("student-exam");
  const examEventRef = useRef({ blurCountDelta: 0, visibilityHiddenCountDelta: 0 });
  const hasReviewPackSnapshotRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const localDraftKey = `${LOCAL_DRAFT_PREFIX}${examId}`;

  const submitted = useMemo(
    () => (data?.assignment.status ?? "pending") === "submitted" || Boolean(data?.submission),
    [data]
  );

  const readLocalDraft = useCallback((): LocalDraft | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(localDraftKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as LocalDraft;
      if (!parsed || typeof parsed !== "object" || !parsed.answers || typeof parsed.answers !== "object") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [localDraftKey]);

  const writeLocalDraft = useCallback(
    (draft: LocalDraft) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(localDraftKey, JSON.stringify(draft));
    },
    [localDraftKey]
  );

  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(localDraftKey);
  }, [localDraftKey]);

  const clearExamState = useCallback(() => {
    hasReviewPackSnapshotRef.current = false;
    examEventRef.current = { blurCountDelta: 0, visibilityHiddenCountDelta: 0 };
    clearLocalDraft();
    setData(null);
    setAnswers({});
    setDirty(false);
    setSavedAt(null);
    setResult(null);
    setLoadError(null);
    setActionError(null);
    setActionMessage(null);
    setSyncNotice(null);
    setClientStartedAt(null);
    setPendingLocalSync(false);
    setReviewPack(null);
    setReviewPackError(null);
    setTimeupTriggered(false);
  }, [clearLocalDraft]);

  const handleAuthRequired = useCallback(() => {
    clearExamState();
    setAuthRequired(true);
  }, [clearExamState]);

  const flushExamEvents = useCallback(async () => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
      return;
    }

    const blurCountDelta = examEventRef.current.blurCountDelta;
    const visibilityHiddenCountDelta = examEventRef.current.visibilityHiddenCountDelta;
    if (blurCountDelta <= 0 && visibilityHiddenCountDelta <= 0) {
      return;
    }

    examEventRef.current = { blurCountDelta: 0, visibilityHiddenCountDelta: 0 };
    try {
      await requestJson<ExamEventResponse>(`/api/student/exams/${examId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blurCountDelta, visibilityHiddenCountDelta }),
        keepalive: true
      });
      setAuthRequired(false);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      if (isMissingStudentExamDetailError(error)) {
        clearExamState();
        setAuthRequired(false);
        setLoadError(getStudentExamDetailRequestMessage(error, "加载考试详情失败"));
        return;
      }

      examEventRef.current.blurCountDelta += blurCountDelta;
      examEventRef.current.visibilityHiddenCountDelta += visibilityHiddenCountDelta;
    }
  }, [clearExamState, data, examId, handleAuthRequired, submitted]);

  const queueExamEvent = useCallback(
    (type: "blur" | "hidden") => {
      if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
        return;
      }

      if (type === "blur") {
        examEventRef.current.blurCountDelta += 1;
      } else {
        examEventRef.current.visibilityHiddenCountDelta += 1;
      }

      if (flushTimerRef.current) {
        return;
      }

      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void flushExamEvents();
      }, 800);
    },
    [data, flushExamEvents, submitted]
  );

  const loadReviewPack = useCallback(async () => {
    setReviewPackLoading(true);
    setReviewPackError(null);

    try {
      const payload = await requestJson<ExamReviewPackResponse>(
        `/api/student/exams/${examId}/review-pack`
      );
      hasReviewPackSnapshotRef.current = true;
      setReviewPack(payload.data ?? null);
      setAuthRequired(false);
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else if (isMissingStudentExamDetailError(error)) {
        clearExamState();
        setAuthRequired(false);
        setLoadError(getStudentExamDetailRequestMessage(error, "加载考试详情失败"));
      } else {
        if (!hasReviewPackSnapshotRef.current) {
          setReviewPack(null);
        }
        setReviewPackError(getStudentExamReviewPackRequestMessage(error, "复盘包加载失败"));
      }
    } finally {
      setReviewPackLoading(false);
    }
  }, [clearExamState, examId, handleAuthRequired]);

  const startedAt = data?.assignment.startedAt ?? clientStartedAt ?? null;

  const deadlineMs = useMemo(() => {
    if (!data || submitted) {
      return null;
    }

    const endDeadline = new Date(data.exam.endAt).getTime();
    if (data.exam.durationMinutes && startedAt) {
      const durationDeadline = new Date(startedAt).getTime() + data.exam.durationMinutes * 60 * 1000;
      return Math.min(endDeadline, durationDeadline);
    }
    return endDeadline;
  }, [data, startedAt, submitted]);

  const remainingSeconds = useMemo(() => {
    if (deadlineMs === null || submitted) {
      return null;
    }
    return Math.max(0, Math.ceil((deadlineMs - clock) / 1000));
  }, [clock, deadlineMs, submitted]);

  const lockedByTime = !submitted && remainingSeconds !== null && remainingSeconds <= 0;
  const lockedByStatus = !submitted && data?.exam.status === "closed";
  const lockedByAccess = !submitted && !data?.access?.canSubmit;
  const lockedByServer = lockedByStatus || lockedByAccess;
  const lockReason = data?.access?.lockReason ?? (lockedByStatus ? "考试已关闭" : null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateNetwork = () => setOnline(window.navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (deadlineMs === null || submitted) {
      return;
    }
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlineMs, submitted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submitted || (!dirty && !pendingLocalSync)) {
        return;
      }
      void flushExamEvents();
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, flushExamEvents, pendingLocalSync, submitted]);

  useEffect(() => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") {
      return;
    }

    const onBlur = () => queueExamEvent("blur");
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        queueExamEvent("hidden");
      }
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data, queueExamEvent, submitted]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      void flushExamEvents();
    };
  }, [flushExamEvents]);

  const load = useCallback(async () => {
    setPageLoading(true);
    setLoadError(null);
    setActionError(null);
    setActionMessage(null);
    setSyncNotice(null);
    setReviewPackError(null);

    try {
      const payload = await requestJson<ExamDetail>(`/api/student/exams/${examId}`);

      setData(payload);
      setAuthRequired(false);
      const initialAnswers = payload.submission?.answers ?? payload.draftAnswers ?? {};
      let mergedAnswers = initialAnswers;

      const localDraft = readLocalDraft();
      if (!payload.submission && localDraft?.answers) {
        mergedAnswers = { ...initialAnswers, ...localDraft.answers };
        if (Object.keys(localDraft.answers).length > 0) {
          setSyncNotice("检测到断网暂存作答，已恢复到当前页面。恢复网络后会自动同步。");
          setPendingLocalSync(true);
          setDirty(true);
        }
        if (localDraft.clientStartedAt && !payload.assignment?.startedAt) {
          setClientStartedAt(localDraft.clientStartedAt);
        }
      } else {
        setPendingLocalSync(false);
        setDirty(false);
        clearLocalDraft();
      }

      setAnswers(mergedAnswers);
      setSavedAt(payload.assignment?.autoSavedAt ?? null);
      setResult(null);
      setTimeupTriggered(false);
      if (payload.submission || payload.reviewPackSummary) {
        void loadReviewPack();
      } else {
        hasReviewPackSnapshotRef.current = false;
        setReviewPack(null);
        setReviewPackError(null);
      }
      if (payload.assignment?.startedAt) {
        setClientStartedAt(payload.assignment.startedAt);
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
        return;
      }

      clearExamState();
      setAuthRequired(false);
      setLoadError(getStudentExamDetailRequestMessage(error, "加载失败"));
    } finally {
      setPageLoading(false);
    }
  }, [clearExamState, clearLocalDraft, examId, handleAuthRequired, loadReviewPack, readLocalDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = useCallback(
    async (mode: "auto" | "manual" | "sync" = "auto") => {
      if (!data || submitted || saving || lockedByTime || lockedByServer) {
        return;
      }

      setSaving(true);
      if (mode !== "auto") {
        setActionError(null);
        setActionMessage(null);
      }

      try {
        const payload = await requestJson<ExamAutosaveResponse>(
          `/api/student/exams/${examId}/autosave`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers })
          }
        );

        setSavedAt(payload.savedAt ?? new Date().toISOString());
        setDirty(false);
        setPendingLocalSync(false);
        clearLocalDraft();
        setAuthRequired(false);
        if (payload.startedAt) {
          setClientStartedAt(payload.startedAt);
        }
        if (online) {
          setSyncNotice(null);
        }
        if (mode === "manual") {
          setActionMessage("已保存到云端草稿，可继续安心作答。");
        } else if (mode === "sync") {
          setActionMessage("本地暂存答案已成功同步到云端。");
        }
        setData((previous) => {
          if (!previous) {
            return previous;
          }
          return {
            ...previous,
            assignment: {
              ...previous.assignment,
              status: payload.status ?? previous.assignment.status,
              startedAt: payload.startedAt ?? previous.assignment.startedAt,
              autoSavedAt: payload.savedAt ?? previous.assignment.autoSavedAt
            }
          };
        });
      } catch (error) {
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }

        if (isMissingStudentExamDetailError(error)) {
          clearExamState();
          setAuthRequired(false);
          setLoadError(getStudentExamDetailRequestMessage(error, "加载考试详情失败"));
          return;
        }

        if (getRequestStatus(error) !== undefined) {
          setActionError(getStudentExamDetailRequestMessage(error, "自动保存失败"));
          return;
        }

        const nextStartedAt = clientStartedAt ?? new Date().toISOString();
        setClientStartedAt(nextStartedAt);
        writeLocalDraft({
          answers,
          updatedAt: new Date().toISOString(),
          clientStartedAt: nextStartedAt
        });
        setPendingLocalSync(true);
        setSyncNotice("网络异常，答案已本地暂存，恢复网络后会自动同步。");
      } finally {
        setSaving(false);
      }
    },
    [
      answers,
      clearLocalDraft,
      clientStartedAt,
      data,
      examId,
      lockedByServer,
      lockedByTime,
      online,
      saving,
      submitted,
      clearExamState,
      handleAuthRequired,
      writeLocalDraft
    ]
  );

  useEffect(() => {
    if (!dirty || submitted || lockedByTime || lockedByServer) {
      return;
    }
    const timer = setTimeout(() => {
      void saveDraft("auto");
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, lockedByServer, lockedByTime, saveDraft, submitted]);

  useEffect(() => {
    if (!online || !pendingLocalSync || submitted || saving || lockedByTime || lockedByServer) {
      return;
    }
    void saveDraft("sync");
  }, [lockedByServer, lockedByTime, online, pendingLocalSync, saveDraft, saving, submitted]);

  const submitExam = useCallback(
    async (trigger: "manual" | "timeout") => {
      if (!data || submitted || submitting || lockedByServer) {
        return;
      }

      if (!online) {
        const nextStartedAt = clientStartedAt ?? new Date().toISOString();
        setClientStartedAt(nextStartedAt);
        writeLocalDraft({
          answers,
          updatedAt: new Date().toISOString(),
          clientStartedAt: nextStartedAt
        });
        setPendingLocalSync(true);
        setActionError("当前离线，无法提交。答案已本地暂存，请恢复网络后重试。");
        return;
      }

      setSubmitting(true);
      setActionError(null);
      setActionMessage(null);

      try {
        await flushExamEvents();
        const payload = await requestJson<ExamSubmitResponse>(
          `/api/student/exams/${examId}/submit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers })
          }
        );

        setResult(payload);
        setSavedAt(payload.submittedAt ?? new Date().toISOString());
        setDirty(false);
        setPendingLocalSync(false);
        clearLocalDraft();
        setAuthRequired(false);

        const reviewNotice =
          typeof payload.queuedReviewCount === "number" && payload.queuedReviewCount > 0
            ? `本次考试错题已加入今日复练清单（${payload.queuedReviewCount} 题）。`
            : "";
        const reviewPackNotice = payload.reviewPackSummary?.estimatedMinutes
          ? `系统已生成考试复盘包，预计 ${payload.reviewPackSummary.estimatedMinutes} 分钟完成。`
          : "";
        const syncText = [reviewNotice, reviewPackNotice].filter(Boolean).join(" ");
        setSyncNotice(syncText || null);
        setActionMessage(
          trigger === "timeout"
            ? "考试时间结束，系统已自动提交，并定位到下方结果区。"
            : payload.alreadySubmitted
              ? "本场考试已提交，已恢复结果与复盘入口。"
              : "提交成功，已为你定位到下方结果与复盘区。"
        );
        await loadReviewPack();

        setData((previous) => {
          if (!previous) {
            return previous;
          }
          return {
            ...previous,
            assignment: {
              ...previous.assignment,
              status: "submitted",
              submittedAt: payload.submittedAt,
              score: payload.score,
              total: payload.total,
              autoSavedAt: payload.submittedAt ?? previous.assignment.autoSavedAt
            },
            submission: {
              score: payload.score,
              total: payload.total,
              submittedAt: payload.submittedAt,
              answers
            }
          };
        });
      } catch (error) {
        if (isAuthError(error)) {
          handleAuthRequired();
          return;
        }

        if (isMissingStudentExamDetailError(error)) {
          clearExamState();
          setAuthRequired(false);
          setLoadError(getStudentExamDetailRequestMessage(error, "加载考试详情失败"));
          return;
        }

        if (getRequestStatus(error) !== undefined) {
          setActionError(getStudentExamDetailRequestMessage(error, "提交失败"));
          return;
        }

        const nextStartedAt = clientStartedAt ?? new Date().toISOString();
        setClientStartedAt(nextStartedAt);
        writeLocalDraft({
          answers,
          updatedAt: new Date().toISOString(),
          clientStartedAt: nextStartedAt
        });
        setPendingLocalSync(true);
        setActionError("网络异常，当前未提交。答案已本地暂存，请恢复网络后重试。");
      } finally {
        setSubmitting(false);
      }
    },
    [
      answers,
      clearLocalDraft,
      clientStartedAt,
      data,
      examId,
      flushExamEvents,
      loadReviewPack,
      lockedByServer,
      online,
      clearExamState,
      handleAuthRequired,
      submitted,
      submitting,
      writeLocalDraft
    ]
  );

  useEffect(() => {
    if (submitted || submitting || lockedByTime === false) {
      return;
    }
    if (!startedAt || (data?.access && !data.access.canSubmit) || timeupTriggered) {
      return;
    }
    setTimeupTriggered(true);
    void submitExam("timeout");
  }, [data?.access, lockedByTime, startedAt, submitExam, submitted, submitting, timeupTriggered]);

  useEffect(() => {
    if (result) {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitExam("manual");
    },
    [submitExam]
  );

  const handleAnswerChange = useCallback(
    (questionId: string, value: string) => {
      if (!startedAt) {
        setClientStartedAt(new Date().toISOString());
      }
      setActionError(null);
      setAnswers((previous) => ({ ...previous, [questionId]: value }));
      setDirty(true);
    },
    [startedAt]
  );

  const handleSaveDraft = useCallback(() => {
    void saveDraft("manual");
  }, [saveDraft]);

  const totalScore = data?.questions.reduce((sum, item) => sum + (item.score ?? 1), 0) ?? 0;
  const finalScore = result?.score ?? data?.submission?.score ?? data?.assignment.score ?? 0;
  const finalTotal = result?.total ?? data?.submission?.total ?? data?.assignment.total ?? totalScore;
  const answeredQuestionIds = data?.questions.filter((item) => Boolean(answers[item.id]?.trim())).map((item) => item.id) ?? [];
  const answerCount = answeredQuestionIds.length;
  const unansweredQuestionIds = data?.questions.filter((item) => !answers[item.id]?.trim()).map((item) => item.id) ?? [];
  const unansweredCount = unansweredQuestionIds.length;
  const firstUnansweredQuestionId = unansweredQuestionIds[0] ?? null;
  const effectiveWrongCount = result?.wrongCount ?? data?.reviewPackSummary?.wrongCount ?? 0;
  const stageLabel = submitted
    ? "已提交"
    : data?.access.stage === "upcoming"
      ? "待开始"
      : data?.access.stage === "open"
        ? "考试进行中"
        : "不可作答";
  const reviewPackSummary: ReviewPackSummary | null = result?.reviewPackSummary ?? data?.reviewPackSummary ?? null;
  const feedbackTargetId = reviewPack || reviewPackSummary ? "exam-review-pack" : result ? "exam-result" : null;
  const hasReviewPackSection =
    submitted || Boolean(reviewPack) || Boolean(reviewPackSummary) || Boolean(reviewPackError);

  const stageCopy = (() => {
    if (!data) {
      return {
        title: "考试详情加载中",
        description: "正在同步题目、作答进度和考试时钟。"
      };
    }

    if (submitted) {
      return effectiveWrongCount > 0
        ? {
            title: "考试已提交，先看结果再复盘",
            description: "这场考试已经结束，建议先查看下方答题结果，再打开复盘包安排错题修复。"
          }
        : {
            title: "考试已提交，本次表现稳定",
            description: "成绩已经生成，下方保留了结果和复盘入口，可以直接查看本次考试表现。"
          };
    }

    if (data.access.stage === "upcoming") {
      return {
        title: "考试尚未开始",
        description: lockReason ?? "当前还不能作答，开放后即可进入考试。"
      };
    }

    if (lockedByServer) {
      return {
        title: lockReason ?? "当前不可作答",
        description: "本场考试已被系统锁定，当前可以查看题目与已保存记录，但不能继续提交。"
      };
    }

    if (remainingSeconds !== null && remainingSeconds <= 300 && unansweredCount > 0) {
      return {
        title: `剩余 ${formatRemain(remainingSeconds)}，优先补未答题`,
        description: "时间已经不多了，先完成未作答题目，再决定是否检查已答内容。"
      };
    }

    if (!startedAt && data.exam.durationMinutes) {
      return {
        title: "开始作答后正式计时",
        description: "一旦选择答案就会进入正式考试时长，建议先快速浏览题量再开始作答。"
      };
    }

    if (answerCount === 0) {
      return {
        title: "先从第 1 题开始",
        description: "建议先完成会做的题，再回头处理不确定的题目，减少考试焦虑。"
      };
    }

    if (unansweredCount > 0) {
      return {
        title: `还差 ${unansweredCount} 题未答`,
        description: "先用下方题号导航补齐未答题目，避免交卷时出现不必要失分。"
      };
    }

    return {
      title: "全部已作答，可以提交",
      description: "如果没有需要修改的答案，现在提交就能立即看到结果和考试复盘建议。"
    };
  })();

  return {
    data,
    answers,
    result,
    authRequired,
    pageLoading,
    loadError,
    reviewPack,
    reviewPackLoading,
    reviewPackError,
    reviewPackSummary,
    mathView,
    submitted,
    online,
    answerCount,
    unansweredCount,
    totalScore,
    remainingSeconds,
    startedAt,
    saving,
    savedAt,
    syncNotice,
    actionMessage,
    actionError,
    lockReason,
    finalScore,
    finalTotal,
    submitting,
    lockedByTime,
    lockedByServer,
    stageLabel,
    stageCopy,
    firstUnansweredQuestionId,
    feedbackTargetId,
    hasReviewPackSection,
    resultSectionRef,
    load,
    loadReviewPack,
    handleSaveDraft,
    handleSubmit,
    handleAnswerChange
  };
}
