"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";

type HistoryItem = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
  favorite: boolean;
  tags: string[];
};

export default function TutorPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!question) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, subject: "math", grade: "4" })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAnswer(null);
      setError(payload?.error ?? payload?.message ?? "AI 辅导暂不可用，请稍后重试");
      setLoading(false);
      return;
    }
    const data = payload?.data ?? payload;
    setAnswer(data);
    if (data?.answer) {
      const historyRes = await fetch("/api/ai/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer: data.answer })
      });
      const historyData = await historyRes.json().catch(() => ({}));
      if (historyRes.ok && historyData?.data) {
        setHistory((prev) => [historyData.data, ...prev]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/ai/history")
      .then((res) => res.json())
      .then((data) => setHistory(data.data ?? []));
  }, []);

  async function toggleFavorite(item: HistoryItem) {
    const res = await fetch(`/api/ai/history/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !item.favorite })
    });
    const data = await res.json();
    if (data?.data) {
      setHistory((prev) => prev.map((h) => (h.id === item.id ? data.data : h)));
    }
  }

  async function editTags(item: HistoryItem) {
    const input = prompt("输入标签（用逗号分隔）", item.tags?.join(",") ?? "");
    if (input === null) return;
    const tags = input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await fetch(`/api/ai/history/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags })
    });
    const data = await res.json();
    if (data?.data) {
      setHistory((prev) => prev.map((h) => (h.id === item.id ? data.data : h)));
    }
  }

  const filteredHistory = showFavorites ? history.filter((item) => item.favorite) : history;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 辅导</h2>
          <div className="section-sub">提问、讲解与学习记录。</div>
        </div>
        <span className="chip">智能讲解</span>
      </div>

      <Card title="AI 辅导" tag="提问">
        <label>
          <div className="section-title">输入你的问题</div>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="例如：分数 3/4 表示什么意思？"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
          />
        </label>
        <button className="button primary" style={{ marginTop: 12 }} onClick={handleAsk}>
          {loading ? "思考中..." : "提问"}
        </button>
        {error ? <div className="status-note error" style={{ marginTop: 8 }}>{error}</div> : null}
      </Card>

      {answer ? (
        <Card title="AI 讲解" tag="讲解">
          <p>{answer.answer}</p>
          {answer.provider ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
              模型来源：{answer.provider}
            </div>
          ) : null}
          <div className="grid" style={{ gap: 6, marginTop: 12 }}>
            <div className="badge">步骤</div>
            {answer.steps?.map((step: string) => (
              <div key={step}>{step}</div>
            ))}
          </div>
          <div className="grid" style={{ gap: 6, marginTop: 12 }}>
            <div className="badge">提示</div>
            {answer.hints?.map((hint: string) => (
              <div key={hint}>{hint}</div>
            ))}
          </div>
          {answer.source?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 12 }}>
              <div className="badge">参考来源</div>
              {answer.source.map((item: string) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card title="AI 对话历史" tag="记录">
        <div className="cta-row">
          <button className="button secondary" onClick={() => setShowFavorites((prev) => !prev)}>
            {showFavorites ? "查看全部" : "只看收藏"}
          </button>
        </div>
        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          {filteredHistory.length === 0 ? <p>暂无历史记录。</p> : null}
          {filteredHistory.map((item) => (
            <div className="card" key={item.id}>
              <div className="section-title">{item.question}</div>
              <p style={{ color: "var(--ink-1)" }}>{item.answer}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button className="button secondary" onClick={() => toggleFavorite(item)}>
                  {item.favorite ? "已收藏" : "收藏"}
                </button>
                <button className="button secondary" onClick={() => editTags(item)}>
                  编辑标签
                </button>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {new Date(item.createdAt).toLocaleString("zh-CN")}
                </div>
              </div>
              {item.tags?.length ? (
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  标签：{item.tags.join("、")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
