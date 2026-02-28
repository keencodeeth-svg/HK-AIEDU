"use client";

import { useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";

type CoachResponse = {
  answer: string;
  steps: string[];
  hints: string[];
  checkpoints: string[];
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
  const [stepIndex, setStepIndex] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCoach() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, subject, grade })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData(null);
      setError(payload?.error ?? payload?.message ?? "陪练生成失败，请稍后重试");
      setLoading(false);
      return;
    }
    setData(payload?.data ?? null);
    setStepIndex(1);
    setHintIndex(0);
    setCheckpointIndex(0);
    setLoading(false);
  }

  async function submitThinking() {
    if (!question.trim() || !studentAnswer.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, subject, grade, studentAnswer })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload?.error ?? payload?.message ?? "思路反馈失败，请稍后重试");
      setLoading(false);
      return;
    }
    setData(payload?.data ?? null);
    setLoading(false);
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学习陪练</h2>
          <div className="section-sub">分步提示、卡点追问与思路反馈。</div>
        </div>
        <span className="chip">AI 陪练</span>
      </div>

      <Card title="学习陪练模式" tag="输入">
        <div className="feature-card">
          <EduIcon name="brain" />
          <p>输入题目与思路，获得逐步引导。</p>
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
            <input
              value={studentAnswer}
              onChange={(event) => setStudentAnswer(event.target.value)}
              placeholder="写下你的解题思路"
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
          <button className="button primary" onClick={startCoach}>
            {loading ? "生成中..." : "开始陪练"}
          </button>
          <button className="button secondary" onClick={submitThinking} disabled={!studentAnswer.trim()}>
            提交我的思路
          </button>
        </div>
        {error ? <div className="status-note error" style={{ marginTop: 8 }}>{error}</div> : null}
      </Card>

      {data ? (
        <Card title="陪练指引" tag="反馈">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>分步提示、追问与思路校准。</p>
          </div>
          <p>{data.answer}</p>
          {data.feedback ? <div style={{ marginTop: 10 }}>{data.feedback}</div> : null}
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            <div className="badge">分步提示</div>
            {data.steps.slice(0, stepIndex).map((step) => (
              <div key={step}>{step}</div>
            ))}
            <button
              className="button secondary"
              onClick={() => setStepIndex((prev) => Math.min(prev + 1, data.steps.length))}
              disabled={stepIndex >= data.steps.length}
            >
              下一步提示
            </button>
          </div>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            <div className="badge">卡点追问</div>
            <div>{data.checkpoints[checkpointIndex] ?? "继续完善你的思路。"}</div>
            <button
              className="button secondary"
              onClick={() =>
                setCheckpointIndex((prev) => (prev + 1 >= data.checkpoints.length ? 0 : prev + 1))
              }
            >
              换一个追问
            </button>
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
