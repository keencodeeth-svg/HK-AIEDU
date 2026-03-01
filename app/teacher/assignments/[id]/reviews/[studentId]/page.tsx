"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import MathViewControls from "@/components/MathViewControls";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";

type ReviewPayload = {
  assignment: { id: string; title: string; dueDate: string; submissionType?: "quiz" | "upload" | "essay" };
  class: { id: string; name: string; subject: string; grade: string };
  student: { id: string; name: string; email: string };
  submission?: { answers: Record<string, string>; score: number; total: number; submissionText?: string } | null;
  uploads?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    contentBase64: string;
    createdAt: string;
  }>;
  aiReview?: { result?: any; provider?: string } | null;
  questions: Array<{
    id: string;
    stem: string;
    options: string[];
    answer: string;
    correctAnswer: string;
    explanation: string;
    correct: boolean;
  }>;
  review: { overallComment?: string } | null;
  reviewItems: Array<{ questionId: string; wrongTag?: string; comment?: string }>;
  rubrics: Array<{
    id: string;
    title: string;
    description?: string;
    levels?: Array<{ label: string; score: number; description: string }>;
    maxScore: number;
    weight: number;
  }>;
  reviewRubrics: Array<{ rubricId: string; score: number; comment?: string }>;
};

const tags = ["审题错误", "计算错误", "概念混淆", "步骤遗漏", "粗心", "其他"];

