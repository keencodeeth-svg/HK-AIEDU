"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import StatePanel from "@/components/StatePanel";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";
import { getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import { toPng } from "html-to-image";
import { getDiagnosticStartRequestMessage, getDiagnosticSubmitRequestMessage } from "./utils";

type Question = {
  id: string;
  stem: string;
  options: string[];
  knowledgePointId: string;
};

type DiagnosticStartResponse = {
  subject?: string;
  grade?: string;
  questions?: Question[];
};

type DiagnosticResult = {
  total: number;
  correct: number;
  accuracy: number;
  breakdown?: { knowledgePointId: string; title: string; total: number; correct: number; accuracy: number }[];
  wrongReasons?: { reason: string; count: number }[];
};

export default function DiagnosticPage() {
  const startRequestIdRef = useRef(0);
  const submitRequestIdRef = useRef(0);
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const reasonOptions = [
    "概念不清",
    "审题不仔细",
    "计算粗心",
    "方法不会",
    "记忆不牢"
  ];
  const reportRef = useRef<HTMLDivElement | null>(null);

  function clearDiagnosticState() {
    setQuestions([]);
    setIndex(0);
    setAnswers({});
    setReasons({});
    setResult(null);
    setPageError(null);
    setLoadingQuestions(false);
    setSubmitting(false);
  }

  function handleAuthRequired() {
    startRequestIdRef.current += 1;
    submitRequestIdRef.current += 1;
    clearDiagnosticState();
    setAuthRequired(true);
  }

  async function startDiagnostic() {
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
  }

  async function submitDiagnostic() {
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
  }

  async function exportImage() {
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
  }

  const current = questions[index];
  const busy = loadingQuestions || submitting;

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可开始诊断测评并生成学习计划。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>诊断测评</h2>
          <div className="section-sub">快速定位知识点薄弱项，生成学习计划。</div>
        </div>
        <span className="chip">学习体检</span>
      </div>

      {pageError ? <StatePanel title="本次操作存在异常" description={pageError} tone="error" compact /> : null}

      <Card title="诊断测评" tag="测评">
        <div className="feature-card">
          <EduIcon name="book" />
          <p>选择学科与年级，开始 AI 诊断测评。</p>
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">学科</div>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {SUBJECT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">年级</div>
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button primary" style={{ marginTop: 12 }} onClick={startDiagnostic} disabled={busy}>
          {loadingQuestions ? "生成题目中..." : "开始诊断"}
        </button>
      </Card>

      {current ? (
        <Card title={`第 ${index + 1} 题`} tag="答题">
          <div className="pill-list" style={{ marginBottom: 10 }}>
            <span className="pill">进度 {index + 1}/{questions.length}</span>
            <span className="pill">学科 {SUBJECT_LABELS[subject] ?? subject}</span>
            <span className="pill">年级 {grade}</span>
          </div>
          <MathText as="p" text={current.stem} />
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {current.options.map((option) => (
              <label className="card" key={option} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name={current.id}
                  value={option}
                  checked={answers[current.id] === option}
                  onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: option }))}
                  style={{ marginRight: 8 }}
                />
                <MathText text={option} />
              </label>
            ))}
          </div>
          <label style={{ display: "block", marginTop: 12 }}>
            <div className="section-title">错因（可选）</div>
            <select
              value={reasons[current.id] ?? ""}
              onChange={(event) => setReasons((prev) => ({ ...prev, [current.id]: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="">未选择</option>
              {reasonOptions.map((reason) => (
                <option value={reason} key={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <div className="cta-row">
            <button
              className="button secondary"
              disabled={index === 0 || busy}
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
            >
              上一题
            </button>
            {index < questions.length - 1 ? (
              <button className="button primary" onClick={() => setIndex((prev) => prev + 1)} disabled={busy}>
                下一题
              </button>
            ) : (
              <button className="button primary" onClick={submitDiagnostic} disabled={busy}>
                {submitting ? "提交中..." : "提交诊断"}
              </button>
            )}
          </div>
        </Card>
      ) : null}

      {result ? (
        <Card title="诊断结果" tag="报告">
          <div className="feature-card">
            <EduIcon name="chart" />
            <p>生成掌握度分布与错因总结。</p>
          </div>
          <div ref={reportRef}>
            <p>
              正确 {result.correct} / {result.total}，正确率 {result.accuracy}%。
            </p>
            {result.breakdown?.length ? (
              <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                <div className="badge">知识点掌握</div>
                {result.breakdown.map((item) => (
                  <div className="card" key={item.knowledgePointId}>
                    <div className="section-title">{item.title}</div>
                    <p>
                      正确 {item.correct}/{item.total}，正确率 {item.accuracy}%
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {result.wrongReasons?.length ? (
              <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                <div className="badge">错因分布</div>
                {result.wrongReasons.map((item) => (
                  <div key={item.reason}>
                    {item.reason}：{item.count} 次
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="cta-row">
            <button className="button secondary" onClick={() => window.print()} disabled={busy}>
              导出 PDF
            </button>
            <button className="button secondary" onClick={exportImage} disabled={busy}>
              导出图片
            </button>
            <Link className="button secondary" href="/plan">
              查看学习计划
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
