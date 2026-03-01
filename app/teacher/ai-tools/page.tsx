"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import MathText from "@/components/MathText";
import { SUBJECT_LABELS } from "@/lib/constants";

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

type PaperQuestion = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  knowledgePointTitle: string;
  chapter: string;
  unit: string;
  source: "bank" | "ai";
};

function aiRiskLabel(level?: string) {
  if (level === "high") return "高";
  if (level === "medium") return "中";
  return "低";
}

export default function TeacherAiToolsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [paperForm, setPaperForm] = useState({
    classId: "",
    knowledgePointIds: [] as string[],
    difficulty: "all",
    questionType: "all",
    durationMinutes: 40,
    questionCount: 0,
    mode: "ai",
    includeIsolated: false
  });
  const [paperResult, setPaperResult] = useState<{
    questions: PaperQuestion[];
    count: number;
    qualityGovernance?: {
      includeIsolated: boolean;
      isolatedExcludedCount: number;
      isolatedPoolCount: number;
      activePoolCount: number;
      shortfallCount?: number;
      qualityGovernanceDegraded?: boolean;
    } | null;
  } | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [outlineForm, setOutlineForm] = useState({ classId: "", topic: "", knowledgePointIds: [] as string[] });
  const [outlineResult, setOutlineResult] = useState<any>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [wrongForm, setWrongForm] = useState({ classId: "", rangeDays: 7 });
  const [wrongResult, setWrongResult] = useState<any>(null);
  const [wrongError, setWrongError] = useState<string | null>(null);
  const [reviewPackResult, setReviewPackResult] = useState<any>(null);
  const [reviewPackError, setReviewPackError] = useState<string | null>(null);
  const [reviewPackAssigningId, setReviewPackAssigningId] = useState<string | null>(null);
  const [reviewPackAssigningAll, setReviewPackAssigningAll] = useState(false);
  const [reviewPackAssignMessage, setReviewPackAssignMessage] = useState<string | null>(null);
  const [reviewPackAssignError, setReviewPackAssignError] = useState<string | null>(null);
  const [reviewPackDispatchIncludeIsolated, setReviewPackDispatchIncludeIsolated] = useState(false);
  const [reviewPackDispatchQuality, setReviewPackDispatchQuality] = useState<{
    includeIsolated: boolean;
    isolatedPoolCount: number;
    isolatedExcludedCount: number;
    selectedIsolatedCount: number;
  } | null>(null);
  const [reviewPackFailedItems, setReviewPackFailedItems] = useState<any[]>([]);
  const [reviewPackRelaxedItems, setReviewPackRelaxedItems] = useState<any[]>([]);
  const [reviewPackRetryingFailed, setReviewPackRetryingFailed] = useState(false);
  const [checkForm, setCheckForm] = useState({
    questionId: "",
    stem: "",
    options: ["", "", "", ""],
    answer: "",
    explanation: ""
  });
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((res) => res.json())
      .then((data) => setClasses(data.data ?? []));
    fetch("/api/knowledge-points")
      .then((res) => res.json())
      .then((data) => setKnowledgePoints(data.data ?? []));
  }, []);

  useEffect(() => {
    if (!paperForm.classId && classes.length) {
      setPaperForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!outlineForm.classId && classes.length) {
      setOutlineForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!wrongForm.classId && classes.length) {
      setWrongForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
  }, [classes, paperForm.classId, outlineForm.classId, wrongForm.classId]);

  const paperClass = classes.find((item) => item.id === paperForm.classId);
  const outlineClass = classes.find((item) => item.id === outlineForm.classId);
  const wrongClass = classes.find((item) => item.id === wrongForm.classId);

  const paperPoints = useMemo(() => {
    if (!paperClass) return [];
    return knowledgePoints.filter((kp) => kp.subject === paperClass.subject && kp.grade === paperClass.grade);
  }, [knowledgePoints, paperClass]);

  const outlinePoints = useMemo(() => {
    if (!outlineClass) return [];
    return knowledgePoints.filter((kp) => kp.subject === outlineClass.subject && kp.grade === outlineClass.grade);
  }, [knowledgePoints, outlineClass]);

  async function handleGeneratePaper(event: React.FormEvent) {
    event.preventDefault();
    if (!paperForm.classId) return;
    setLoading(true);
    setPaperError(null);
    const res = await fetch("/api/teacher/paper/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paperForm)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPaperResult(null);
      setPaperError(data?.error ?? data?.message ?? "组卷失败，请稍后重试");
      setLoading(false);
      return;
    }
    setPaperResult({
      questions: data?.data?.questions ?? [],
      count: data?.data?.count ?? 0,
      qualityGovernance: data?.data?.qualityGovernance ?? null
    });
    setLoading(false);
  }

  async function handleGenerateOutline(event: React.FormEvent) {
    event.preventDefault();
    if (!outlineForm.classId || !outlineForm.topic) return;
    setLoading(true);
    setOutlineError(null);
    const res = await fetch("/api/teacher/lesson/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outlineForm)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOutlineResult(null);
      setOutlineError(data?.error ?? data?.message ?? "生成讲稿失败，请稍后重试");
      setLoading(false);
      return;
    }
    setOutlineResult(data?.data ?? null);
    setLoading(false);
  }

  async function handleWrongReview(event: React.FormEvent) {
    event.preventDefault();
    if (!wrongForm.classId) return;
    setLoading(true);
    setWrongError(null);
    const res = await fetch("/api/teacher/lesson/wrong-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrongForm)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setWrongResult(null);
      setWrongError(data?.error ?? data?.message ?? "生成讲评脚本失败，请稍后重试");
      setLoading(false);
      return;
    }
    setWrongResult(data?.data ?? null);
    setLoading(false);
  }

  async function handleReviewPack(event: React.FormEvent) {
    event.preventDefault();
    if (!wrongForm.classId) return;
    setReviewPackError(null);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackDispatchQuality(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setLoading(true);
    const res = await fetch("/api/teacher/lesson/review-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrongForm)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setReviewPackResult(null);
      setReviewPackError(data?.error ?? data?.message ?? "生成讲评包失败，请稍后重试");
      setLoading(false);
      return;
    }
    setReviewPackResult(data?.data ?? null);
    setLoading(false);
  }

  async function handleCheckQuestion(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setCheckError(null);
    const res = await fetch("/api/teacher/questions/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: checkForm.questionId || undefined,
        stem: checkForm.stem,
        options: checkForm.options,
        answer: checkForm.answer,
        explanation: checkForm.explanation
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCheckResult(null);
      setCheckError(data?.error ?? data?.message ?? "题目纠错失败，请稍后重试");
      setLoading(false);
      return;
    }
    setCheckResult(data?.data ?? null);
    setLoading(false);
  }

  async function dispatchReviewPackItems(
    items: any[],
    options?: {
      autoRelaxOnInsufficient?: boolean;
      includeIsolated?: boolean;
    }
  ) {
    const res = await fetch("/api/teacher/lesson/review-pack/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: wrongForm.classId,
        items,
        includeIsolated: options?.includeIsolated ?? reviewPackDispatchIncludeIsolated,
        autoRelaxOnInsufficient: options?.autoRelaxOnInsufficient ?? false
      })
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error ?? "下发失败"
      };
    }
    return {
      ok: true,
      data: data?.data ?? null
    };
  }

  async function handleAssignReviewSheet(item: any) {
    if (!wrongForm.classId) return;
    const assignKey = String(item?.id ?? "");
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackAssigningId(assignKey);

    try {
      const result = await dispatchReviewPackItems([item]);
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      const summary = result.data?.summary;
      const failed = result.data?.failed ?? [];
      setReviewPackFailedItems(failed);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
      if (summary?.created > 0) {
        const quality = summary?.qualityGovernance;
        setReviewPackAssignMessage(
          `已下发 ${summary.created}/${summary.requested} 条，通知学生 ${summary.studentsNotified} 人，家长 ${summary.parentsNotified} 人。${
            quality && !quality.includeIsolated
              ? ` 已排除隔离池候选 ${quality.isolatedExcludedCount} 次。`
              : ""
          }${(summary?.relaxedCount ?? 0) > 0 ? ` 已自动放宽 ${summary.relaxedCount} 条。` : ""}`
        );
      } else {
        setReviewPackAssignMessage(null);
      }
      if (failed.length > 0) {
        setReviewPackAssignError(failed[0]?.reason ?? "下发失败");
      }
    } catch {
      setReviewPackAssignError("布置失败");
    } finally {
      setReviewPackAssigningId(null);
    }
  }

  async function handleAssignAllReviewSheets() {
    if (!wrongForm.classId) return;
    const items = reviewPackResult?.afterClassReviewSheet ?? [];
    if (!items.length) {
      setReviewPackAssignMessage(null);
      setReviewPackAssignError("暂无可布置的复练单");
      return;
    }
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);
    setReviewPackFailedItems([]);
    setReviewPackRelaxedItems([]);
    setReviewPackAssigningAll(true);

    let summary: any = null;
    let failedItems: any[] = [];
    try {
      const result = await dispatchReviewPackItems(items);
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      summary = result.data?.summary ?? null;
      failedItems = result.data?.failed ?? [];
      setReviewPackFailedItems(failedItems);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
    } catch {
      setReviewPackAssignError("批量下发失败");
      return;
    }

    if ((summary?.created ?? 0) > 0) {
      const quality = summary?.qualityGovernance;
      setReviewPackAssignMessage(
        `已批量下发 ${summary.created}/${summary.requested} 条，通知学生 ${summary.studentsNotified} 人，家长 ${summary.parentsNotified} 人。${
          quality && !quality.includeIsolated ? ` 已排除隔离池候选 ${quality.isolatedExcludedCount} 次。` : ""
        }${(summary?.relaxedCount ?? 0) > 0 ? ` 已自动放宽 ${summary.relaxedCount} 条。` : ""}`
      );
    } else {
      setReviewPackAssignMessage(null);
    }

    if (failedItems.length > 0) {
      const brief = failedItems
        .slice(0, 3)
        .map((item: any) => `${item?.title ?? "未命名复练"}：${item?.reason ?? "下发失败"}`)
        .join("；");
      setReviewPackAssignError(`失败 ${failedItems.length} 条：${brief}`);
    } else {
      setReviewPackAssignError(null);
    }
    setReviewPackAssigningAll(false);
  }

  async function handleRetryFailedReviewSheets() {
    if (!wrongForm.classId || !reviewPackFailedItems.length) return;
    const retryItems = reviewPackFailedItems.map((item: any) => item?.item).filter(Boolean);
    if (!retryItems.length) {
      setReviewPackAssignError("失败项缺少重试参数，请重新生成讲评包后再试。");
      return;
    }

    setReviewPackRetryingFailed(true);
    setReviewPackAssignMessage(null);
    setReviewPackAssignError(null);

    let summary: any = null;
    let failedItems: any[] = [];
    try {
      const result = await dispatchReviewPackItems(retryItems, {
        autoRelaxOnInsufficient: true
      });
      if (!result.ok) {
        setReviewPackAssignError(result.error);
        return;
      }
      summary = result.data?.summary ?? null;
      failedItems = result.data?.failed ?? [];
      setReviewPackFailedItems(failedItems);
      setReviewPackRelaxedItems(summary?.relaxed ?? []);
      setReviewPackDispatchQuality(summary?.qualityGovernance ?? null);
    } catch {
      setReviewPackAssignError("重试失败，请稍后再试");
      return;
    } finally {
      setReviewPackRetryingFailed(false);
    }

    if ((summary?.created ?? 0) > 0) {
      setReviewPackAssignMessage(
        `失败项重试完成：新增下发 ${summary.created}/${summary.requested} 条，自动放宽 ${summary.relaxedCount ?? 0} 条。`
      );
    }

    if (failedItems.length > 0) {
      const brief = failedItems
        .slice(0, 3)
        .map((failedItem: any) => `${failedItem?.title ?? "未命名复练"}：${failedItem?.reason ?? "重试失败"}`)
        .join("；");
      setReviewPackAssignError(`重试后仍失败 ${failedItems.length} 条：${brief}`);
    }
  }

  function renderQualityCard(payload: any) {
    const quality = payload?.quality;
    if (!quality) return null;
    return (
      <div className="card">
        <div className="section-title">AI 质控</div>
        <div className="pill-list" style={{ marginTop: 6 }}>
          <span className="pill">置信度 {quality.confidenceScore ?? 0}</span>
          <span className="pill">风险 {aiRiskLabel(quality.riskLevel)}</span>
          <span className="pill">{quality.needsHumanReview ? "需人工复核" : "可直接使用"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
          兜底建议：{quality.fallbackAction || "可直接使用。"}
        </div>
        {payload?.manualReviewRule ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "#b54708" }}>{payload.manualReviewRule}</div>
        ) : null}
        {quality.reasons?.length ? (
          <ul style={{ margin: "8px 0 0 16px" }}>
            {quality.reasons.map((item: string, index: number) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>AI 教学工具</h2>
          <div className="section-sub">一站式组卷、讲稿与纠错。</div>
        </div>
        <span className="chip">教学助手</span>
      </div>

      <Card title="AI 组卷" tag="组卷">
        <form onSubmit={handleGeneratePaper} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={paperForm.classId}
              onChange={(event) =>
                setPaperForm((prev) => ({ ...prev, classId: event.target.value, knowledgePointIds: [] }))
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">知识点（可多选）</div>
            <select
              multiple
              value={paperForm.knowledgePointIds}
              onChange={(event) =>
                setPaperForm((prev) => ({
                  ...prev,
                  knowledgePointIds: Array.from(event.target.selectedOptions).map((opt) => opt.value)
                }))
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)", height: 140 }}
            >
              {paperPoints.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.unit ? `${item.unit} / ` : ""}
                  {item.chapter} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-2">
            <label>
              <div className="section-title">难度</div>
              <select
                value={paperForm.difficulty}
                onChange={(event) => setPaperForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="all">不限</option>
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">较难</option>
              </select>
            </label>
            <label>
              <div className="section-title">题型</div>
              <select
                value={paperForm.questionType}
                onChange={(event) => setPaperForm((prev) => ({ ...prev, questionType: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="all">不限</option>
                <option value="choice">选择题</option>
                <option value="application">应用题</option>
                <option value="calculation">计算题</option>
              </select>
            </label>
          </div>
          <div className="grid grid-3">
            <label>
              <div className="section-title">考试时长（分钟）</div>
              <input
                type="number"
                min={10}
                max={120}
                value={paperForm.durationMinutes}
                onChange={(event) =>
                  setPaperForm((prev) => ({ ...prev, durationMinutes: Number(event.target.value) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">题目数量（可选）</div>
              <input
                type="number"
                min={0}
                max={50}
                value={paperForm.questionCount}
                onChange={(event) =>
                  setPaperForm((prev) => ({ ...prev, questionCount: Number(event.target.value) }))
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">出题方式</div>
              <select
                value={paperForm.mode}
                onChange={(event) => setPaperForm((prev) => ({ ...prev, mode: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="bank">题库抽题</option>
                <option value="ai">AI 生成</option>
              </select>
            </label>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={paperForm.includeIsolated}
              onChange={(event) => setPaperForm((prev) => ({ ...prev, includeIsolated: event.target.checked }))}
            />
            <span>允许使用隔离池高风险题（默认关闭）</span>
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "生成中..." : "生成试卷"}
          </button>
        </form>

        {paperResult ? (
          <div style={{ marginTop: 12 }} className="grid" aria-live="polite">
            <div className="badge">生成题目 {paperResult.count} 道</div>
            {paperResult.qualityGovernance ? (
              <div className="pill-list">
                <span className="pill">可用题池 {paperResult.qualityGovernance.activePoolCount}</span>
                <span className="pill">隔离池总量 {paperResult.qualityGovernance.isolatedPoolCount}</span>
                <span className="pill">本次排除 {paperResult.qualityGovernance.isolatedExcludedCount}</span>
                <span className="pill">
                  {paperResult.qualityGovernance.includeIsolated ? "允许隔离池" : "排除隔离池"}
                </span>
                {paperResult.qualityGovernance.shortfallCount ? (
                  <span className="pill">缺口 {paperResult.qualityGovernance.shortfallCount}</span>
                ) : null}
                {paperResult.qualityGovernance.qualityGovernanceDegraded ? (
                  <span className="pill">质检降级（质量表不可用）</span>
                ) : null}
              </div>
            ) : null}
            <div className="grid" style={{ gap: 10, marginTop: 10 }}>
              {paperResult.questions.map((item, index) => (
                <div className="card" key={item.id}>
                  <div className="section-title">
                    {index + 1}. <MathText text={item.stem} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    {item.unit ? `${item.unit} / ` : ""}
                    {item.chapter} · {item.knowledgePointTitle} · {item.source === "ai" ? "AI 生成" : "题库"}
                  </div>
                  <ul style={{ margin: "8px 0 0 16px" }}>
                    {item.options.map((opt) => (
                      <li key={opt}>
                        <MathText text={opt} />
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    答案：<MathText text={item.answer} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {paperError ? <div className="status-note error">{paperError}</div> : null}
      </Card>

      <Card title="AI 课堂讲稿生成" tag="讲稿">
        <form onSubmit={handleGenerateOutline} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={outlineForm.classId}
              onChange={(event) =>
                setOutlineForm((prev) => ({ ...prev, classId: event.target.value, knowledgePointIds: [] }))
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">主题</div>
            <input
              value={outlineForm.topic}
              onChange={(event) => setOutlineForm((prev) => ({ ...prev, topic: event.target.value }))}
              placeholder="例如：分数的意义与比较"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">关联知识点（可选）</div>
            <select
              multiple
              value={outlineForm.knowledgePointIds}
              onChange={(event) =>
                setOutlineForm((prev) => ({
                  ...prev,
                  knowledgePointIds: Array.from(event.target.selectedOptions).map((opt) => opt.value)
                }))
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)", height: 120 }}
            >
              {outlinePoints.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.chapter} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "生成中..." : "生成讲稿"}
          </button>
        </form>
        {outlineError ? <div className="status-note error" style={{ marginTop: 8 }}>{outlineError}</div> : null}

        {outlineResult?.outline ? (
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <div className="card">
              <div className="section-title">教学目标</div>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {outlineResult.outline.objectives?.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="section-title">重点难点</div>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {outlineResult.outline.keyPoints?.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="section-title">PPT 大纲</div>
              <div className="grid" style={{ gap: 8 }}>
                {outlineResult.outline.slides?.map((slide: any, index: number) => (
                  <div key={`${slide.title}-${index}`}>
                    <div style={{ fontWeight: 600 }}>{slide.title}</div>
                    <ul style={{ margin: "4px 0 0 16px" }}>
                      {slide.bullets?.map((b: string) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="section-title">板书步骤</div>
              <ol style={{ margin: "8px 0 0 16px" }}>
                {outlineResult.outline.blackboardSteps?.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            {renderQualityCard(outlineResult)}
          </div>
        ) : null}
      </Card>

      <Card title="AI 错题讲评课脚本" tag="讲评">
        <form onSubmit={handleWrongReview} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={wrongForm.classId}
              onChange={(event) => setWrongForm((prev) => ({ ...prev, classId: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">统计范围（天）</div>
            <input
              type="number"
              min={3}
              max={60}
              value={wrongForm.rangeDays}
              onChange={(event) => setWrongForm((prev) => ({ ...prev, rangeDays: Number(event.target.value) }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "生成中..." : "生成讲评脚本"}
          </button>
        </form>
        {wrongError ? <div className="status-note error" style={{ marginTop: 8 }}>{wrongError}</div> : null}

        {wrongResult?.script ? (
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <div className="card">
              <div className="section-title">高频错题知识点</div>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {wrongResult.wrongPoints?.map((item: any) => (
                  <li key={item.kpId}>
                    {item.title} · 错题 {item.count} 次
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="section-title">讲评课流程</div>
              <ol style={{ margin: "8px 0 0 16px" }}>
                {wrongResult.script.agenda?.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <div className="card">
              <div className="section-title">讲评话术</div>
              <div className="grid" style={{ gap: 8 }}>
                {wrongResult.script.script?.map((item: string) => (
                  <MathText as="div" key={item} text={item} />
                ))}
              </div>
            </div>
            <div className="card">
              <div className="section-title">重点提醒</div>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {wrongResult.script.reminders?.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {renderQualityCard(wrongResult)}
          </div>
        ) : null}
      </Card>

      <Card title="班级共性错因讲评包" tag="讲评包">
        <form onSubmit={handleReviewPack} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">选择班级</div>
            <select
              value={wrongForm.classId}
              onChange={(event) => setWrongForm((prev) => ({ ...prev, classId: event.target.value }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">统计范围（天）</div>
            <input
              type="number"
              min={3}
              max={60}
              value={wrongForm.rangeDays}
              onChange={(event) => setWrongForm((prev) => ({ ...prev, rangeDays: Number(event.target.value) }))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "生成中..." : "生成讲评包"}
          </button>
        </form>
        {reviewPackError ? <div className="status-note error" style={{ marginTop: 8 }}>{reviewPackError}</div> : null}

        {reviewPackResult ? (
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            {reviewPackResult.qualityGovernance ? (
              <div className="card">
                <div className="section-title">题库质量治理联动</div>
                <div className="pill-list" style={{ marginTop: 8 }}>
                  <span className="pill">
                    错题去重覆盖 {reviewPackResult.qualityGovernance.trackedWrongQuestionCount}/
                    {reviewPackResult.qualityGovernance.totalWrongQuestionCount}
                  </span>
                  <span className="pill">高风险错题 {reviewPackResult.qualityGovernance.highRiskWrongCount}</span>
                  <span className="pill">隔离池命中 {reviewPackResult.qualityGovernance.isolatedWrongCount}</span>
                </div>
                {reviewPackResult.qualityGovernance.recommendedAction ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#b54708" }}>
                    {reviewPackResult.qualityGovernance.recommendedAction}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="card">
              <div className="section-title">共性错因统计</div>
              {(reviewPackResult.commonCauseStats ?? []).length ? (
                <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                  {(reviewPackResult.commonCauseStats ?? []).map((item: any) => (
                    <div className="card" key={item.causeKey}>
                      <div className="section-title">
                        {item.causeTitle} · {item.level}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        错题 {item.count} 次，占比 {item.ratio}%
                      </div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        关联知识点：
                        {(item.linkedKnowledgePoints ?? []).length
                          ? item.linkedKnowledgePoints
                              .map((kp: any) => kp.title)
                              .join("、")
                          : "暂无"}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        讲评策略：{item.remediationTip}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, color: "var(--ink-1)" }}>
                        课堂动作：{item.classAction}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>暂无可统计的共性错因。</div>
              )}
            </div>
            <div className="card">
              <div className="section-title">讲评顺序</div>
              <ol style={{ margin: "8px 0 0 16px" }}>
                {(reviewPackResult.reviewOrder ?? []).map((item: any) => (
                  <li key={`${item.order}-${item.knowledgePointId}`}>
                    {item.title} · 错题占比 {item.wrongRatio}% · {item.teachFocus}
                  </li>
                ))}
              </ol>
            </div>
            <div className="card">
              <div className="section-title">例题清单</div>
              {Boolean((reviewPackResult.exemplarQuestions ?? []).some((item: any) => item?.isolated)) ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b54708" }}>
                  检测到隔离池命中示例题，建议课堂讲评优先改用低风险变式题。
                </div>
              ) : null}
              <ul style={{ margin: "8px 0 0 16px" }}>
                {(reviewPackResult.exemplarQuestions ?? []).map((item: any) => (
                  <li key={`${item.knowledgePointId}-${item.questionId ?? "fallback"}`}>
                    {item.title}：<MathText text={item.stem} />
                    {item.questionId ? (
                      <div className="pill-list" style={{ marginTop: 4 }}>
                        <span className="pill">风险 {aiRiskLabel(item.qualityRiskLevel)}</span>
                        <span className="pill">{item.isolated ? "隔离池命中" : "可直接使用"}</span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="section-title">课堂任务</div>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {(reviewPackResult.classTasks ?? []).map((item: any) => (
                  <li key={item.id}>
                    {item.title}：{item.instruction}（目标：{item.target}）
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="section-title">课后复练单</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={reviewPackDispatchIncludeIsolated}
                  onChange={(event) => setReviewPackDispatchIncludeIsolated(event.target.checked)}
                />
                <span>下发时允许使用隔离池高风险题（默认关闭）</span>
              </label>
              <div className="cta-row" style={{ marginTop: 8 }}>
                <button
                  className="button primary"
                  type="button"
                  disabled={reviewPackAssigningAll || reviewPackRetryingFailed || !(reviewPackResult.afterClassReviewSheet ?? []).length}
                  onClick={handleAssignAllReviewSheets}
                >
                  {reviewPackAssigningAll ? "批量布置中..." : "一键布置全部复练单"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={reviewPackAssigningAll || reviewPackRetryingFailed || !reviewPackFailedItems.length}
                  onClick={handleRetryFailedReviewSheets}
                >
                  {reviewPackRetryingFailed ? "重试中..." : `重试失败项（${reviewPackFailedItems.length}）`}
                </button>
              </div>
              <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                {(reviewPackResult.afterClassReviewSheet ?? []).map((item: any) => (
                  <div className="card" key={item.id}>
                    <div className="section-title">{item.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      建议 {item.suggestedCount} 题，{item.dueInDays} 天内完成
                    </div>
                    <div className="cta-row" style={{ marginTop: 8 }}>
                      <button
                        className="button ghost"
                        type="button"
                        disabled={reviewPackAssigningAll || reviewPackRetryingFailed || reviewPackAssigningId === item.id}
                        onClick={() => handleAssignReviewSheet(item)}
                      >
                        {reviewPackAssigningId === item.id ? "布置中..." : "一键布置该条复练"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {reviewPackAssignMessage ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#027a48" }}>{reviewPackAssignMessage}</div>
              ) : null}
              {reviewPackAssignError ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b42318" }}>{reviewPackAssignError}</div>
              ) : null}
              {reviewPackFailedItems.length ? (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="section-title">下发失败清单</div>
                  <ul style={{ margin: "8px 0 0 16px" }}>
                    {reviewPackFailedItems.slice(0, 8).map((item: any, index: number) => (
                      <li key={`${item?.itemId ?? item?.title ?? "failed"}-${index}`}>
                        {(item?.title ?? "未命名复练")}：{item?.reason ?? "下发失败"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {reviewPackRelaxedItems.length ? (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="section-title">自动放宽记录</div>
                  <ul style={{ margin: "8px 0 0 16px" }}>
                    {reviewPackRelaxedItems.slice(0, 8).map((item: any, index: number) => (
                      <li key={`${item?.itemId ?? item?.title ?? "relaxed"}-${index}`}>
                        {(item?.title ?? "未命名复练")}：{item?.reason ?? "已自动放宽条件"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {reviewPackDispatchQuality ? (
                <div className="pill-list" style={{ marginTop: 8 }}>
                  <span className="pill">
                    {reviewPackDispatchQuality.includeIsolated ? "允许隔离池抽题" : "排除隔离池抽题"}
                  </span>
                  <span className="pill">班级隔离池题量 {reviewPackDispatchQuality.isolatedPoolCount}</span>
                  <span className="pill">候选排除 {reviewPackDispatchQuality.isolatedExcludedCount}</span>
                  {reviewPackDispatchQuality.includeIsolated ? (
                    <span className="pill">命中隔离池 {reviewPackDispatchQuality.selectedIsolatedCount}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {renderQualityCard(reviewPackResult)}
          </div>
        ) : null}
      </Card>

      <Card title="AI 题库纠错" tag="质检">
        <form onSubmit={handleCheckQuestion} style={{ display: "grid", gap: 12 }}>
          <label>
            <div className="section-title">题目 ID（可选，自动读取题库）</div>
            <input
              value={checkForm.questionId}
              onChange={(event) => setCheckForm((prev) => ({ ...prev, questionId: event.target.value }))}
              placeholder="q-xxx"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">题干</div>
            <textarea
              value={checkForm.stem}
              onChange={(event) => setCheckForm((prev) => ({ ...prev, stem: event.target.value }))}
              rows={3}
              placeholder="若不填写题目 ID，请手动填写题干"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <div className="grid grid-2">
            {checkForm.options.map((opt, index) => (
              <input
                key={`opt-${index}`}
                value={opt}
                onChange={(event) => {
                  const next = [...checkForm.options];
                  next[index] = event.target.value;
                  setCheckForm((prev) => ({ ...prev, options: next }));
                }}
                placeholder={`选项 ${index + 1}`}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            ))}
          </div>
          <label>
            <div className="section-title">答案</div>
            <input
              value={checkForm.answer}
              onChange={(event) => setCheckForm((prev) => ({ ...prev, answer: event.target.value }))}
              placeholder="正确答案"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">解析</div>
            <textarea
              value={checkForm.explanation}
              onChange={(event) => setCheckForm((prev) => ({ ...prev, explanation: event.target.value }))}
              rows={2}
              placeholder="题目解析（可选）"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? "检查中..." : "开始纠错"}
          </button>
        </form>
        {checkError ? <div className="status-note error" style={{ marginTop: 8 }}>{checkError}</div> : null}

        {checkResult ? (
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            <div className="badge">风险等级：{checkResult.risk ?? "low"}</div>
            {checkResult.issues?.length ? (
              <ul style={{ margin: "6px 0 0 16px" }}>
                {checkResult.issues.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>未发现明显问题。</p>
            )}
            {checkResult.suggestedAnswer ? <div>建议答案：{checkResult.suggestedAnswer}</div> : null}
            {checkResult.notes ? <div style={{ fontSize: 12 }}>{checkResult.notes}</div> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
