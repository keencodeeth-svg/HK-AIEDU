"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";

type ExamDetail = {
  exam: {
    id: string;
    title: string;
    description?: string;
    publishMode: "teacher_assigned" | "targeted";
    antiCheatLevel: "off" | "basic";
    startAt?: string;
    endAt: string;
    durationMinutes?: number;
    status: "published" | "closed";
  };
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  assignment: {
    status: "pending" | "in_progress" | "submitted";
    startedAt?: string;
    submittedAt?: string;
    score?: number;
    total?: number;
  };
  questions: Array<{
    id: string;
    stem: string;
    options: string[];
    score: number;
    orderIndex: number;
  }>;
  draftAnswers: Record<string, string>;
  submission: {
    score: number;
    total: number;
    submittedAt: string;
    answers: Record<string, string>;
  } | null;
  reviewPackSummary?: {
    wrongCount: number;
    estimatedMinutes: number;
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
  } | null;
};

type SubmitResult = {
  score: number;
  total: number;
  submittedAt: string;
  wrongCount: number;
  queuedReviewCount: number;
  details: Array<{
    questionId: string;
    correct: boolean;
    answer: string;
    correctAnswer: string;
    score: number;
  }>;
  reviewPackSummary?: {
    wrongCount: number;
    estimatedMinutes: number;
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
  } | null;
};

type ReviewPack = {
  wrongCount: number;
  generatedAt: string;
  summary: {
    topWeakKnowledgePoints: Array<{
      knowledgePointId: string;
      title: string;
      wrongCount: number;
    }>;
    wrongByDifficulty: Array<{ difficulty: string; count: number }>;
    wrongByType: Array<{ questionType: string; count: number }>;
    estimatedMinutes: number;
  };
  rootCauses: string[];
  actionItems: Array<{
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
  }>;
  sevenDayPlan: Array<{
    day: number;
    title: string;
    focus: string;
    estimatedMinutes: number;
  }>;
  wrongQuestions?: Array<{
    questionId: string;
    stem: string;
    knowledgePointTitle: string;
    yourAnswer: string;
    correctAnswer: string;
  }>;
};

type LocalDraft = {
  answers: Record<string, string>;
  updatedAt: string;
  clientStartedAt?: string;
};

const LOCAL_DRAFT_PREFIX = "exam-local-draft:";

