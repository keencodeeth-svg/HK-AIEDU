"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import MathViewControls from "@/components/MathViewControls";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";
import ExamAnswerSheetCard from "./_components/ExamAnswerSheetCard";
import ExamOverviewCard from "./_components/ExamOverviewCard";
import ExamResultCard from "./_components/ExamResultCard";
import ExamReviewPackCard from "./_components/ExamReviewPackCard";
import type { ExamDetail, LocalDraft, ReviewPack, ReviewPackSummary, SubmitResult } from "./types";
import { formatRemain, LOCAL_DRAFT_PREFIX } from "./utils";

async function readJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function StudentExamDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [clientStartedAt, setClientStartedAt] = useState<string | null>(null);
  const [pendingLocalSync, setPendingLocalSync] = useState(false);
  const [reviewPack, setReviewPack] = useState<ReviewPack | null>(null);
  const [reviewPackLoading, setReviewPackLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [timeupTriggered, setTimeupTriggered] = useState(false);
  const mathView = useMathViewSettings("student-exam");
  const examEventRef = useRef({ blurCountDelta: 0, visibilityHiddenCountDelta: 0 });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const localDraftKey = `${LOCAL_DRAFT_PREFIX}${params.id}`;

  const submitted = useMemo(
    () => (data?.assignment.status ?? "pending") === "submitted" || Boolean(data?.submission),
    [data]
  );

  const flushExamEvents = useCallback(async () => {
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") return;
    const blurCountDelta = examEventRef.current.blurCountDelta;
    const visibilityHiddenCountDelta = examEventRef.current.visibilityHiddenCountDelta;
    if (blurCountDelta <= 0 && visibilityHiddenCountDelta <= 0) return;

    examEventRef.current = { blurCountDelta: 0, visibilityHiddenCountDelta: 0 };
    try {
      await fetch(`/api/student/exams/${params.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blurCountDelta, visibilityHiddenCountDelta }),
        keepalive: true
      });
    } catch {
      examEventRef.current.blurCountDelta += blurCountDelta;
      examEventRef.current.visibilityHiddenCountDelta += visibilityHiddenCountDelta;
    }
  }, [data, params.id, submitted]);

  const queueExamEvent = useCallback(
    (type: "blur" | "hidden") => {
      if (!data || submitted || data.exam.antiCheatLevel !== "basic") return;
      if (type === "blur") {
        examEventRef.current.blurCountDelta += 1;
      } else {
        examEventRef.current.visibilityHiddenCountDelta += 1;
      }
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void flushExamEvents();
      }, 800);
    },
    [data, flushExamEvents, submitted]
  );

  const readLocalDraft = useCallback((): LocalDraft | null => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(localDraftKey);
    if (!raw) return null;
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
      if (typeof window === "undefined") return;
      window.localStorage.setItem(localDraftKey, JSON.stringify(draft));
    },
    [localDraftKey]
  );

  const clearLocalDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(localDraftKey);
  }, [localDraftKey]);

  const loadReviewPack = useCallback(async () => {
    setReviewPackLoading(true);
    try {
      const res = await fetch(`/api/student/exams/${params.id}/review-pack`);
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(payload?.error ?? "复盘包加载失败");
      }
      setReviewPack(payload?.data ?? null);
    } catch (error) {
      setReviewPack(null);
      setActionError(error instanceof Error ? error.message : "复盘包加载失败");
    } finally {
      setReviewPackLoading(false);
    }
  }, [params.id]);

  const startedAt = data?.assignment.startedAt ?? clientStartedAt ?? null;

  const deadlineMs = useMemo(() => {
    if (!data || submitted) return null;
    const endDeadline = new Date(data.exam.endAt).getTime();
    if (data.exam.durationMinutes && startedAt) {
      const durationDeadline = new Date(startedAt).getTime() + data.exam.durationMinutes * 60 * 1000;
      return Math.min(endDeadline, durationDeadline);
    }
    return endDeadline;
  }, [data, startedAt, submitted]);

  const remainingSeconds = useMemo(() => {
    if (deadlineMs === null || submitted) return null;
    return Math.max(0, Math.ceil((deadlineMs - clock) / 1000));
  }, [clock, deadlineMs, submitted]);

  const lockedByTime = !submitted && remainingSeconds !== null && remainingSeconds <= 0;
  const lockedByStatus = !submitted && data?.exam.status === "closed";
  const lockedByAccess = !submitted && !data?.access?.canSubmit;
  const lockedByServer = lockedByStatus || lockedByAccess;
  const lockReason = data?.access?.lockReason ?? (lockedByStatus ? "考试已关闭" : null);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    if (deadlineMs === null || submitted) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlineMs, submitted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submitted) return;
      if (!dirty && !pendingLocalSync) return;
      void flushExamEvents();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, flushExamEvents, pendingLocalSync, submitted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!data || submitted || data.exam.antiCheatLevel !== "basic") return;

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
    setLoadError(null);
    setActionError(null);
    setActionMessage(null);
    setSyncNotice(null);

    try {
      const res = await fetch(`/api/student/exams/${params.id}`);
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(payload?.error ?? "加载失败");
      }

      setData(payload);
      const initialAnswers = payload?.submission?.answers ?? payload?.draftAnswers ?? {};
      let mergedAnswers = initialAnswers;

      const localDraft = readLocalDraft();
      if (!payload?.submission && localDraft?.answers) {
        mergedAnswers = { ...initialAnswers, ...localDraft.answers };
        if (Object.keys(localDraft.answers).length > 0) {
          setSyncNotice("检测到断网暂存作答，已恢复到当前页面。恢复网络后会自动同步。");
          setPendingLocalSync(true);
          setDirty(true);
        }
        if (localDraft.clientStartedAt && !payload?.assignment?.startedAt) {
          setClientStartedAt(localDraft.clientStartedAt);
        }
      } else {
        setPendingLocalSync(false);
        setDirty(false);
        clearLocalDraft();
      }

      setAnswers(mergedAnswers);
      setSavedAt(payload?.assignment?.autoSavedAt ?? null);
      setResult(null);
      setTimeupTriggered(false);
      if (payload?.submission || payload?.reviewPackSummary) {
        void loadReviewPack();
      } else {
        setReviewPack(null);
      }
      if (payload?.assignment?.startedAt) {
        setClientStartedAt(payload.assignment.startedAt);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "加载失败");
    }
  }, [clearLocalDraft, loadReviewPack, params.id, readLocalDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = useCallback(
    async (mode: "auto" | "manual" | "sync" = "auto") => {
      if (!data || submitted || saving || lockedByTime || lockedByServer) return;

      setSaving(true);
      if (mode !== "auto") {
        setActionError(null);
        setActionMessage(null);
      }

      try {
        const res = await fetch(`/api/student/exams/${params.id}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers })
        });
        const payload = await readJsonSafe(res);
        if (!res.ok) {
          setActionError(payload?.error ?? "自动保存失败");
          return;
        }

        setSavedAt(payload.savedAt ?? new Date().toISOString());
        setDirty(false);
        setPendingLocalSync(false);
        clearLocalDraft();
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
          if (!previous) return previous;
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
      } catch {
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
      lockedByServer,
      lockedByTime,
      online,
      params.id,
      saving,
      submitted,
      writeLocalDraft
    ]
  );

  useEffect(() => {
    if (!dirty || submitted || lockedByTime || lockedByServer) return;
    const timer = setTimeout(() => {
      void saveDraft("auto");
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, lockedByServer, lockedByTime, saveDraft, submitted]);

  useEffect(() => {
    if (!online || !pendingLocalSync || submitted || saving || lockedByTime || lockedByServer) return;
    void saveDraft("sync");
  }, [lockedByServer, lockedByTime, online, pendingLocalSync, saveDraft, saving, submitted]);

  const submitExam = useCallback(
    async (trigger: "manual" | "timeout") => {
      if (!data || submitted || submitting || lockedByServer) return;

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
        const res = await fetch(`/api/student/exams/${params.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers })
        });
        const payload = await readJsonSafe(res);
        if (!res.ok) {
          setActionError(payload?.error ?? "提交失败");
          return;
        }

        setResult(payload);
        setSavedAt(payload.submittedAt ?? new Date().toISOString());
        setDirty(false);
        setPendingLocalSync(false);
        clearLocalDraft();

        const reviewNotice =
          typeof payload.queuedReviewCount === "number" && payload.queuedReviewCount > 0
            ? `本次考试错题已加入今日复练清单（${payload.queuedReviewCount} 题）。`
            : "";
        const reviewPackNotice = payload?.reviewPackSummary?.estimatedMinutes
          ? `系统已生成考试复盘包，预计 ${payload.reviewPackSummary.estimatedMinutes} 分钟完成。`
          : "";
        const syncText = [reviewNotice, reviewPackNotice].filter(Boolean).join(" ");
        setSyncNotice(syncText || null);
        setActionMessage(
          trigger === "timeout"
            ? "考试时间结束，系统已自动提交，并定位到下方结果区。"
            : payload?.alreadySubmitted
              ? "本场考试已提交，已恢复结果与复盘入口。"
              : "提交成功，已为你定位到下方结果与复盘区。"
        );
        await loadReviewPack();

        setData((previous) => {
          if (!previous) return previous;
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
      } catch {
        setActionError("提交失败，请稍后重试。");
      } finally {
        setSubmitting(false);
      }
    },
    [
      answers,
      clearLocalDraft,
      clientStartedAt,
      data,
      flushExamEvents,
      loadReviewPack,
      lockedByServer,
      online,
      params.id,
      submitted,
      submitting,
      writeLocalDraft
    ]
  );

  useEffect(() => {
    if (submitted || submitting || lockedByTime === false) return;
    if (!startedAt) return;
    if (data?.access && !data.access.canSubmit) return;
    if (timeupTriggered) return;
    setTimeupTriggered(true);
    void submitExam("timeout");
  }, [data?.access, lockedByTime, startedAt, submitExam, submitted, submitting, timeupTriggered]);

  useEffect(() => {
    if (result) {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitExam("manual");
  }

  function handleAnswerChange(questionId: string, value: string) {
    if (!startedAt) {
      setClientStartedAt(new Date().toISOString());
    }
    setActionError(null);
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
    setDirty(true);
  }

  if (loadError && !data) {
    return (
      <StatePanel
        tone="error"
        title="考试详情暂时不可用"
        description={loadError}
        action={
          <div className="cta-row">
            <button className="button secondary" type="button" onClick={() => void load()}>
              重新加载
            </button>
            <Link className="button ghost" href="/student/exams">
              返回考试列表
            </Link>
          </div>
        }
      />
    );
  }

  if (!data) {
    return (
      <StatePanel
        tone="loading"
        title="考试详情加载中"
        description="正在同步题目、作答进度和考试时钟。"
      />
    );
  }

  const totalScore = data.questions.reduce((sum, item) => sum + (item.score ?? 1), 0);
  const finalScore = result?.score ?? data.submission?.score ?? data.assignment.score ?? 0;
  const finalTotal = result?.total ?? data.submission?.total ?? data.assignment.total ?? totalScore;
  const answeredQuestionIds = data.questions.filter((item) => Boolean(answers[item.id]?.trim())).map((item) => item.id);
  const answerCount = answeredQuestionIds.length;
  const unansweredQuestionIds = data.questions.filter((item) => !answers[item.id]?.trim()).map((item) => item.id);
  const unansweredCount = unansweredQuestionIds.length;
  const firstUnansweredQuestionId = unansweredQuestionIds[0] ?? null;
  const effectiveWrongCount = result?.wrongCount ?? data.reviewPackSummary?.wrongCount ?? 0;
  const stageLabel = submitted
    ? "已提交"
    : data.access.stage === "upcoming"
      ? "待开始"
      : data.access.stage === "open"
        ? "考试进行中"
        : "不可作答";
  const reviewPackSummary: ReviewPackSummary | null = result?.reviewPackSummary ?? data.reviewPackSummary ?? null;
  const feedbackTargetId = reviewPack || reviewPackSummary ? "exam-review-pack" : result ? "exam-result" : null;
  const hasFeedback = Boolean(result || reviewPack || reviewPackSummary);

  const stageCopy = (() => {
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

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>{data.exam.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">{stageLabel}</span>
      </div>

      <MathViewControls
        fontScale={mathView.fontScale}
        lineMode={mathView.lineMode}
        onDecrease={mathView.decreaseFontScale}
        onIncrease={mathView.increaseFontScale}
        onReset={mathView.resetView}
        onLineModeChange={mathView.setLineMode}
      />

      <div id="exam-overview">
        <ExamOverviewCard
          data={data}
          submitted={submitted}
          online={online}
          answerCount={answerCount}
          unansweredCount={unansweredCount}
          totalScore={totalScore}
          remainingSeconds={remainingSeconds}
          startedAt={startedAt}
          saving={saving}
          savedAt={savedAt}
          syncNotice={syncNotice}
          actionMessage={actionMessage}
          actionError={actionError}
          lockReason={lockReason}
          finalScore={finalScore}
          finalTotal={finalTotal}
          submitting={submitting}
          lockedByTime={lockedByTime}
          lockedByServer={lockedByServer}
          stageTitle={stageCopy.title}
          stageDescription={stageCopy.description}
          firstUnansweredQuestionId={firstUnansweredQuestionId}
          feedbackTargetId={feedbackTargetId}
          onSaveDraft={() => void saveDraft("manual")}
        />
      </div>

      <div id="exam-answer-sheet">
        <ExamAnswerSheetCard
          data={data}
          answers={answers}
          answerCount={answerCount}
          unansweredCount={unansweredCount}
          firstUnansweredQuestionId={firstUnansweredQuestionId}
          submitted={submitted}
          lockedByTime={lockedByTime}
          lockedByServer={lockedByServer}
          submitting={submitting}
          online={online}
          lockReason={lockReason}
          finalScore={finalScore}
          finalTotal={finalTotal}
          queuedReviewCount={result?.queuedReviewCount}
          feedbackTargetId={feedbackTargetId}
          onSubmit={handleSubmit}
          onAnswerChange={handleAnswerChange}
        />
      </div>

      {result ? (
        <div id="exam-result" ref={resultSectionRef}>
          <ExamResultCard
            details={result.details ?? []}
            score={result.score}
            total={result.total}
            wrongCount={result.wrongCount}
            queuedReviewCount={result.queuedReviewCount}
            reviewPackSummary={reviewPackSummary}
          />
        </div>
      ) : null}

      {(submitted || Boolean(reviewPack) || Boolean(reviewPackSummary)) ? (
        <div id="exam-review-pack">
          <ExamReviewPackCard
            reviewPackLoading={reviewPackLoading}
            reviewPack={reviewPack}
            reviewPackSummary={reviewPackSummary}
            onLoadReviewPack={() => void loadReviewPack()}
          />
        </div>
      ) : null}
    </div>
  );
}
