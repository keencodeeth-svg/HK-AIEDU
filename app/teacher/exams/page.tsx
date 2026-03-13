"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import ExamManagementLoopCard from "./_components/ExamManagementLoopCard";
import type { TeacherExamItem, TeacherExamStatusFilter } from "./types";

const STATUS_LABELS: Record<TeacherExamStatusFilter, string> = {
  all: "全部",
  published: "进行中",
  closed: "已关闭"
};

function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSubmissionRate(exam: TeacherExamItem) {
  if (!exam.assignedCount) return 0;
  return Math.round((exam.submittedCount / exam.assignedCount) * 100);
}

function getDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  return `${Math.ceil(diffHours / 24)} 天后结束`;
}

function getAttentionScore(exam: TeacherExamItem, now: number) {
  if (exam.status !== "published") {
    return -new Date(exam.endAt).getTime();
  }

  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  const endAtTs = new Date(exam.endAt).getTime();
  const hoursUntilEnd = Math.max(0, Math.ceil((endAtTs - now) / (60 * 60 * 1000)));
  const dueSoonBoost = hoursUntilEnd <= 24 ? 240 - hoursUntilEnd : 0;

  return pendingCount * 100 + (100 - getSubmissionRate(exam)) * 10 + dueSoonBoost;
}

function getPublishModeLabel(value: TeacherExamItem["publishMode"]) {
  return value === "teacher_assigned" ? "班级统一发布" : "定向发布";
}

function getPriorityLabel(exam: TeacherExamItem, now: number) {
  if (exam.status !== "published") return "已收口";
  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  const diffMs = new Date(exam.endAt).getTime() - now;
  if (pendingCount > 0 && diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) return "优先催交";
  if (getSubmissionRate(exam) < 60) return "低完成率";
  return "进行中";
}

function getRecommendedAction(exam: TeacherExamItem, now: number) {
  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  if (exam.status === "published") {
    if (pendingCount > 0 && new Date(exam.endAt).getTime() - now <= 24 * 60 * 60 * 1000) {
      return `还剩 ${pendingCount} 人未提交，先在详情页确认学生名单和催交节奏。`;
    }
    if (getSubmissionRate(exam) < 60) {
      return `当前完成率只有 ${getSubmissionRate(exam)}%，优先确认这场考试是否需要补提醒或调整结束时间。`;
    }
    return "当前节奏稳定，可以转到详情页检查风险学生和复盘包。";
  }
  if (exam.avgScore < 70) {
    return `这场考试已结束，但平均分只有 ${exam.avgScore}%，适合回详情页确认题目讲评重点。`;
  }
  return "这场考试已收口，可以作为下一轮考试的参考基线。";
}

