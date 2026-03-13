"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import AssignmentStatsDistributionCard from "./_components/AssignmentStatsDistributionCard";
import AssignmentStatsOverviewCard from "./_components/AssignmentStatsOverviewCard";
import AssignmentStatsQuestionsCard from "./_components/AssignmentStatsQuestionsCard";
import AssignmentStatsValidationLoopCard from "./_components/AssignmentStatsValidationLoopCard";
import type { AssignmentStatsData } from "./types";
import { getDistributionMaxCount } from "./utils";

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDueRelativeLabel(dueDate: string, now: number) {
  const diffMs = new Date(dueDate).getTime() - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `已截止 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  return `${diffDays} 天后截止`;
}

export default function AssignmentStatsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<AssignmentStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/teacher/assignments/${params.id}/stats`);
      const payload = (await res.json()) as AssignmentStatsData & { error?: string };
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error ?? "加载失败");
      }
      setData(payload);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxCount = useMemo(() => getDistributionMaxCount(data?.distribution ?? []), [data?.distribution]);
  const completionRate = data?.summary.students
    ? Math.round((data.summary.completed / data.summary.students) * 100)
    : 0;
  const lowScoreCount = data?.distribution.find((item) => item.label === "<60")?.count ?? 0;
  const watchQuestionCount = data?.questionStats.filter((item) => item.ratio < 80).length ?? 0;
  const dueRelativeLabel = data ? getDueRelativeLabel(data.assignment.dueDate, now) : "";

  if (loading && !data) {
    return (
      <Card title="作业统计">
        <StatePanel
          compact
          tone="loading"
          title="作业统计加载中"
          description="正在同步作业完成情况、成绩分布和题目正确率。"
        />
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card title="作业统计">
        <StatePanel
          compact
          tone="error"
          title="作业统计加载失败"
          description={error}
          action={
            <Link className="button secondary" href={`/teacher/assignments/${params.id}`}>
              返回作业详情
            </Link>
          }
        />
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>作业统计验证</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{ASSIGNMENT_TYPE_LABELS[data.assignment.submissionType ?? "quiz"]}</span>
          <span className="chip">{dueRelativeLabel}</span>
          <span className="chip">完成率 {completionRate}%</span>
          <span className="chip">待交 {data.summary.pending}</span>
          {data.summary.overdue ? <span className="chip">逾期 {data.summary.overdue}</span> : null}
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

      <AssignmentStatsValidationLoopCard
        assignmentId={params.id}
        assignment={data.assignment}
        summary={data.summary}
        distribution={data.distribution}
        questionStats={data.questionStats}
        now={now}
      />

      <div className="assignment-stats-top-grid">
        <Card title="作业上下文" tag="Context">
          <div className="feature-card">
            <EduIcon name="board" />
            <div>
              <div className="section-title">{data.assignment.title}</div>
              <p>{data.assignment.description || "暂无作业说明。"}</p>
            </div>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">创建于 {formatDateOnly(data.assignment.createdAt)}</span>
            <span className="pill">截止 {formatDateOnly(data.assignment.dueDate)}</span>
            {data.assignment.gradingFocus ? <span className="pill">批改重点：{data.assignment.gradingFocus}</span> : null}
            {data.assignment.maxUploads ? <span className="pill">最多上传 {data.assignment.maxUploads} 个文件</span> : null}
          </div>

          <div className="cta-row" style={{ marginTop: 12 }}>
            <Link className="button ghost" href={`/teacher/assignments/${params.id}`}>
              回作业详情
            </Link>
            <Link className="button secondary" href="/teacher/submissions">
              去提交箱
            </Link>
            <Link className="button secondary" href="/teacher/gradebook">
              去成绩册
            </Link>
          </div>

          {error ? (
            <StatePanel
              compact
              tone="error"
              title="已展示最近一次成功数据"
              description={`最新刷新失败：${error}`}
              action={
                <button className="button secondary" type="button" onClick={() => void load("refresh")}>
                  再试一次
                </button>
              }
            />
          ) : null}
        </Card>

        <AssignmentStatsOverviewCard
          assignmentId={params.id}
          summary={data.summary}
          completionRate={completionRate}
          lowScoreCount={lowScoreCount}
          watchQuestionCount={watchQuestionCount}
        />
      </div>

      <div className="assignment-stats-main-grid">
        <AssignmentStatsDistributionCard distribution={data.distribution} maxCount={maxCount} />
        <AssignmentStatsQuestionsCard questionStats={data.questionStats} />
      </div>
    </div>
  );
}