function formatRemain(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function StudentExamDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [clientStartedAt, setClientStartedAt] = useState<string | null>(null);
  const [pendingLocalSync, setPendingLocalSync] = useState(false);
  const [reviewPack, setReviewPack] = useState<ReviewPack | null>(null);
  const [reviewPackLoading, setReviewPackLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [timeupTriggered, setTimeupTriggered] = useState(false);
  const examEventRef = useRef({ blurCountDelta: 0, visibilityHiddenCountDelta: 0 });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const payload = await res.json();
      if (!res.ok) {
        setReviewPack(null);
        setReviewPackLoading(false);
        return;
      }
      setReviewPack(payload?.data ?? null);
    } catch {
      setReviewPack(null);
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
  }, [data, submitted, startedAt]);

  const remainingSeconds = useMemo(() => {
    if (deadlineMs === null || submitted) return null;
    return Math.max(0, Math.ceil((deadlineMs - clock) / 1000));
  }, [clock, deadlineMs, submitted]);

  const lockedByTime = !submitted && remainingSeconds !== null && remainingSeconds <= 0;
  const lockedByStatus = !submitted && data?.exam.status === "closed";

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
    setError(null);
    setSyncNotice(null);
    try {
      const res = await fetch(`/api/student/exams/${params.id}`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "加载失败");
        return;
      }

      setData(payload);
      const initialAnswers = payload?.submission?.answers ?? payload?.draftAnswers ?? {};
      let mergedAnswers = initialAnswers;

      const localDraft = readLocalDraft();
      if (!payload?.submission && localDraft?.answers) {
        mergedAnswers = { ...initialAnswers, ...localDraft.answers };
        if (Object.keys(localDraft.answers).length > 0) {
          setSyncNotice("检测到断网暂存作答，已恢复到当前页面。");
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
    } catch {
      setError("加载失败");
    }
  }, [clearLocalDraft, loadReviewPack, params.id, readLocalDraft]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDraft = useCallback(async () => {
    if (!data || submitted || saving || lockedByTime || lockedByStatus) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/student/exams/${params.id}/autosave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? "自动保存失败");
        setSaving(false);
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
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assignment: {
            ...prev.assignment,
            status: payload.status ?? prev.assignment.status,
            startedAt: payload.startedAt ?? prev.assignment.startedAt
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
  }, [
    answers,
    clearLocalDraft,
    clientStartedAt,
    data,
    lockedByStatus,
    lockedByTime,
    online,
    params.id,
    saving,
    submitted,
    writeLocalDraft
  ]);

  useEffect(() => {
    if (!dirty || submitted || lockedByTime || lockedByStatus) return;
    const timer = setTimeout(() => {
      saveDraft();
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, lockedByStatus, lockedByTime, saveDraft, submitted]);

  useEffect(() => {
    if (!online || !pendingLocalSync || submitted || saving || lockedByTime || lockedByStatus) return;
    saveDraft();
  }, [lockedByStatus, lockedByTime, online, pendingLocalSync, saveDraft, saving, submitted]);

  const submitExam = useCallback(
    async (trigger: "manual" | "timeout") => {
      if (!data || submitted || submitting || lockedByStatus) return;

      if (!online) {
        const nextStartedAt = clientStartedAt ?? new Date().toISOString();
        setClientStartedAt(nextStartedAt);
        writeLocalDraft({
          answers,
          updatedAt: new Date().toISOString(),
          clientStartedAt: nextStartedAt
        });
        setPendingLocalSync(true);
        setError("当前离线，无法提交。答案已本地暂存，请恢复网络后重试。");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        await flushExamEvents();
        const res = await fetch(`/api/student/exams/${params.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers })
        });
        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.error ?? "提交失败");
          setSubmitting(false);
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
        const reviewPackNotice =
          payload?.reviewPackSummary?.estimatedMinutes
            ? `系统已生成考试复盘包，预计 ${payload.reviewPackSummary.estimatedMinutes} 分钟完成。`
            : "";
        if (trigger === "timeout") {
          const timeoutNotice = ["考试时间结束，系统已自动提交。", reviewNotice, reviewPackNotice]
            .filter(Boolean)
            .join("");
          setSyncNotice(timeoutNotice);
        } else if (reviewNotice || reviewPackNotice) {
          setSyncNotice([reviewNotice, reviewPackNotice].filter(Boolean).join(" "));
        }
        void loadReviewPack();

        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            assignment: {
              ...prev.assignment,
              status: "submitted",
              submittedAt: payload.submittedAt,
              score: payload.score,
              total: payload.total
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
        setError("提交失败，请稍后重试。");
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
      lockedByStatus,
      online,
      params.id,
      submitted,
      submitting,
      writeLocalDraft,
      loadReviewPack
    ]
  );

  useEffect(() => {
    if (submitted || submitting || lockedByTime === false) return;
    if (timeupTriggered) return;
    setTimeupTriggered(true);
    submitExam("timeout");
  }, [lockedByTime, submitExam, submitted, submitting, timeupTriggered]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submitExam("manual");
  }

  if (error) {
    return (
      <Card title="考试详情">
        <p>{error}</p>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button secondary" onClick={load}>
            重试
          </button>
          <Link className="button ghost" href="/student/exams">
            返回考试列表
          </Link>
        </div>
      </Card>
    );
  }

  if (!data) {
    return <Card title="考试详情">加载中...</Card>;
  }

  const totalScore = data.questions.reduce((sum, item) => sum + (item.score ?? 1), 0);
  const finalScore = result?.score ?? data.submission?.score ?? data.assignment.score ?? 0;
  const finalTotal = result?.total ?? data.submission?.total ?? data.assignment.total ?? totalScore;
  const answerCount = Object.values(answers).filter((value) => value && value.trim()).length;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.exam.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">{submitted ? "已提交" : lockedByStatus ? "考试已关闭" : "考试进行中"}</span>
      </div>

      <Card title="考试信息" tag="概览">
        <div className="grid grid-2">
          <div className="card feature-card">
            <EduIcon name="board" />
            <div className="section-title">考试说明</div>
            <p>{data.exam.description || "请认真作答，按时提交。"}</p>
            <div className="pill-list">
              {data.exam.startAt ? (
                <span className="pill">开始 {new Date(data.exam.startAt).toLocaleString("zh-CN")}</span>
              ) : (
                <span className="pill">可立即开始</span>
              )}
              <span className="pill">截止 {new Date(data.exam.endAt).toLocaleString("zh-CN")}</span>
              <span className="pill">{data.exam.status === "closed" ? "状态 已关闭" : "状态 开放中"}</span>
              <span className="pill">
                监测 {data.exam.antiCheatLevel === "basic" ? "切屏/离屏记录中" : "关闭"}
              </span>
              <span className="pill">网络 {online ? "在线" : "离线"}</span>
            </div>
          </div>
          <div className="card feature-card">
            <EduIcon name="chart" />
            <div className="section-title">作答状态</div>
            <div className="pill-list">
              <span className="pill">已答 {answerCount}/{data.questions.length}</span>
              <span className="pill">总分 {totalScore}</span>
              <span className="pill">时长 {data.exam.durationMinutes ? `${data.exam.durationMinutes} 分钟` : "不限"}</span>
              {!submitted && remainingSeconds !== null ? (
                <span className="pill">剩余 {formatRemain(remainingSeconds)}</span>
              ) : null}
              {!submitted && data.exam.durationMinutes && !startedAt ? (
                <span className="pill">开始作答后计时</span>
              ) : null}
            </div>
            {submitted ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                成绩：{finalScore}/{finalTotal}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
                {saving ? "自动保存中..." : savedAt ? `最近保存：${new Date(savedAt).toLocaleTimeString("zh-CN")}` : "尚未保存"}
              </div>
            )}
            {syncNotice ? <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>{syncNotice}</div> : null}
            {lockedByStatus ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#b42318" }}>
                教师已关闭本场考试，当前仅可查看作答记录。
              </div>
            ) : null}
          </div>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <Link className="button ghost" href="/student/exams">
            返回考试列表
          </Link>
          {!submitted ? (
            <button
              className="button secondary"
              type="button"
              onClick={saveDraft}
              disabled={saving || submitting || lockedByTime || lockedByStatus}
            >
              {saving ? "保存中..." : "保存进度"}
            </button>
          ) : null}
        </div>
      </Card>

      <Card title="考试作答" tag="作答">
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {data.questions.map((question, index) => (
            <div className="card" key={question.id}>
              <div className="section-title">
                {index + 1}. {question.stem}
              </div>
              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                {question.options.map((option) => (
                  <label key={option} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      disabled={submitted || lockedByTime || lockedByStatus || submitting}
                      onChange={(event) => {
                        if (!startedAt) {
                          setClientStartedAt(new Date().toISOString());
                        }
                        setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }));
                        setDirty(true);
                      }}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>分值：{question.score}</div>
            </div>
          ))}

          {submitted ? (
            <div className="card">
              <div className="section-title">考试已提交</div>
              <p>
                你的成绩：{finalScore}/{finalTotal}
              </p>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                提交时间：{data.assignment.submittedAt ? new Date(data.assignment.submittedAt).toLocaleString("zh-CN") : "-"}
              </div>
              {result?.queuedReviewCount ? (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                  错题已加入今日复练清单：{result.queuedReviewCount} 题
                </div>
              ) : null}
            </div>
          ) : (
            <button className="button primary" type="submit" disabled={submitting || !online || lockedByStatus}>
              {submitting
                ? "提交中..."
                : !online
                  ? "离线状态不可提交"
                  : lockedByStatus
                    ? "考试已关闭"
                    : lockedByTime
                      ? "时间已结束，立即提交"
                      : "提交考试"}
            </button>
          )}
        </form>
      </Card>

      {result?.details?.length ? (
        <Card title="答题结果" tag="反馈">
          <div className="grid" style={{ gap: 8 }}>
            {result.details.map((item, index) => (
              <div className="card" key={item.questionId}>
                <div className="section-title">
                  {index + 1}. {item.correct ? "正确" : "错误"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  你的答案：{item.answer || "未作答"}；正确答案：{item.correctAnswer}；分值：{item.score}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {(submitted || Boolean(reviewPack) || Boolean(data.reviewPackSummary)) ? (
        <Card title="考试复盘包" tag="闭环">
          {reviewPackLoading ? <p>复盘包加载中...</p> : null}
          {!reviewPackLoading && !reviewPack ? (
            <div className="grid" style={{ gap: 8 }}>
              <p>
                系统已生成复盘摘要：错题 {data.reviewPackSummary?.wrongCount ?? 0} 题，预计{" "}
                {data.reviewPackSummary?.estimatedMinutes ?? 0} 分钟。
              </p>
              <div className="cta-row">
                <button className="button secondary" type="button" onClick={() => void loadReviewPack()}>
                  加载完整复盘包
                </button>
              </div>
            </div>
          ) : null}
          {reviewPack ? (
            <div className="grid" style={{ gap: 10 }}>
              <div className="grid grid-3">
                <div className="card">
                  <div className="section-title">错题总数</div>
                  <p>{reviewPack.wrongCount}</p>
                </div>
                <div className="card">
                  <div className="section-title">预计复盘时长</div>
                  <p>{reviewPack.summary.estimatedMinutes} 分钟</p>
                </div>
                <div className="card">
                  <div className="section-title">生成时间</div>
                  <p style={{ fontSize: 13 }}>{new Date(reviewPack.generatedAt).toLocaleString("zh-CN")}</p>
                </div>
              </div>

              <div className="card">
                <div className="section-title">核心错因</div>
                <div className="grid" style={{ gap: 6 }}>
                  {reviewPack.rootCauses.length ? (
                    reviewPack.rootCauses.map((cause, index) => (
                      <div key={`cause-${index}`} style={{ fontSize: 13, color: "var(--ink-1)" }}>
                        {index + 1}. {cause}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--ink-1)" }}>暂无错因分析。</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="section-title">薄弱知识点</div>
                <div className="grid" style={{ gap: 6 }}>
                  {reviewPack.summary.topWeakKnowledgePoints.length ? (
                    reviewPack.summary.topWeakKnowledgePoints.map((item) => (
                      <div key={item.knowledgePointId} style={{ fontSize: 13, color: "var(--ink-1)" }}>
                        {item.title} · 错题 {item.wrongCount}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--ink-1)" }}>暂无聚类薄弱点。</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="section-title">推荐动作</div>
                <div className="grid" style={{ gap: 8 }}>
                  {reviewPack.actionItems.map((item) => (
                    <div key={item.id} style={{ fontSize: 13 }}>
                      <strong>{item.title}</strong> · {item.estimatedMinutes} 分钟
                      <div style={{ color: "var(--ink-1)" }}>{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="section-title">7 日修复计划</div>
                <div className="grid" style={{ gap: 6 }}>
                  {reviewPack.sevenDayPlan.map((item) => (
                    <div key={`day-${item.day}`} style={{ fontSize: 13 }}>
                      D{item.day} · {item.title} · {item.estimatedMinutes} 分钟
                      <div style={{ color: "var(--ink-1)" }}>{item.focus}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cta-row">
                <Link className="button secondary" href="/wrong-book">
                  打开今日复练清单
                </Link>
                <Link className="button ghost" href="/practice?mode=review">
                  进入错题复练
                </Link>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
