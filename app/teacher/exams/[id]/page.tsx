"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import MathText from "@/components/MathText";
import { SUBJECT_LABELS } from "@/lib/constants";

type ExamDetail = {
  exam: {
    id: string;
    title: string;
    description?: string;
    publishMode: "teacher_assigned" | "targeted";
    antiCheatLevel: "off" | "basic";
    status: "published" | "closed";
    startAt?: string;
    endAt: string;
    durationMinutes?: number;
    createdAt: string;
  };
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  summary: {
    assigned: number;
    submitted: number;
    pending: number;
    avgScore: number;
    totalBlurCount: number;
    totalVisibilityHiddenCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
  };
  questions: Array<{
    id: string;
    stem: string;
    score: number;
    orderIndex: number;
  }>;
  students: Array<{
    id: string;
    name: string;
    email: string;
    grade?: string;
    status: string;
    score: number | null;
    total: number | null;
    submittedAt: string | null;
    blurCount: number;
    visibilityHiddenCount: number;
    lastExamEventAt: string | null;
    riskScore: number;
    riskLevel: "low" | "medium" | "high";
    riskReasons: string[];
    recommendedAction: string;
  }>;
};

function riskTone(level: "low" | "medium" | "high") {
  if (level === "high") {
    return { label: "高风险", color: "#b42318", bg: "#fee4e2" };
  }
  if (level === "medium") {
    return { label: "中风险", color: "#b54708", bg: "#fffaeb" };
  }
  return { label: "低风险", color: "#027a48", bg: "#ecfdf3" };
}

