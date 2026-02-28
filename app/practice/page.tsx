"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import { GRADE_OPTIONS, SUBJECT_OPTIONS } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics-client";

type Question = {
  id: string;
  stem: string;
  options: string[];
  knowledgePointId: string;
  recommendation?: {
    reason?: string;
    weaknessRank?: number | null;
  };
};

type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter?: string;
  unit?: string;
};

type Variant = {
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
};

type ExplainPack = {
  text: string;
  visual: string;
  analogy: string;
  provider?: string;
  manualReviewRule?: string;
  citationGovernance?: {
    total: number;
    averageConfidence: number;
    highTrustCount: number;
    mediumTrustCount: number;
    lowTrustCount: number;
    riskLevel: "low" | "medium" | "high";
    needsManualReview: boolean;
    manualReviewReason: string;
  };
  citations?: Array<{
    itemId: string;
    itemTitle: string;
    snippet: string;
    score: number;
    confidence: number;
    trustLevel: "high" | "medium" | "low";
    riskLevel: "low" | "medium" | "high";
    matchRatio: number;
    reason: string[];
  }>;
};

export default function PracticePage() {
  const searchParams = useSearchParams();
  const trackedPracticePageView = useRef(false);
  const [subject, setSubject] = useState("math");
  const [grade, setGrade] = useState("4");
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [knowledgePointId, setKnowledgePointId] = useState<string | undefined>(undefined);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [mode, setMode] = useState<"normal" | "challenge" | "timed" | "wrong" | "adaptive" | "review">("normal");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{
    correct: boolean;
    explanation: string;
    answer: string;
    masteryScore?: number;
    masteryDelta?: number;
    confidenceScore?: number;
    recencyWeight?: number;
    masteryTrend7d?: number;
    weaknessRank?: number | null;
  } | null>(null);
  const [challengeCount, setChallengeCount] = useState(0);
  const [challengeCorrect, setChallengeCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variantPack, setVariantPack] = useState<{ analysis: string; hints: string[]; variants: Variant[] } | null>(null);
  const [variantAnswers, setVariantAnswers] = useState<Record<number, string>>({});
  const [variantResults, setVariantResults] = useState<Record<number, boolean | null>>({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [favorite, setFavorite] = useState<{ tags: string[] } | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [explainMode, setExplainMode] = useState<"text" | "visual" | "analogy">("text");
  const [explainPack, setExplainPack] = useState<ExplainPack | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge-points")
      .then((res) => res.json())
      .then((data) => setKnowledgePoints(data.data ?? []));
  }, []);

  useEffect(() => {
    if (trackedPracticePageView.current) return;
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
    if (!next) return;
    if (["normal", "challenge", "timed", "wrong", "adaptive", "review"].includes(next)) {
      setMode(next as typeof mode);
    }
  }, [searchParams]);

  async function loadQuestion() {
    if (mode === "timed" && timeLeft === 0) {
      setTimeLeft(60);
      setTimerRunning(true);
    }
    const res = await fetch("/api/practice/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, grade, knowledgePointId, mode })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "暂无题目");
      setQuestion(null);
      return;
    }
    setError(null);
    setQuestion(data.question ?? null);
    setAnswer("");
    setResult(null);
    setVariantPack(null);
    setVariantAnswers({});
    setVariantResults({});
    setExplainPack(null);
    setExplainMode("text");
  }

  async function submitAnswer() {
    if (!question) return;
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer })
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data?.error ?? "提交失败";
        setError(errorMessage);
        trackEvent({
          eventName: "practice_submit_fail",
          page: "/practice",
          subject,
          grade,
          entityId: question.id,
          props: {
            mode,
            status: res.status,
            error: errorMessage,
            durationMs: Date.now() - startedAt
          }
        });
        return;
      }

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
        entityId: question.id,
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
    } catch {
      setError("提交失败");
      trackEvent({
        eventName: "practice_submit_fail",
        page: "/practice",
        subject,
        grade,
        entityId: question.id,
        props: {
          mode,
          error: "network error",
          durationMs: Date.now() - startedAt
        }
      });
    }
  }

  const loadExplainPack = useCallback(async (questionId: string) => {
    setExplainLoading(true);
    const res = await fetch("/api/practice/explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setExplainPack(null);
      setError(data?.error ?? data?.message ?? "AI 讲解生成失败");
      setExplainLoading(false);
      return;
    }
    setExplainPack(data?.data ?? null);
    setExplainLoading(false);
  }, []);

  const loadFavorite = useCallback(async (questionId: string) => {
    const res = await fetch(`/api/favorites/${questionId}`);
    const data = await res.json();
    setFavorite(data?.data ? { tags: data.data.tags ?? [] } : null);
  }, []);

  async function toggleFavorite() {
    if (!question) return;
    setFavoriteLoading(true);
    if (favorite) {
      await fetch(`/api/favorites/${question.id}`, { method: "DELETE" });
      setFavorite(null);
    } else {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, tags: [] })
      });
      const data = await res.json();
      setFavorite(data?.data ? { tags: data.data.tags ?? [] } : null);
    }
    setFavoriteLoading(false);
  }

  async function editFavoriteTags() {
    if (!question) return;
    const input = prompt("输入标签（用逗号分隔）", favorite?.tags?.join(",") ?? "");
    if (input === null) return;
    const tags = input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const res = await fetch(`/api/favorites/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags })
    });
    const data = await res.json();
    setFavorite(data?.data ? { tags: data.data.tags ?? [] } : null);
  }

  async function loadVariants() {
    if (!question) return;
    setLoadingVariants(true);
    const res = await fetch("/api/practice/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, studentAnswer: answer })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? data?.message ?? "变式生成失败，请稍后重试");
      setLoadingVariants(false);
      return;
    }
    setVariantPack({
      analysis: data?.data?.explanation?.analysis ?? "",
      hints: data?.data?.explanation?.hints ?? [],
      variants: data?.data?.variants ?? []
    });
    setVariantAnswers({});
    setVariantResults({});
    setLoadingVariants(false);
  }

  const filtered = useMemo(
    () =>
      knowledgePoints
        .filter((kp) => kp.subject === subject && kp.grade === grade)
        .sort((a, b) => {
          const unitA = a.unit ?? "未分单元";
          const unitB = b.unit ?? "未分单元";
          if (unitA !== unitB) return unitA.localeCompare(unitB, "zh-CN");
          const chapterA = a.chapter ?? "未分章节";
          const chapterB = b.chapter ?? "未分章节";
          if (chapterA !== chapterB) return chapterA.localeCompare(chapterB, "zh-CN");
          return a.title.localeCompare(b.title, "zh-CN");
        }),
    [knowledgePoints, subject, grade]
  );

  const filteredKnowledgePoints = useMemo(() => {
    const keyword = knowledgeSearch.trim().toLowerCase();
    if (!keyword) return filtered;
    return filtered.filter((kp) => {
      const title = kp.title.toLowerCase();
      const chapter = (kp.chapter ?? "").toLowerCase();
      const unit = (kp.unit ?? "").toLowerCase();
      return title.includes(keyword) || chapter.includes(keyword) || unit.includes(keyword);
    });
  }, [filtered, knowledgeSearch]);

  const groupedKnowledgePoints = useMemo(() => {
    const groupMap = new Map<string, { unit: string; chapter: string; items: KnowledgePoint[] }>();
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
    if (!knowledgePointId) return;
    if (!filtered.find((kp) => kp.id === knowledgePointId)) {
      setKnowledgePointId(undefined);
    }
  }, [filtered, knowledgePointId]);

  useEffect(() => {
    if (!timerRunning) return;
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

  const questionId = question?.id;
  const resultAnswer = result?.answer;

  useEffect(() => {
    if (!questionId) return;
    loadFavorite(questionId);
  }, [loadFavorite, questionId]);

  useEffect(() => {
    if (!questionId || !resultAnswer) return;
    loadExplainPack(questionId);
  }, [loadExplainPack, questionId, resultAnswer]);

  function resetChallenge() {
    setChallengeCount(0);
    setChallengeCorrect(0);
  }

  const modeLabel: Record<string, string> = {
    normal: "普通练习",
    challenge: "闯关模式",
    timed: "限时模式",
    wrong: "错题专练",
    adaptive: "自适应推荐",
    review: "记忆复习"
  };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>智能练习</h2>
          <div className="section-sub">个性化练习 + AI 讲解 + 变式训练。</div>
        </div>
        <span className="chip">{modeLabel[mode] ?? "练习模式"}</span>
      </div>

      <Card title="练习设置" tag="配置">
        <div className="grid grid-3" style={{ marginTop: 12 }}>
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
            <div className="section-title">模式</div>
            <select
              value={mode}
              onChange={(event) => {
                const next = event.target.value as "normal" | "challenge" | "timed" | "wrong" | "adaptive" | "review";
                setMode(next);
                setResult(null);
                setQuestion(null);
                setAnswer("");
                setTimeLeft(0);
                setTimerRunning(false);
                setVariantPack(null);
                setVariantAnswers({});
                setVariantResults({});
                resetChallenge();
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="normal">普通练习</option>
              <option value="challenge">闯关模式</option>
              <option value="timed">限时模式</option>
              <option value="wrong">错题专练</option>
              <option value="adaptive">自适应推荐</option>
              <option value="review">记忆复习</option>
            </select>
          </label>
          <label>
            <div className="section-title">知识点检索</div>
            <input
              value={knowledgeSearch}
              onChange={(event) => setKnowledgeSearch(event.target.value)}
              placeholder="按知识点/章节/单元搜索"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">知识点</div>
            <select
              value={knowledgePointId}
              onChange={(event) => setKnowledgePointId(event.target.value || undefined)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="">全部</option>
              {groupedKnowledgePoints.map((group) => (
                <optgroup
                  key={`${group.unit}-${group.chapter}`}
                  label={`${group.unit} / ${group.chapter}（${group.items.length}）`}
                >
                  {group.items.map((kp) => (
                    <option value={kp.id} key={kp.id}>
                      {kp.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
              已显示 {filteredKnowledgePoints.length}/{filtered.length} 个知识点
            </div>
          </label>
        </div>
        <button className="button primary" style={{ marginTop: 12 }} onClick={loadQuestion}>
          {mode === "timed" ? "开始限时" : "获取题目"}
        </button>
        {error ? <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>{error}</div> : null}
        {mode === "timed" ? (
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)" }}>
            剩余时间：{timeLeft}s
          </div>
        ) : null}
        {mode === "challenge" ? (
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)" }}>
            闯关进度：{challengeCount}/5，正确 {challengeCorrect}
          </div>
        ) : null}
      </Card>

      {question ? (
        <Card title="题目" tag="作答">
          <p>{question.stem}</p>
          {question.recommendation?.reason ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
              推荐原因：{question.recommendation.reason}
              {typeof question.recommendation.weaknessRank === "number"
                ? `（薄弱度第 ${question.recommendation.weaknessRank} 位）`
                : ""}
            </div>
          ) : null}
          <div className="cta-row" style={{ marginTop: 8 }}>
            <button className="button secondary" onClick={toggleFavorite} disabled={favoriteLoading}>
              {favorite ? "已收藏" : "收藏"}
            </button>
            <button className="button secondary" onClick={editFavoriteTags} disabled={!favorite}>
              标签
            </button>
            {favorite?.tags?.length ? (
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>标签：{favorite.tags.join("、")}</div>
            ) : null}
          </div>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {question.options.map((option) => (
              <label className="card" key={option} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === option}
                  onChange={() => setAnswer(option)}
                  style={{ marginRight: 8 }}
                />
                {option}
              </label>
            ))}
          </div>
          <div className="cta-row">
            <button className="button secondary" onClick={loadQuestion}>
              换一题
            </button>
            <button className="button primary" onClick={submitAnswer} disabled={!answer || (mode === "timed" && timeLeft === 0)}>
              提交答案
            </button>
          </div>
        </Card>
      ) : null}

      {result ? (
        <Card title="解析" tag="讲解">
          <div className="badge">{result.correct ? "回答正确" : "回答错误"}</div>
          <p style={{ marginTop: 8 }}>正确答案：{result.answer}</p>
          <div className="pill-list" style={{ marginTop: 8 }}>
            <span className="pill">掌握度 {result.masteryScore ?? 0}</span>
            <span className="pill">
              变化 {result.masteryDelta && result.masteryDelta > 0 ? "+" : ""}
              {result.masteryDelta ?? 0}
            </span>
            <span className="pill">置信度 {result.confidenceScore ?? 0}</span>
            <span className="pill">近期权重 {result.recencyWeight ?? 0}</span>
            <span className="pill">
              趋势 {result.masteryTrend7d && result.masteryTrend7d > 0 ? "+" : ""}
              {result.masteryTrend7d ?? 0}
            </span>
            {typeof result.weaknessRank === "number" ? (
              <span className="pill">薄弱度第 {result.weaknessRank} 位</span>
            ) : null}
          </div>
          <div className="cta-row" style={{ marginTop: 8 }}>
            <button className="button secondary" onClick={() => setExplainMode("text")}>
              文字版
            </button>
            <button className="button secondary" onClick={() => setExplainMode("visual")}>
              图解版
            </button>
            <button className="button secondary" onClick={() => setExplainMode("analogy")}>
              类比版
            </button>
          </div>
          <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {explainLoading
              ? "解析生成中..."
              : explainPack
              ? explainPack[explainMode]
              : result.explanation}
          </div>
          {typeof result.masteryScore === "number" ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
              当前知识点掌握分：{result.masteryScore}
              {typeof result.masteryDelta === "number"
                ? `（${result.masteryDelta >= 0 ? "+" : ""}${result.masteryDelta}）`
                : ""}
            </div>
          ) : null}
          {explainPack?.provider ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
              解析来源：{explainPack.provider}
            </div>
          ) : null}
          {explainPack?.manualReviewRule ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "#b54708" }}>{explainPack.manualReviewRule}</div>
          ) : null}
          {explainPack?.citations?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 10 }}>
              <div className="badge">教材依据</div>
              {explainPack.citationGovernance ? (
                <div className="card" style={{ fontSize: 12 }}>
                  平均置信度 {explainPack.citationGovernance.averageConfidence} · 高可信{" "}
                  {explainPack.citationGovernance.highTrustCount} 条 · 中可信{" "}
                  {explainPack.citationGovernance.mediumTrustCount} 条 · 低可信{" "}
                  {explainPack.citationGovernance.lowTrustCount} 条
                </div>
              ) : null}
              {explainPack.citations.map((item) => (
                <div className="card" key={`${item.itemId}-${item.score}`} style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>
                    {item.itemTitle}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: item.trustLevel === "high" ? "#027a48" : item.trustLevel === "medium" ? "#b54708" : "#b42318"
                      }}
                    >
                      {item.trustLevel === "high" ? "高可信" : item.trustLevel === "medium" ? "中可信" : "低可信"} · 置信度{" "}
                      {item.confidence}
                    </span>
                  </div>
                  <div style={{ color: "var(--ink-1)", marginTop: 4 }}>{item.snippet}</div>
                  {item.reason?.length ? (
                    <div style={{ marginTop: 4, color: "var(--ink-1)" }}>{item.reason.join("；")}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className="cta-row" style={{ marginTop: 12 }}>
            <button className="button secondary" onClick={loadVariants}>
              {loadingVariants ? "生成中..." : "AI 错题讲解 + 变式训练"}
            </button>
          </div>
        </Card>
      ) : null}

      {variantPack ? (
        <Card title="错题讲解" tag="纠错">
          <p>{variantPack.analysis}</p>
          {variantPack.hints?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 10 }}>
              <div className="badge">提示</div>
              {variantPack.hints.map((hint) => (
                <div key={hint}>{hint}</div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {variantPack?.variants?.length ? (
        <Card title="变式训练" tag="迁移">
          <div className="grid" style={{ gap: 12 }}>
            {variantPack.variants.map((variant, index) => {
              const selected = variantAnswers[index];
              const checked = variantResults[index];
              return (
                <div className="card" key={`${variant.stem}-${index}`}>
                  <div className="section-title">变式题 {index + 1}</div>
                  <p>{variant.stem}</p>
                  <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                    {variant.options.map((option) => (
                      <label className="card" key={option} style={{ cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`variant-${index}`}
                          checked={selected === option}
                          onChange={() =>
                            setVariantAnswers((prev) => ({
                              ...prev,
                              [index]: option
                            }))
                          }
                          style={{ marginRight: 8 }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  <div className="cta-row" style={{ marginTop: 10 }}>
                    <button
                      className="button primary"
                      onClick={() =>
                        setVariantResults((prev) => ({
                          ...prev,
                          [index]: selected === variant.answer
                        }))
                      }
                      disabled={!selected}
                    >
                      提交本题
                    </button>
                  </div>
                  {checked !== undefined && checked !== null ? (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      {checked ? "回答正确" : "回答错误"}
                      <div>正确答案：{variant.answer}</div>
                      <div>{variant.explanation}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {mode === "challenge" && challengeCount >= 5 ? (
        <Card title="闯关结果" tag="成果">
          <p>本次闯关正确 {challengeCorrect} / 5</p>
          <button className="button secondary" onClick={resetChallenge}>
            再来一次
          </button>
        </Card>
      ) : null}
    </div>
  );
}
