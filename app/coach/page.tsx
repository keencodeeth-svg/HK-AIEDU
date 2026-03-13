"use client";

import { useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";

type CoachResponse = {
  learningMode?: "study";
  stage?: "diagnose" | "check" | "reveal";
  stageLabel?: string;
  coachReply?: string;
  nextPrompt?: string;
  knowledgeChecks?: string[];
  answer: string;
  steps: string[];
  hints: string[];
  checkpoints: string[];
  answerAvailable?: boolean;
  revealAnswerCta?: string;
  masteryFocus?: string;
  feedback?: string | null;
  memory?: {
    recentSessionCount: number;
    recentQuestions: string[];
    patternHint: string;
  };
  provider?: string;
};

export default function CoachPage() {
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [data, setData] = useState<CoachResponse | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCoach(options?: { revealAnswer?: boolean }) {
    if (!question.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/ai/coach", {
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
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData(null);
      setError(payload?.error ?? payload?.message ?? "学习模式暂不可用，请稍后重试");
      setLoading(false);
      return;
    }
    setData(payload?.data ?? null);
    const nextHints = payload?.data?.hints ?? [];
    const nextHintCount = options?.revealAnswer ? nextHints.length : Math.min(studentAnswer.trim() ? 2 : 1, nextHints.length);
    setHintIndex(nextHintCount);
    setLoading(false);
  }

  async function startCoach() {
    await requestCoach();
  }

  async function submitThinking() {
    if (!studentAnswer.trim()) return;
    await requestCoach();
  }

  async function revealAnswer() {
    await requestCoach({ revealAnswer: true });
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习陪练</h2>
          <div className="section-sub">提示、追问、知识检查与按需揭晓讲解。</div>
        </div>
        <span className="chip">Study Mode</span>
      </div>

      <Card title="学习陪练模式" tag="输入">
        <div className="feature-card">
          <EduIcon name="brain" />
          <p>先说思路，再完成知识检查，需要时再揭晓完整讲解。</p>
        </div>
        <div className="grid grid-3">
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
          <label>
            <div className="section-title">我的思路</div>
            <textarea
              value={studentAnswer}
              onChange={(event) => setStudentAnswer(event.target.value)}
              rows={3}
              placeholder="先写下你会怎么下手，系统会按你的思路继续追问。"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
        </div>
        <label style={{ marginTop: 12 }}>
          <div className="section-title">题目</div>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="例如：把 2/3 和 1/6 相加"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          />
        </label>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button primary" onClick={startCoach} disabled={loading || !question.trim()}>
            {loading ? "生成中..." : "开始学习模式"}
          </button>
          <button className="button secondary" onClick={submitThinking} disabled={loading || !question.trim() || !studentAnswer.trim()}>
            提交我的思路
          </button>
          <button className="button ghost" onClick={revealAnswer} disabled={loading || !question.trim()}>
            查看完整讲解
          </button>
        </div>
        {error ? <div className="status-note error" style={{ marginTop: 8 }}>{error}</div> : null}
      </Card>

      {data ? (
        <Card title="陪练指引" tag="反馈">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>先追问和知识检查，再按需揭晓完整讲解。</p>
          </div>
          <div className="cta-row" style={{ marginBottom: 8 }}>
            {data.stageLabel ? <span className="badge">{data.stageLabel}</span> : null}
            {data.masteryFocus ? <span className="pill">本轮重点：{data.masteryFocus}</span> : null}
            {data.answerAvailable && !data.answer.trim() ? <span className="pill">答案已锁定</span> : null}
          </div>
          {data.coachReply ? <div>{data.coachReply}</div> : null}
          {data.feedback ? <div style={{ marginTop: 10 }}>{data.feedback}</div> : null}
          {data.nextPrompt ? <div className="status-note info" style={{ marginTop: 10 }}>{data.nextPrompt}</div> : null}
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            <div className="badge">知识检查</div>
            {(data.knowledgeChecks ?? data.checkpoints ?? []).map((step) => (
              <div key={step}>{step}</div>
            ))}
          </div>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            <div className="badge">再给我一点提示</div>
            {data.hints.slice(0, hintIndex).map((hint) => (
              <div key={hint}>{hint}</div>
            ))}
            <button
              className="button secondary"
              onClick={() => setHintIndex((prev) => Math.min(prev + 1, data.hints.length))}
              disabled={hintIndex >= data.hints.length}
            >
              我卡住了
            </button>
          </div>
          {data.answer.trim() ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="badge">完整讲解</div>
              <div>{data.answer}</div>
              {data.steps.map((step) => (
                <div key={step}>{step}</div>
              ))}
            </div>
          ) : (
            <div className="status-note info" style={{ marginTop: 12 }}>
              当前仍在学习模式中。先完成追问和提示，需要时再点击“查看完整讲解”。
            </div>
          )}
          {data.memory ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="badge">长期记忆</div>
              <div>{data.memory.patternHint}</div>
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                最近陪练 {data.memory.recentSessionCount} 次
                {data.memory.recentQuestions?.length
                  ? ` · 最近题目：${data.memory.recentQuestions.slice(0, 3).join("；")}`
                  : ""}
              </div>
            </div>
          ) : null}
          {data.provider ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-1)" }}>模型来源：{data.provider}</div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
