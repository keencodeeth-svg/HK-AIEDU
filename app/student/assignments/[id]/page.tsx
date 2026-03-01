"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import MathViewControls from "@/components/MathViewControls";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";

type AssignmentDetail = {
  assignment: {
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    createdAt: string;
    submissionType?: "quiz" | "upload" | "essay";
    maxUploads?: number;
    gradingFocus?: string;
  };
  module?: { id: string; title: string } | null;
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  questions: Array<{
    id: string;
    stem: string;
    options: string[];
  }>;
  progress?: {
    status: string;
    score?: number;
    total?: number;
  } | null;
};

type SubmitResult = {
  score: number;
  total: number;
  details: Array<{
    questionId: string;
    correct: boolean;
    answer: string;
    correctAnswer: string;
    explanation: string;
  }>;
};

type UploadItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  contentBase64?: string;
};

export default function StudentAssignmentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mathView = useMathViewSettings("student-assignment");

  const loadUploads = useCallback(async () => {
    const res = await fetch(`/api/student/assignments/${params.id}/uploads`);
    const payload = await res.json();
    if (res.ok) {
      setUploads(payload.data ?? []);
    }
  }, [params.id]);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/student/assignments/${params.id}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载失败");
      return;
    }
    setData(payload);
    if (payload?.progress?.status === "completed") {
      const reviewRes = await fetch(`/api/student/assignments/${params.id}/review`);
      const reviewPayload = await reviewRes.json();
      if (reviewRes.ok) {
        setReview(reviewPayload);
      }
    }
    if (payload?.assignment?.submissionType === "upload" || payload?.assignment?.submissionType === "essay") {
      loadUploads();
    }
  }, [loadUploads, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const res = await fetch(`/api/student/assignments/${params.id}/uploads`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const payload = await res.json();
      setError(payload?.error ?? "上传失败");
    } else {
      await loadUploads();
    }
    setUploading(false);
    event.target.value = "";
  }

  async function handleDeleteUpload(uploadId: string) {
    await fetch(`/api/student/assignments/${params.id}/uploads?uploadId=${uploadId}`, { method: "DELETE" });
    loadUploads();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/assignments/${params.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, submissionText })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "提交失败");
      }
      setResult(payload);
      const reviewRes = await fetch(`/api/student/assignments/${params.id}/review`);
      const reviewPayload = await reviewRes.json();
      if (reviewRes.ok) {
        setReview(reviewPayload);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <Card title="作业详情">
        <p>{error}</p>
        <Link className="button secondary" href="/student/assignments" style={{ marginTop: 12 }}>
          返回作业中心
        </Link>
      </Card>
    );
  }

  if (!data) {
    return <Card title="作业详情">加载中...</Card>;
  }

  const alreadyCompleted = data.progress?.status === "completed" && !result;
  const isUpload = data.assignment.submissionType === "upload";
  const isEssay = data.assignment.submissionType === "essay";
  const isQuiz = !isUpload && !isEssay;
  const hasUploads = uploads.length > 0;
  const hasText = Boolean(submissionText.trim());

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>作业详情</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">{alreadyCompleted ? "已完成" : "进行中"}</span>
      </div>
      <MathViewControls
        fontScale={mathView.fontScale}
        lineMode={mathView.lineMode}
        onDecrease={mathView.decreaseFontScale}
        onIncrease={mathView.increaseFontScale}
        onReset={mathView.resetView}
        onLineModeChange={mathView.setLineMode}
      />

      <Card title="作业信息" tag="概览">
        <div className="grid grid-2">
          <div className="card feature-card">
            <EduIcon name="board" />
            <div className="section-title">{data.assignment.title}</div>
            <p>{data.assignment.description || "暂无作业说明。"}</p>
            {data.assignment.gradingFocus ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                批改重点：{data.assignment.gradingFocus}
              </div>
            ) : null}
            {data.module ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                关联模块：{data.module.title}
              </div>
            ) : null}
          </div>
          <div className="card feature-card">
            <EduIcon name="chart" />
            <div className="section-title">截止日期</div>
            <p>{new Date(data.assignment.dueDate).toLocaleDateString("zh-CN")}</p>
            {data.progress?.status === "completed" ? (
              <div className="pill-list">
                {isUpload || isEssay ? (
                  <span className="pill">已提交待批改</span>
                ) : (
                  <span className="pill">
                    得分 {data.progress?.score ?? 0}/{data.progress?.total ?? 0}
                  </span>
                )}
                <span className="pill">{ASSIGNMENT_TYPE_LABELS[data.assignment.submissionType ?? "quiz"]}</span>
              </div>
            ) : (
              <div className="pill-list">
                <span className="pill">等待提交</span>
                <span className="pill">{ASSIGNMENT_TYPE_LABELS[data.assignment.submissionType ?? "quiz"]}</span>
              </div>
            )}
          </div>
        </div>
        <Link className="button ghost" href="/student/assignments" style={{ marginTop: 12 }}>
          返回作业中心
        </Link>
      </Card>

      <Card title="作业作答" tag="作答">
        {alreadyCompleted ? (
          isUpload || isEssay ? (
            <div className="grid" style={{ gap: 10 }}>
              <p>已提交作业，等待老师批改。</p>
              {review?.submission?.submissionText ? (
                <div className="card">
                  <div className="section-title">{isEssay ? "作文内容" : "作业备注"}</div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{review.submission.submissionText}</div>
                </div>
              ) : null}
              {uploads.length ? (
                uploads.map((item) => (
                  <div className="card" key={item.id}>
                    <div className="section-title">{item.fileName}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      {Math.round(item.size / 1024)} KB · {new Date(item.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                ))
              ) : (
                <p>暂无上传记录。</p>
              )}
            </div>
          ) : (
            <p>已提交作业，如需再次练习可联系老师重新布置。</p>
          )
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            {isUpload || isEssay ? (
              <div className="grid" style={{ gap: 12 }}>
                <div className="card">
                  <div className="section-title">{isEssay ? "上传作业图片（可选）" : "上传作业"}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    支持图片或 PDF，最多 {data.assignment.maxUploads ?? 3} 份，每份不超过 3MB。
                  </div>
                  <input type="file" multiple onChange={handleUpload} disabled={uploading} />
                  {uploads.length ? (
                    <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                      {uploads.map((item) => (
                        <div className="card" key={item.id}>
                          <div className="section-title">{item.fileName}</div>
                          <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                            {Math.round(item.size / 1024)} KB · {new Date(item.createdAt).toLocaleString("zh-CN")}
                          </div>
                          <div className="cta-row" style={{ marginTop: 8 }}>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => handleDeleteUpload(item.id)}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ marginTop: 8 }}>尚未上传任何作业。</p>
                  )}
                </div>
                <label>
                  <div className="section-title">{isEssay ? "作文内容" : "作业备注（可选）"}</div>
                  <textarea
                    value={submissionText}
                    onChange={(event) => setSubmissionText(event.target.value)}
                    rows={isEssay ? 10 : 3}
                    placeholder={isEssay ? "请在此输入作文/主观题作答内容" : "写下本次作业的思路或遇到的问题"}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  />
                </label>
              </div>
            ) : (
              data.questions.map((question, index) => (
                <div className="card" key={question.id}>
                  <div className="section-title">
                    {index + 1}. <MathText text={question.stem} showCopyActions />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {question.options.map((option) => (
                      <label key={option} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={(event) =>
                            setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
                          }
                        />
                        <MathText text={option} />
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
            {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
            {isUpload && !hasUploads ? (
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>请先上传作业文件。</div>
            ) : null}
            <button
              className="button primary"
              type="submit"
              disabled={loading || (isUpload && !hasUploads) || (isEssay && !hasUploads && !hasText)}
            >
              {loading ? "提交中..." : "提交作业"}
            </button>
          </form>
        )}
      </Card>

      {result && isQuiz ? (
        <Card title="提交结果" tag="成绩">
          <div className="pill-list">
            <span className="pill">
              得分 {result.score}/{result.total}
            </span>
          </div>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            {result.details.map((detail) => {
              const question = data.questions.find((item) => item.id === detail.questionId);
              return (
                <div className="card" key={detail.questionId}>
                  <div className="section-title">
                    <MathText text={question?.stem ?? "题目"} showCopyActions />
                  </div>
                  <div className="pill-list" style={{ marginTop: 8 }}>
                    <span className="pill">
                      你的答案：<MathText text={detail.answer || "未作答"} />
                    </span>
                    <span className="pill">
                      正确答案：<MathText text={detail.correctAnswer} />
                    </span>
                    <span className="pill">{detail.correct ? "回答正确" : "回答错误"}</span>
                  </div>
                  <p style={{ marginTop: 8 }}>
                    解析：<MathText text={detail.explanation} showCopyActions />
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {result && (isUpload || isEssay) ? (
        <Card title="提交结果" tag="已提交">
          <p>作业已提交，等待老师批改。</p>
        </Card>
      ) : null}

      {review?.review ? (
        <Card title="老师点评" tag="点评">
          <p>{review.review.overallComment || "暂无总体点评"}</p>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            {(review.reviewItems ?? []).map((item: any) => {
              const question = review.questions?.find((q: any) => q.id === item.questionId);
              return (
                <div className="card" key={item.questionId}>
                  <div className="section-title">
                    <MathText text={question?.stem ?? "题目"} showCopyActions />
                  </div>
                  <div className="pill-list" style={{ marginTop: 8 }}>
                    <span className="pill">错因标签：{item.wrongTag || "未标注"}</span>
                  </div>
                  <p style={{ marginTop: 8 }}>点评：{item.comment || "暂无"}</p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {review?.rubrics?.length ? (
        <Card title="评分维度" tag="Rubric">
          <div className="grid" style={{ gap: 12 }}>
            {review.rubrics.map((rubric: any) => {
              const record = (review.reviewRubrics ?? []).find((item: any) => item.rubricId === rubric.id);
              return (
                <div className="card" key={rubric.id}>
                  <div className="section-title">{rubric.title}</div>
                  {rubric.description ? (
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{rubric.description}</div>
                  ) : null}
                  {rubric.levels?.length ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                      评分档：{rubric.levels.map((level: any) => `${level.label}(${level.score})`).join(" / ")}
                    </div>
                  ) : null}
                  <div className="pill-list" style={{ marginTop: 8 }}>
                    <span className="pill">
                      得分 {record?.score ?? 0}/{rubric.maxScore}
                    </span>
                  </div>
                  <p style={{ marginTop: 8 }}>点评：{record?.comment || "暂无"}</p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {review?.aiReview ? (
        <Card title="AI 批改建议" tag="AI">
          <div className="card">
            <div className="section-title">评分</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{review.aiReview.result?.score ?? 0} 分</div>
            <p style={{ marginTop: 8 }}>{review.aiReview.result?.summary ?? "暂无总结。"}</p>
          </div>
          {review.aiReview.result?.strengths?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 12 }}>
              <div className="badge">优点</div>
              {review.aiReview.result.strengths.map((item: string) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
          {review.aiReview.result?.issues?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 12 }}>
              <div className="badge">问题</div>
              {review.aiReview.result.issues.map((item: string) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
          {review.aiReview.result?.suggestions?.length ? (
            <div className="grid" style={{ gap: 6, marginTop: 12 }}>
              <div className="badge">建议</div>
              {review.aiReview.result.suggestions.map((item: string) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
          {review.aiReview.result?.writing ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="section-title">写作评分</div>
              <div className="pill-list" style={{ marginTop: 8 }}>
                <span className="pill">结构 {review.aiReview.result.writing.scores?.structure ?? 0}</span>
                <span className="pill">语法 {review.aiReview.result.writing.scores?.grammar ?? 0}</span>
                <span className="pill">词汇 {review.aiReview.result.writing.scores?.vocab ?? 0}</span>
              </div>
              <p style={{ marginTop: 8 }}>{review.aiReview.result.writing.summary ?? "暂无写作总结。"}</p>
              {review.aiReview.result.writing.strengths?.length ? (
                <div style={{ marginTop: 8 }}>
                  <div className="section-title">写作优点</div>
                  <ul style={{ margin: "6px 0 0 16px" }}>
                    {review.aiReview.result.writing.strengths.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {review.aiReview.result.writing.improvements?.length ? (
                <div style={{ marginTop: 8 }}>
                  <div className="section-title">改进建议</div>
                  <ul style={{ margin: "6px 0 0 16px" }}>
                    {review.aiReview.result.writing.improvements.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {review.aiReview.result.writing.corrected ? (
                <div style={{ marginTop: 8 }}>
                  <div className="section-title">修改示例</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{review.aiReview.result.writing.corrected}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {review?.questions && isQuiz ? (
        <Card title="错题复盘" tag="复盘">
          <div className="grid" style={{ gap: 12 }}>
            {review.questions
              .filter((item: any) => !item.correct)
              .map((item: any) => (
                <div className="card" key={item.id}>
                  <div className="section-title">
                    <MathText text={item.stem} showCopyActions />
                  </div>
                  <div className="pill-list" style={{ marginTop: 8 }}>
                    <span className="pill">
                      你的答案：<MathText text={item.answer || "未作答"} />
                    </span>
                    <span className="pill">
                      正确答案：<MathText text={item.correctAnswer} />
                    </span>
                  </div>
                  <p style={{ marginTop: 8 }}>
                    解析：<MathText text={item.explanation} showCopyActions />
                  </p>
                </div>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
