"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import MathViewControls from "@/components/MathViewControls";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useMathViewSettings } from "@/lib/math-view-settings";
import ExamExecutionLoopCard from "./_components/ExamExecutionLoopCard";
import ExamOverviewCard from "./_components/ExamOverviewCard";
import ExamQuestionsCard from "./_components/ExamQuestionsCard";
import ExamStudentsCard from "./_components/ExamStudentsCard";
import type { ExamDetail } from "./types";

function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  return `${Math.ceil(diffHours / 24)} 天后结束`;
}

export default function TeacherExamDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ExamDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [publishingReviewPack, setPublishingReviewPack] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const mathView = useMathViewSettings("teacher-exam-detail");
  const now = Date.now();

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const res = await fetch(`/api/teacher/exams/${params.id}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "加载失败");
      }
      setData(payload);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      setLoadError(nextError instanceof Error ? nextError.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.id]);

  async function handleStatusAction(action: "close" | "reopen") {
    if (!data || updatingStatus) return;
    setUpdatingStatus(true);
    setStatusError(null);
    const res = await fetch(`/api/teacher/exams/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatusError(payload?.error ?? "更新失败");
      setUpdatingStatus(false);
      return;
    }
    setData((prev) =>
      prev ? { ...prev, exam: { ...prev.exam, status: payload?.data?.status ?? prev.exam.status } } : prev
    );
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
    void load();
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

  if (loading && !data) {
    return (
      <Card title="考试详情">
        <StatePanel
          compact
          tone="loading"
          title="考试详情加载中"
          description="正在读取考试概览、学生风险和复盘发布状态。"
        />
      </Card>
    );
  }

  if (loadError && !data) {
    return (
      <Card title="考试详情">
        <StatePanel
          compact
          tone="error"
          title="考试详情加载失败"
          description={loadError}
          action={
            <Link className="button secondary" href="/teacher/exams">
              返回考试列表
            </Link>
          }
        />
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const submittedRate = data.summary.assigned
    ? Math.round((data.summary.submitted / data.summary.assigned) * 100)
    : 0;
  const topRiskStudent = rankedStudents[0] ?? null;
  const totalQuestionScore = data.questions.reduce((sum, question) => sum + question.score, 0);
  const dueRelativeLabel = getDueRelativeLabel(data.exam.endAt, now);

  return (
    <div className="grid math-view-surface" style={{ gap: 18, ...mathView.style }}>
      <div className="section-head">
        <div>
          <h2>{data.exam.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{data.exam.status === "closed" ? "已关闭" : "进行中"}</span>
          <span className="chip">{dueRelativeLabel}</span>
          <span className="chip">提交 {data.summary.submitted}/{data.summary.assigned}</span>
          <span className="chip">高风险 {data.summary.highRiskCount}</span>
          <span className="chip">均分 {data.summary.avgScore}%</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={() => void load("refresh")}
            disabled={loading || refreshing}
          >
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>
      <MathViewControls
        fontScale={mathView.fontScale}
        lineMode={mathView.lineMode}
        onDecrease={mathView.decreaseFontScale}
        onIncrease={mathView.increaseFontScale}
        onReset={mathView.resetView}
        onLineModeChange={mathView.setLineMode}
      />

      <ExamExecutionLoopCard data={data} now={now} />

      <div className="teacher-exam-detail-top-grid">
        <ExamOverviewCard
          data={data}
          updatingStatus={updatingStatus}
          publishingReviewPack={publishingReviewPack}
          statusError={statusError}
          publishMessage={publishMessage}
          publishError={publishError}
          onStatusAction={handleStatusAction}
          onPublishReviewPack={handlePublishReviewPack}
        />

        <Card title="考试指挥台" tag="Ops">
          <div className="grid grid-2">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">提交率</div>
              <div className="workflow-summary-value">{submittedRate}%</div>
              <div className="workflow-summary-helper">已提交 {data.summary.submitted} / {data.summary.assigned}</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">高风险学生</div>
              <div className="workflow-summary-value">{data.summary.highRiskCount}</div>
              <div className="workflow-summary-helper">中风险 {data.summary.mediumRiskCount} 人</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">异常行为</div>
              <div className="workflow-summary-value">
                {data.summary.totalVisibilityHiddenCount + data.summary.totalBlurCount}
              </div>
              <div className="workflow-summary-helper">
                离屏 {data.summary.totalVisibilityHiddenCount} 次 · 切屏 {data.summary.totalBlurCount} 次
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">卷面规模</div>
              <div className="workflow-summary-value">{data.questions.length}</div>
              <div className="workflow-summary-helper">总分 {totalQuestionScore} 分</div>
            </div>
          </div>

          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">待提交 {data.summary.pending} 人</span>
            <span className="pill">防作弊 {data.exam.antiCheatLevel === "basic" ? "基础监测" : "关闭"}</span>
            <span className="pill">发布 {data.exam.publishMode === "teacher_assigned" ? "班级统一" : "定向"}</span>
            <span className="pill">时长 {data.exam.durationMinutes ? `${data.exam.durationMinutes} 分钟` : "不限"}</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            {topRiskStudent
              ? `当前最该先处理的是 ${topRiskStudent.name}。先看学生风险，再决定是否直接发布复盘包。`
              : "当前没有明显高风险学生，可以把注意力转向题目讲评和考试收尾。"}
          </div>

          <div className="cta-row" style={{ marginTop: 12 }}>
            <a className="button secondary" href="#exam-students">
              去学生风险区
            </a>
            <a className="button secondary" href="#exam-questions">
              去题目清单
            </a>
          </div>

          {loadError ? (
            <StatePanel
              compact
              tone="error"
              title="已展示最近一次成功数据"
              description={`最新刷新失败：${loadError}`}
              action={
                <button className="button secondary" type="button" onClick={() => void load("refresh")}>
                  再试一次
                </button>
              }
            />
          ) : null}
        </Card>
      </div>

      <ExamStudentsCard students={rankedStudents} />
      <ExamQuestionsCard questions={data.questions} />
    </div>
  );
}