export default function TeacherExamsPage() {
  const [list, setList] = useState<TeacherExamItem[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [status, setStatus] = useState<TeacherExamStatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const res = await fetch("/api/teacher/exams");
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "加载失败");
      }
      setList(Array.isArray(payload.data) ? payload.data : []);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Map(
          list.map((item) => [
            `${item.className}::${item.classSubject}::${item.classGrade}`,
            {
              id: `${item.className}::${item.classSubject}::${item.classGrade}`,
              name: item.className,
              subject: item.classSubject,
              grade: item.classGrade
            }
          ])
        ).values()
      ).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    [list]
  );

  const sortedList = useMemo(
    () =>
      list.slice().sort((left, right) => {
        if (left.status !== right.status) return left.status === "published" ? -1 : 1;
        if (left.status === "closed" && right.status === "closed") {
          return new Date(right.endAt).getTime() - new Date(left.endAt).getTime();
        }
        const scoreDiff = getAttentionScore(right, now) - getAttentionScore(left, now);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
      }),
    [list, now]
  );

  const filtered = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return sortedList.filter((item) => {
      if (classFilter) {
        const itemClassKey = `${item.className}::${item.classSubject}::${item.classGrade}`;
        if (itemClassKey !== classFilter) return false;
      }
      if (status !== "all" && item.status !== status) return false;
      if (!keywordLower) return true;

      return [
        item.title,
        item.description,
        item.className,
        SUBJECT_LABELS[item.classSubject] ?? item.classSubject,
        getGradeLabel(item.classGrade)
      ]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower);
    });
  }, [classFilter, keyword, sortedList, status]);

  const overallSummary = useMemo(
    () => ({
      total: list.length,
      published: list.filter((item) => item.status === "published").length,
      closed: list.filter((item) => item.status === "closed").length,
      dueSoon: list.filter((item) => {
        if (item.status !== "published") return false;
        const diffMs = new Date(item.endAt).getTime() - now;
        return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000 && item.submittedCount < item.assignedCount;
      }).length,
      lowCompletion: list.filter((item) => item.status === "published" && getSubmissionRate(item) < 60).length
    }),
    [list, now]
  );

  const filteredSummary = useMemo(
    () => ({
      total: filtered.length,
      published: filtered.filter((item) => item.status === "published").length,
      closed: filtered.filter((item) => item.status === "closed").length
    }),
    [filtered]
  );

  const topPriorityExam = useMemo(
    () => sortedList.find((item) => item.status === "published") ?? null,
    [sortedList]
  );
  const latestCreatedExam = useMemo(
    () =>
      list
        .slice()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null,
    [list]
  );
  const selectedClass = classOptions.find((item) => item.id === classFilter);
  const hasActiveFilters = Boolean(classFilter || status !== "all" || keyword.trim());

  function handleClearFilters() {
    setClassFilter("");
    setStatus("all");
    setKeyword("");
  }

  if (loading && !list.length) {
    return (
      <Card title="在线考试">
        <StatePanel
          compact
          tone="loading"
          title="考试列表加载中"
          description="正在同步进行中考试、最近收口记录和班级范围。"
        />
      </Card>
    );
  }

  if (error && !list.length) {
    return (
      <Card title="在线考试">
        <StatePanel
          compact
          tone="error"
          title="考试列表加载失败"
          description={error}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={() => void load()}>
                重试
              </button>
              <Link className="button ghost" href="/teacher">
                返回教师端
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>在线考试</h2>
          <div className="section-sub">先决定今天先盯哪场考试，再进入详情页处理学生、风险和收口动作。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">总计 {overallSummary.total} 场</span>
          <span className="chip">进行中 {overallSummary.published}</span>
          {overallSummary.dueSoon ? <span className="chip">24h 内截止 {overallSummary.dueSoon}</span> : null}
          <span className="chip">筛选后 {filteredSummary.total} 场</span>
          {selectedClass ? (
            <span className="chip">
              {selectedClass.name} · {SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject}
            </span>
          ) : null}
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

      <ExamManagementLoopCard exams={list} now={now} />

      <div className="teacher-exams-top-grid">
        <Card title="筛选与视角" tag="Filter">
          <div className="teacher-exams-filter-grid">
            <label>
              <div className="section-title">班级</div>
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} style={{ width: "100%" }}>
                <option value="">全部班级</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {getGradeLabel(item.grade)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="section-title">状态</div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TeacherExamStatusFilter)}
                style={{ width: "100%" }}
              >
                <option value="all">全部</option>
                <option value="published">进行中</option>
                <option value="closed">已关闭</option>
              </select>
            </label>

            <label>
              <div className="section-title">关键字</div>
              <input
                className="workflow-search-input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="考试标题 / 班级 / 学科"
              />
            </label>

            <div className="cta-row cta-row-tight no-margin">
              <button className="button ghost" type="button" onClick={handleClearFilters} disabled={!hasActiveFilters}>
                清空筛选
              </button>
              <Link className="button primary" href="/teacher/exams/create">
                发布新考试
              </Link>
            </div>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">班级：{selectedClass ? selectedClass.name : "全部班级"}</span>
            <span className="pill">状态：{STATUS_LABELS[status]}</span>
            <span className="pill">关键字：{keyword.trim() || "未设置"}</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            筛选只影响当前视图，不改变整体优先级逻辑。先用总盘面判断今天先盯哪场，再缩到具体班级或状态。
          </div>

          {error && list.length ? (
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

        <Card title="考试管理盘面" tag="Ops">
          <div className="grid grid-2">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">待跟进考试</div>
              <div className="workflow-summary-value">{overallSummary.published}</div>
              <div className="workflow-summary-helper">当前仍在运行、需要继续催交和看风险的考试数</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">近截止</div>
              <div className="workflow-summary-value">{overallSummary.dueSoon}</div>
              <div className="workflow-summary-helper">24 小时内到期且仍有人未提交的考试数</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">低完成率</div>
              <div className="workflow-summary-value">{overallSummary.lowCompletion}</div>
              <div className="workflow-summary-helper">完成率低于 60% 的进行中考试会被提前排序</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">已收口</div>
              <div className="workflow-summary-value">{overallSummary.closed}</div>
              <div className="workflow-summary-helper">已经关闭、适合回看成绩和卷面表现的考试数</div>
            </div>
          </div>

          <div className="pill-list" style={{ marginTop: 12 }}>
            {topPriorityExam ? <span className="pill">优先处理：{topPriorityExam.title}</span> : null}
            {latestCreatedExam ? <span className="pill">最近创建：{latestCreatedExam.title}</span> : null}
            <span className="pill">覆盖班级 {classOptions.length} 个</span>
            <span className="pill">筛选后进行中 {filteredSummary.published}</span>
            <span className="pill">筛选后已关闭 {filteredSummary.closed}</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            {topPriorityExam
              ? `当前最值得先点开的考试是「${topPriorityExam.title}」。先处理这场，再决定是否继续扫低完成率考试或转去创建下一轮。`
              : "当前没有进行中的考试，可以直接进入创建页，续上下一轮考试安排。"}
          </div>

          <div className="cta-row" style={{ marginTop: 12 }}>
            {topPriorityExam ? (
              <Link className="button secondary" href={`/teacher/exams/${topPriorityExam.id}`}>
                打开优先考试
              </Link>
            ) : null}
            <Link className="button ghost" href="/teacher">
              返回教师端
            </Link>
          </div>
        </Card>
      </div>

      <Card title="考试优先队列" tag="Queue">
        <div className="teacher-exams-list" id="exam-management-list">
          {list.length === 0 ? (
            <StatePanel
              compact
              tone="empty"
              title="当前还没有发布过考试"
              description="创建第一场考试后，这里会自动把进行中考试按优先级排好。"
              action={
                <Link className="button primary" href="/teacher/exams/create">
                  创建第一场考试
                </Link>
              }
            />
          ) : filtered.length === 0 ? (
            <StatePanel
              compact
              tone="empty"
              title="当前筛选条件下没有考试"
              description="可以清空筛选查看全盘，或直接创建下一场考试。"
              action={
                <div className="cta-row cta-row-tight no-margin">
                  <button className="button secondary" type="button" onClick={handleClearFilters}>
                    清空筛选
                  </button>
                  <Link className="button primary" href="/teacher/exams/create">
                    发布新考试
                  </Link>
                </div>
              }
            />
          ) : (
            filtered.map((item) => {
              const submissionRate = getSubmissionRate(item);
              const pendingCount = Math.max(0, item.assignedCount - item.submittedCount);
              const isPriority = topPriorityExam?.id === item.id && item.status === "published";
              const priorityLabel = getPriorityLabel(item, now);

              return (
                <div className={`teacher-exams-item${isPriority ? " priority" : ""}`} key={item.id}>
                  <div className="teacher-exams-item-header">
                    <div>
                      <div className="teacher-exams-item-kicker">{priorityLabel}</div>
                      <div className="teacher-exams-item-title">{item.title}</div>
                      <div className="meta-text">
                        {item.className} · {SUBJECT_LABELS[item.classSubject] ?? item.classSubject} ·{" "}
                        {getGradeLabel(item.classGrade)}
                      </div>
                    </div>
                    <div className="teacher-exams-item-badges">
                      <span className={`teacher-exams-status-pill ${item.status === "published" ? "active" : "closed"}`}>
                        {item.status === "published" ? "进行中" : "已关闭"}
                      </span>
                      {isPriority ? <span className="teacher-exams-status-pill priority">今日优先</span> : null}
                    </div>
                  </div>

                  <div className="teacher-exams-item-progress">
                    <div className="teacher-exams-item-progress-head">
                      <span>提交进度</span>
                      <strong>
                        {item.submittedCount}/{item.assignedCount} · {submissionRate}%
                      </strong>
                    </div>
                    <div className="teacher-exams-item-progress-track" aria-hidden="true">
                      <div className="teacher-exams-item-progress-fill" style={{ width: `${Math.min(submissionRate, 100)}%` }} />
                    </div>
                    <div className="meta-text">
                      {item.status === "published" ? `待提交 ${pendingCount} 人` : "已完成收口"} · 截止 {formatDateTime(item.endAt)} ·{" "}
                      {getDueRelativeLabel(item.endAt, now)}
                    </div>
                  </div>

                  <div className="teacher-exams-item-summary-grid">
                    <div className="teacher-exams-item-summary-card">
                      <div className="teacher-exams-item-summary-label">发布方式</div>
                      <div className="teacher-exams-item-summary-value">{getPublishModeLabel(item.publishMode)}</div>
                    </div>
                    <div className="teacher-exams-item-summary-card">
                      <div className="teacher-exams-item-summary-label">平均分</div>
                      <div className="teacher-exams-item-summary-value">{item.avgScore}%</div>
                    </div>
                    <div className="teacher-exams-item-summary-card">
                      <div className="teacher-exams-item-summary-label">监测</div>
                      <div className="teacher-exams-item-summary-value">
                        {item.antiCheatLevel === "basic" ? "基础防作弊" : "已关闭"}
                      </div>
                    </div>
                    <div className="teacher-exams-item-summary-card">
                      <div className="teacher-exams-item-summary-label">时长</div>
                      <div className="teacher-exams-item-summary-value">
                        {item.durationMinutes ? `${item.durationMinutes} 分钟` : "不限"}
                      </div>
                    </div>
                  </div>

                  <div className="workflow-card-meta">
                    {item.startAt ? <span className="pill">开始 {formatDateTime(item.startAt)}</span> : null}
                    <span className="pill">创建于 {formatDateTime(item.createdAt)}</span>
                    <span className="pill">状态 {STATUS_LABELS[item.status]}</span>
                  </div>

                  {item.description ? (
                    <div className="teacher-exams-item-description">
                      <div className="feature-card">
                        <EduIcon name="board" />
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="meta-text teacher-exams-item-action-note">{getRecommendedAction(item, now)}</div>

                  <div className="cta-row" style={{ marginTop: 12 }}>
                    <Link className={isPriority ? "button primary" : "button secondary"} href={`/teacher/exams/${item.id}`}>
                      {item.status === "published" ? "进入考试详情" : "查看收口详情"}
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