export default function TeacherAssignmentReviewPage({
  params
}: {
  params: { id: string; studentId: string };
}) {
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [overallComment, setOverallComment] = useState("");
  const [itemState, setItemState] = useState<Record<string, { wrongTag: string; comment: string }>>({});
  const [rubricState, setRubricState] = useState<Record<string, { score: number; comment: string }>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<any>(null);
  const mathView = useMathViewSettings("teacher-assignment-review");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/teacher/assignments/${params.id}/reviews/${params.studentId}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载失败");
      return;
    }
    setData(payload);
    setOverallComment(payload.review?.overallComment ?? "");
    const nextState: Record<string, { wrongTag: string; comment: string }> = {};
    payload.reviewItems?.forEach((item: any) => {
      nextState[item.questionId] = { wrongTag: item.wrongTag ?? "", comment: item.comment ?? "" };
    });
    setItemState(nextState);
    const rubricMap: Record<string, { score: number; comment: string }> = {};
    payload.reviewRubrics?.forEach((item: any) => {
      rubricMap[item.rubricId] = { score: Number(item.score ?? 0), comment: item.comment ?? "" };
    });
    payload.rubrics?.forEach((rubric: any) => {
      if (!rubricMap[rubric.id]) {
        rubricMap[rubric.id] = { score: 0, comment: "" };
      }
    });
    setRubricState(rubricMap);
    setAiReview(payload.aiReview?.result ?? null);
  }, [params.id, params.studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const wrongQuestions = useMemo(
    () => (data?.questions ?? []).filter((item) => !item.correct),
    [data]
  );
  const canAiReview =
    (data?.uploads?.length ?? 0) > 0 || Boolean(data?.submission?.submissionText?.trim());
  const isEssay = data?.assignment?.submissionType === "essay";
  const isUpload = data?.assignment?.submissionType === "upload";
  const isQuiz = !isEssay && !isUpload;

  async function handleAiReview() {
    if (!data) return;
    setAiLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/teacher/assignments/${params.id}/ai-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: params.studentId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "AI 批改失败");
      setAiLoading(false);
      return;
    }
    setAiReview(payload?.data?.result ?? null);
    setAiLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const items = wrongQuestions.map((question) => ({
      questionId: question.id,
      wrongTag: itemState[question.id]?.wrongTag || "",
      comment: itemState[question.id]?.comment || ""
    }));
    const rubrics = (data?.rubrics ?? []).map((rubric) => ({
      rubricId: rubric.id,
      score: rubricState[rubric.id]?.score ?? 0,
      comment: rubricState[rubric.id]?.comment ?? ""
    }));
    const res = await fetch(`/api/teacher/assignments/${params.id}/reviews/${params.studentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overallComment, items, rubrics })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "保存失败");
      setSaving(false);
      return;
    }
    setMessage("批改已保存并通知学生。");
    setSaving(false);
  }

  if (error) {
    return (
      <Card title="作业批改">
        <p>{error}</p>
        <Link className="button secondary" href={`/teacher/assignments/${params.id}`} style={{ marginTop: 12 }}>
          返回作业详情
        </Link>
      </Card>
    );
  }

  if (!data) {
    return <Card title="作业批改">加载中...</Card>;
  }

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>作业批改</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">学生：{data.student.name}</span>
      </div>
      <MathViewControls
        fontScale={mathView.fontScale}
        lineMode={mathView.lineMode}
        onDecrease={mathView.decreaseFontScale}
        onIncrease={mathView.increaseFontScale}
        onReset={mathView.resetView}
        onLineModeChange={mathView.setLineMode}
      />

      <Card title="作业概览" tag="概览">
        <div className="grid grid-2">
          <div className="card feature-card">
            <EduIcon name="board" />
            <div className="section-title">{data.assignment.title}</div>
            <p>截止日期：{new Date(data.assignment.dueDate).toLocaleDateString("zh-CN")}</p>
          </div>
          <div className="card feature-card">
            <EduIcon name="chart" />
            <div className="section-title">作业成绩</div>
            <p>{isQuiz ? `得分：${data.submission?.score ?? 0}/${data.submission?.total ?? 0}` : "待评分"}</p>
            <div className="pill-list">
              <span className="pill">错题 {wrongQuestions.length} 题</span>
              <span className="pill">{ASSIGNMENT_TYPE_LABELS[data.assignment.submissionType ?? "quiz"]}</span>
            </div>
            {data.submission?.submissionText ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>
                {isEssay ? "作文内容" : "学生备注"}：{data.submission.submissionText}
              </div>
            ) : null}
          </div>
        </div>
        <Link className="button ghost" href={`/teacher/assignments/${params.id}`} style={{ marginTop: 12 }}>
          返回作业详情
        </Link>
      </Card>

      {data.uploads?.length ? (
        <Card title="学生上传作业" tag="附件">
          <div className="grid" style={{ gap: 10 }}>
            {data.uploads.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.fileName}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  {Math.round(item.size / 1024)} KB · {new Date(item.createdAt).toLocaleString("zh-CN")}
                </div>
                {item.mimeType.startsWith("image/") ? (
                  <Image
                    src={`data:${item.mimeType};base64,${item.contentBase64}`}
                    alt={item.fileName}
                    width={640}
                    height={420}
                    sizes="(max-width: 768px) 100vw, 420px"
                    style={{ width: "100%", height: "auto", maxWidth: 420, marginTop: 8, borderRadius: 12 }}
                    unoptimized
                  />
                ) : (
                  <a
                    href={`data:${item.mimeType};base64,${item.contentBase64}`}
                    download={item.fileName}
                    style={{ marginTop: 8, display: "inline-block" }}
                  >
                    下载附件
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {data.submission?.submissionText ? (
        <Card title={isEssay ? "作文内容" : "学生作答说明"} tag="文本">
          <div className="card">
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{data.submission.submissionText}</div>
          </div>
        </Card>
      ) : null}

      <Card title="AI 批改" tag="AI">
        <div className="cta-row">
          <button className="button primary" type="button" onClick={handleAiReview} disabled={aiLoading || !canAiReview}>
            {aiLoading ? "批改中..." : "生成 AI 批改"}
          </button>
        </div>
        {!canAiReview ? <p style={{ marginTop: 8, color: "var(--ink-1)" }}>学生尚未提交作业内容。</p> : null}
        {aiReview ? (
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            <div className="card">
              <div className="section-title">综合评分</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{aiReview.score ?? 0} 分</div>
              <p style={{ marginTop: 8 }}>{aiReview.summary ?? "暂无总结。"}</p>
            </div>
            {aiReview.strengths?.length ? (
              <div className="card">
                <div className="section-title">优点</div>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {aiReview.strengths.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiReview.issues?.length ? (
              <div className="card">
                <div className="section-title">问题</div>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {aiReview.issues.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiReview.suggestions?.length ? (
              <div className="card">
                <div className="section-title">改进建议</div>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {aiReview.suggestions.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiReview.rubric?.length ? (
              <div className="card">
                <div className="section-title">评分维度</div>
                <div className="grid" style={{ gap: 8, marginTop: 6 }}>
                  {aiReview.rubric.map((item: any) => (
                    <div key={item.item}>
                      {item.item}：{item.score} 分 · {item.comment}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {aiReview.writing ? (
              <div className="card">
                <div className="section-title">写作评分</div>
                <div className="pill-list" style={{ marginTop: 8 }}>
                  <span className="pill">结构 {aiReview.writing.scores?.structure ?? 0}</span>
                  <span className="pill">语法 {aiReview.writing.scores?.grammar ?? 0}</span>
                  <span className="pill">词汇 {aiReview.writing.scores?.vocab ?? 0}</span>
                </div>
                <p style={{ marginTop: 8 }}>{aiReview.writing.summary ?? "暂无写作总结。"}</p>
                {aiReview.writing.strengths?.length ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="section-title">写作优点</div>
                    <ul style={{ margin: "6px 0 0 16px" }}>
                      {aiReview.writing.strengths.map((item: string) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {aiReview.writing.improvements?.length ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="section-title">改进建议</div>
                    <ul style={{ margin: "6px 0 0 16px" }}>
                      {aiReview.writing.improvements.map((item: string) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {aiReview.writing.corrected ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="section-title">修改示例</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{aiReview.writing.corrected}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p style={{ marginTop: 8, color: "var(--ink-1)" }}>暂无 AI 批改结果。</p>
        )}
      </Card>

      <Card title="错题复盘" tag="批改">
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {!isQuiz ? (
            <p>该作业为{isEssay ? "作文/主观题" : "上传作业"}，请结合附件与 AI 批改结果进行点评。</p>
          ) : wrongQuestions.length === 0 ? (
            <p>该学生全部答对，可补充总体点评。</p>
          ) : null}
          {isQuiz
            ? wrongQuestions.map((question, index) => (
                <div className="card" key={question.id}>
                  <div className="section-title">
                    {index + 1}. <MathText text={question.stem} showCopyActions />
                  </div>
                  <div className="pill-list" style={{ marginTop: 8 }}>
                    <span className="pill">
                      学生答案：<MathText text={question.answer || "未作答"} />
                    </span>
                    <span className="pill">
                      正确答案：<MathText text={question.correctAnswer} />
                    </span>
                  </div>
                  <p style={{ marginTop: 8 }}>
                    解析：<MathText text={question.explanation} showCopyActions />
                  </p>
                  <label>
                    <div className="section-title">错因标签</div>
                    <select
                      value={itemState[question.id]?.wrongTag ?? ""}
                      onChange={(event) =>
                        setItemState((prev) => ({
                          ...prev,
                          [question.id]: { wrongTag: event.target.value, comment: prev[question.id]?.comment ?? "" }
                        }))
                      }
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    >
                      <option value="">请选择</option>
                      {tags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="section-title">点评</div>
                    <textarea
                      value={itemState[question.id]?.comment ?? ""}
                      onChange={(event) =>
                        setItemState((prev) => ({
                          ...prev,
                          [question.id]: { wrongTag: prev[question.id]?.wrongTag ?? "", comment: event.target.value }
                        }))
                      }
                      rows={3}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    />
                  </label>
                </div>
              ))
            : null}
          <label>
            <div className="section-title">总体点评</div>
            <textarea
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          {data.rubrics?.length ? (
            <div className="card" style={{ display: "grid", gap: 12 }}>
              <div className="section-title">评分维度（Rubric）</div>
              {data.rubrics.map((rubric) => (
                <div className="card" key={rubric.id}>
                  <div className="section-title">{rubric.title}</div>
                  {rubric.description ? (
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{rubric.description}</div>
                  ) : null}
                  <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 4 }}>
                    权重 {rubric.weight} · 满分 {rubric.maxScore}
                  </div>
                  {rubric.levels?.length ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="section-sub">分档参考</div>
                      <div className="grid" style={{ gap: 6, marginTop: 6 }}>
                        {rubric.levels.map((level, index) => (
                          <div key={`${rubric.id}-level-${index}`} className="card">
                            <div className="section-title">
                              {level.label}（{level.score}）
                            </div>
                            <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{level.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <label>
                      <div className="section-title">评分（满分 {rubric.maxScore}）</div>
                      <input
                        type="number"
                        min={0}
                        max={rubric.maxScore}
                        value={rubricState[rubric.id]?.score ?? 0}
                        onChange={(event) =>
                          setRubricState((prev) => ({
                            ...prev,
                            [rubric.id]: {
                              score: Number(event.target.value),
                              comment: prev[rubric.id]?.comment ?? ""
                            }
                          }))
                        }
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                      />
                    </label>
                    <label>
                      <div className="section-title">点评</div>
                      <textarea
                        value={rubricState[rubric.id]?.comment ?? ""}
                        onChange={(event) =>
                          setRubricState((prev) => ({
                            ...prev,
                            [rubric.id]: {
                              score: prev[rubric.id]?.score ?? 0,
                              comment: event.target.value
                            }
                          }))
                        }
                        rows={2}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--ink-1)" }}>该作业暂无评分维度，可直接填写总体点评。</p>
          )}
          {message ? <div style={{ color: "#1a7f37", fontSize: 13 }}>{message}</div> : null}
          {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存批改"}
          </button>
        </form>
      </Card>
    </div>
  );
}