export default function TeacherExamDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [publishingReviewPack, setPublishingReviewPack] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/teacher/exams/${params.id}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载失败");
      return;
    }
    setData(payload);
  }, [params.id]);

  async function handleStatusAction(action: "close" | "reopen") {
    if (!data || updatingStatus) return;
    setUpdatingStatus(true);
    const res = await fetch(`/api/teacher/exams/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "更新失败");
      setUpdatingStatus(false);
      return;
    }
    setData((prev) => (prev ? { ...prev, exam: { ...prev.exam, status: payload?.data?.status ?? prev.exam.status } } : prev));
    setUpdatingStatus(false);
  }

  async function handlePublishReviewPack(dryRun: boolean) {
    if (!data || publishingReviewPack) return;
    setPublishMessage(null);
    setPublishError(null);
    setPublishingReviewPack(true);
    try {
      const res = await fetch(`/api/teacher/exams/${params.id}/review-pack/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minRiskLevel: "high",
          includeParents: true,
          dryRun
        })
      });
      const payload = await res.json();
      if (!res.ok) {
        setPublishError(payload?.error ?? "发布失败");
        return;
      }
      const result = payload?.data;
      const summary =
        result?.message ??
        (dryRun
          ? `预览完成：计划通知学生 ${result?.publishedStudents ?? 0} 人`
          : `发布完成：已通知学生 ${result?.publishedStudents ?? 0} 人`);
      const detail = `覆盖 ${result?.targetedStudents ?? 0} 人，跳过低风险 ${result?.skippedLowRisk ?? 0} 人，缺少提交 ${result?.skippedNoSubmission ?? 0} 人。`;
      setPublishMessage(`${summary} ${detail}`);
    } catch {
      setPublishError("发布失败");
    } finally {
      setPublishingReviewPack(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  const rankedStudents = useMemo(() => {
    if (!data?.students?.length) return [];
    return [...data.students].sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      if ((a.status === "submitted") !== (b.status === "submitted")) {
        return a.status === "submitted" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, [data?.students]);

  if (error) {
    return (
      <Card title="考试详情">
        <div className="status-note error">{error}</div>
        <Link className="button secondary" href="/teacher/exams" style={{ marginTop: 12 }}>
          返回考试列表
        </Link>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="考试详情">
        <div className="empty-state">
          <p className="empty-state-title">加载中</p>
          <p>正在读取考试详情。</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.exam.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <span className="chip">
          {data.exam.status === "closed" ? "已关闭" : "进行中"} · 提交 {data.summary.submitted}/{data.summary.assigned}
        </span>
      </div>

      <Card title="考试概览" tag="概览">
        <div className="grid grid-2">
          <div className="card feature-card">
            <EduIcon name="board" />
            <div className="section-title">考试时间</div>
            <p>截止 {new Date(data.exam.endAt).toLocaleString("zh-CN")}</p>
            <div className="pill-list">
              {data.exam.startAt ? (
                <span className="pill">开始 {new Date(data.exam.startAt).toLocaleString("zh-CN")}</span>
              ) : (
                <span className="pill">开始时间不限</span>
              )}
              <span className="pill">
                发布 {data.exam.publishMode === "teacher_assigned" ? "班级统一" : "定向"}
              </span>
              <span className="pill">
                防作弊 {data.exam.antiCheatLevel === "basic" ? "基础监测" : "关闭"}
              </span>
              <span className="pill">
                时长 {data.exam.durationMinutes ? `${data.exam.durationMinutes} 分钟` : "不限"}
              </span>
            </div>
          </div>
          <div className="card feature-card">
            <EduIcon name="chart" />
            <div className="section-title">班级进度</div>
            <div className="pill-list">
              <span className="pill">已分配 {data.summary.assigned}</span>
              <span className="pill">已提交 {data.summary.submitted}</span>
              <span className="pill">待提交 {data.summary.pending}</span>
              <span className="pill">平均分 {data.summary.avgScore}%</span>
              <span className="pill">离屏 {data.summary.totalVisibilityHiddenCount}</span>
              <span className="pill">切屏 {data.summary.totalBlurCount}</span>
              <span className="pill">高风险 {data.summary.highRiskCount}</span>
              <span className="pill">中风险 {data.summary.mediumRiskCount}</span>
            </div>
          </div>
        </div>
        {data.exam.description ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-1)" }}>{data.exam.description}</div>
        ) : null}
        <div className="cta-row" style={{ marginTop: 12 }}>
          <Link className="button ghost" href="/teacher/exams">
            返回考试列表
          </Link>
          {data.exam.status === "closed" ? (
            <button
              className="button primary"
              type="button"
              disabled={updatingStatus}
              onClick={() => handleStatusAction("reopen")}
            >
              {updatingStatus ? "处理中..." : "重新开放考试"}
            </button>
          ) : (
            <button
              className="button secondary"
              type="button"
              disabled={updatingStatus}
              onClick={() => handleStatusAction("close")}
            >
              {updatingStatus ? "处理中..." : "关闭考试"}
            </button>
          )}
          <a className="button secondary" href={`/api/teacher/exams/${data.exam.id}/export`}>
            导出成绩 CSV
          </a>
          <button
            className="button primary"
            type="button"
            disabled={publishingReviewPack || data.summary.submitted <= 0}
            onClick={() => handlePublishReviewPack(false)}
          >
            {publishingReviewPack ? "发布中..." : "发布高风险复盘任务"}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={publishingReviewPack || data.summary.submitted <= 0}
            onClick={() => handlePublishReviewPack(true)}
          >
            {publishingReviewPack ? "处理中..." : "预览发布范围"}
          </button>
          <Link className="button secondary" href="/teacher/exams/create">
            再发布一场考试
          </Link>
        </div>
        {publishMessage ? <div className="status-note success">{publishMessage}</div> : null}
        {publishError ? <div className="status-note error">{publishError}</div> : null}
      </Card>

      <Card title="学生进度" tag="提交">
        {rankedStudents.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无学生</p>
            <p>班级中还没有可分配考试的学生。</p>
          </div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {rankedStudents.map((student) => {
              const tone = riskTone(student.riskLevel ?? "low");
              return (
                <div className="card" key={student.id} style={{ borderColor: tone.bg }}>
                  <div className="card-header">
                    <div className="section-title">{student.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="card-tag">{student.status === "submitted" ? "已提交" : "待提交"}</span>
                      <span
                        style={{
                          fontSize: 12,
                          borderRadius: 999,
                          padding: "3px 8px",
                          background: tone.bg,
                          color: tone.color
                        }}
                      >
                        {tone.label} · {student.riskScore}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{student.email}</div>
                  <div className="pill-list" style={{ marginTop: 8 }}>
                    {student.status === "submitted" ? (
                      <>
                        <span className="pill">
                          得分 {student.score ?? 0}/{student.total ?? 0}
                        </span>
                        <span className="pill">
                          提交于 {student.submittedAt ? new Date(student.submittedAt).toLocaleString("zh-CN") : "-"}
                        </span>
                      </>
                    ) : (
                      <span className="pill">尚未提交</span>
                    )}
                    <span className="pill">离屏 {student.visibilityHiddenCount}</span>
                    <span className="pill">切屏 {student.blurCount}</span>
                    {student.lastExamEventAt ? (
                      <span className="pill">最近异常 {new Date(student.lastExamEventAt).toLocaleString("zh-CN")}</span>
                    ) : null}
                  </div>
                  {student.riskReasons?.length ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: tone.color }}>
                      风险原因：{student.riskReasons.join("；")}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-1)" }}>风险原因：暂无明显异常。</div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                    建议动作：{student.recommendedAction || "建议常规复盘。"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="题目清单" tag="试卷">
        {data.questions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">暂无题目</p>
            <p>该考试暂未生成题目。</p>
          </div>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            {data.questions.map((question, index) => (
              <div className="card" key={question.id}>
                <div className="section-title">
                  {index + 1}. <MathText text={question.stem} />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>分值：{question.score}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
