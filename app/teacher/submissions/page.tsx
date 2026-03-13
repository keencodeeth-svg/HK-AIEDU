"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import SubmissionExecutionLoopCard from "./_components/SubmissionExecutionLoopCard";
import type { SubmissionClassItem, SubmissionRow, SubmissionStatusFilter } from "./types";

const STATUS_LABELS: Record<SubmissionStatusFilter, string> = {
  all: "全部",
  completed: "已提交",
  pending: "待提交",
  overdue: "已逾期"
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

function getStatusLabel(status: string) {
  return status === "completed" ? "已提交" : status === "overdue" ? "已逾期" : "待提交";
}

function getStatusPillClassName(status: string) {
  if (status === "completed") return "gradebook-pill done";
  if (status === "overdue") return "gradebook-pill overdue";
  return "gradebook-pill pending";
}

export default function TeacherSubmissionsPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [classes, setClasses] = useState<SubmissionClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<SubmissionStatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(async (nextClassId: string, mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const query = new URLSearchParams();
      if (nextClassId) query.set("classId", nextClassId);
      const res = await fetch(`/api/teacher/submissions?${query.toString()}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "加载失败");
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
      setClasses(Array.isArray(payload.classes) ? payload.classes : []);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(classId);
  }, [classId, load]);

  const filtered = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    let list = rows;

    if (status !== "all") {
      list = list.filter((row) => row.status === status);
    }

    if (keywordLower) {
      list = list.filter((row) =>
        [
          row.studentName,
          row.studentEmail,
          row.assignmentTitle,
          row.className,
          SUBJECT_LABELS[row.subject] ?? row.subject,
          row.grade
        ]
          .join(" ")
          .toLowerCase()
          .includes(keywordLower)
      );
    }

    return list.slice().sort((left, right) => {
      const statusRank = { overdue: 0, pending: 1, completed: 2 } as const;
      const leftRank = statusRank[left.status as keyof typeof statusRank] ?? 3;
      const rightRank = statusRank[right.status as keyof typeof statusRank] ?? 3;
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (left.status === "completed" && right.status === "completed") {
        const leftTs = new Date(left.submittedAt ?? left.completedAt ?? "").getTime();
        const rightTs = new Date(right.submittedAt ?? right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      }
      return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    });
  }, [keyword, rows, status]);

  const overallSummary = useMemo(
    () => ({
      total: rows.length,
      completed: rows.filter((row) => row.status === "completed").length,
      pending: rows.filter((row) => row.status === "pending").length,
      overdue: rows.filter((row) => row.status === "overdue").length
    }),
    [rows]
  );

  const filteredSummary = useMemo(
    () => ({
      total: filtered.length,
      completed: filtered.filter((row) => row.status === "completed").length,
      pending: filtered.filter((row) => row.status === "pending").length,
      overdue: filtered.filter((row) => row.status === "overdue").length
    }),
    [filtered]
  );

  const hasActiveFilters = Boolean(classId || status !== "all" || keyword.trim());
  const selectedClass = classes.find((item) => item.id === classId);
  const recentSubmittedCount = useMemo(
    () =>
      rows.filter((row) => {
        const ts = new Date(row.submittedAt ?? row.completedAt ?? "").getTime();
        return row.status === "completed" && Number.isFinite(ts) && ts >= now - 24 * 60 * 60 * 1000;
      }).length,
    [now, rows]
  );
  const uniqueAssignmentCount = useMemo(() => new Set(rows.map((row) => row.assignmentId)).size, [rows]);

  function handleClearFilters() {
    setClassId("");
    setStatus("all");
    setKeyword("");
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>提交箱（Submission Inbox）</h2>
          <div className="section-sub">先清未交与逾期，再接最新已交，最后回成绩册和学情分析确认这轮收口效果。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">教师端</span>
          {selectedClass ? <span className="chip">{selectedClass.name}</span> : null}
          <span className="chip">待跟进 {overallSummary.pending + overallSummary.overdue}</span>
          {overallSummary.overdue ? <span className="chip">已逾期 {overallSummary.overdue}</span> : null}
          {recentSubmittedCount ? <span className="chip">近24h 新提交 {recentSubmittedCount}</span> : null}
          <span className="chip">筛选后 {filteredSummary.total} / {overallSummary.total} 条</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={() => void load(classId, "refresh")}
            disabled={loading || refreshing}
          >
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <SubmissionExecutionLoopCard selectedClass={selectedClass} rows={rows} now={now} />

      <div className="submission-top-grid">
        <Card title="筛选条件" tag="筛选">
          <div className="grid grid-2" style={{ alignItems: "end" }}>
            <label>
              <div className="section-title">班级</div>
              <select value={classId} onChange={(event) => setClassId(event.target.value)} style={{ width: "100%" }}>
                <option value="">全部班级</option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name} · {SUBJECT_LABELS[klass.subject] ?? klass.subject} · {klass.grade} 年级
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">状态</div>
              <select value={status} onChange={(event) => setStatus(event.target.value as SubmissionStatusFilter)} style={{ width: "100%" }}>
                <option value="all">全部</option>
                <option value="completed">已提交</option>
                <option value="pending">待提交</option>
                <option value="overdue">已逾期</option>
              </select>
            </label>
            <label>
              <div className="section-title">关键字</div>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="学生/作业/班级/学科"
                style={{ width: "100%" }}
              />
            </label>
            <div className="cta-row cta-row-tight no-margin">
              <button className="button ghost" type="button" onClick={handleClearFilters} disabled={!hasActiveFilters}>
                清空筛选
              </button>
              <Link className="button secondary" href="/teacher/gradebook">
                去成绩册
              </Link>
            </div>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">班级：{selectedClass ? selectedClass.name : "全部班级"}</span>
            <span className="pill">状态：{STATUS_LABELS[status]}</span>
            <span className="pill">关键词：{keyword.trim() || "未设置"}</span>
          </div>
          <div className="meta-text" style={{ marginTop: 12 }}>
            状态筛选现在只影响当前视图，不会再改变整体盘面数据。先看全局，再缩到今天真正需要跟进的人和作业。
          </div>

          {error && rows.length ? (
            <StatePanel
              compact
              tone="error"
              title="已展示最近一次成功数据"
              description={`最新刷新失败：${error}`}
              action={
                <button className="button secondary" type="button" onClick={() => void load(classId, "refresh")}>
                  再试一次
                </button>
              }
            />
          ) : null}
        </Card>

        <Card title="提交收口概览" tag="Close">
          <div className="grid grid-2">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">当前总记录</div>
              <div className="workflow-summary-value">{overallSummary.total}</div>
              <div className="workflow-summary-helper">当前班级范围内可追踪的提交总数</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">待跟进</div>
              <div className="workflow-summary-value">{overallSummary.pending + overallSummary.overdue}</div>
              <div className="workflow-summary-helper">待交与逾期需要优先收口</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">已提交</div>
              <div className="workflow-summary-value">{overallSummary.completed}</div>
              <div className="workflow-summary-helper">已进入可查看或可批改状态</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">近24h 新提交</div>
              <div className="workflow-summary-value">{recentSubmittedCount}</div>
              <div className="workflow-summary-helper">适合优先处理最新上下文</div>
            </div>
          </div>
          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">作业 {uniqueAssignmentCount} 份</span>
            <span className="pill">筛选结果 {filteredSummary.total} 条</span>
            <span className="pill">待提交 {filteredSummary.pending}</span>
            <span className="pill">已逾期 {filteredSummary.overdue}</span>
          </div>
        </Card>
      </div>

      <Card title="提交跟进明细" tag="Inbox">
        {loading && !rows.length ? (
          <StatePanel
            compact
            tone="loading"
            title="提交记录加载中"
            description="正在同步各班级学生的提交进度与批改数据。"
          />
        ) : error && !rows.length ? (
          <StatePanel
            compact
            tone="error"
            title="提交箱加载失败"
            description={error}
            action={
              <button className="button secondary" type="button" onClick={() => void load(classId, "refresh")}>
                重新加载
              </button>
            }
          />
        ) : !rows.length ? (
          <StatePanel
            compact
            tone="empty"
            title="当前还没有可追踪的提交"
            description="先去教师端发布作业，提交箱会自动沉淀待交、逾期和已交学生名单。"
            action={
              <Link className="button secondary" href="/teacher">
                去教师端工作台
              </Link>
            }
          />
        ) : !filtered.length ? (
          <StatePanel
            compact
            tone="empty"
            title="没有匹配的提交记录"
            description="试试清空筛选条件，或者换个关键词重新搜索。"
            action={
              <button className="button secondary" type="button" onClick={handleClearFilters}>
                清空筛选
              </button>
            }
          />
        ) : (
          <>
            <div className="workflow-card-meta">
              <span className="pill">已提交 {filteredSummary.completed}</span>
              <span className="pill">待提交 {filteredSummary.pending}</span>
              <span className="pill">已逾期 {filteredSummary.overdue}</span>
            </div>
            <div className="meta-text" style={{ marginTop: 12 }}>
              表格已默认按优先级排序：先逾期、再待交、最后已提交。这样不需要你自己在列表里重新筛最先该处理的记录。
            </div>
            <div id="submission-list" style={{ overflowX: "auto" }}>
              <table className="gradebook-table">
                <thead>
                  <tr>
                    <th>学生</th>
                    <th>班级</th>
                    <th>作业</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>得分</th>
                    <th>提交时间</th>
                    <th>截止日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={`${row.assignmentId}-${row.studentId}`}>
                      <td>
                        <div>{row.studentName}</div>
                        <div className="workflow-summary-helper">{row.studentEmail}</div>
                      </td>
                      <td>
                        <div>{row.className}</div>
                        <div className="workflow-summary-helper">
                          {SUBJECT_LABELS[row.subject] ?? row.subject} · {row.grade} 年级
                        </div>
                      </td>
                      <td>{row.assignmentTitle}</td>
                      <td>
                        {ASSIGNMENT_TYPE_LABELS[row.submissionType as "quiz"] ?? row.submissionType}
                        {row.uploadCount ? <div className="workflow-summary-helper">上传 {row.uploadCount} 个文件</div> : null}
                      </td>
                      <td>
                        <span className={getStatusPillClassName(row.status)}>{getStatusLabel(row.status)}</span>
                      </td>
                      <td>
                        {row.status === "completed" && row.total !== null
                          ? `${row.score ?? 0}/${row.total ?? 0}`
                          : row.status === "completed"
                            ? "已交"
                            : "-"}
                      </td>
                      <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString("zh-CN") : "-"}</td>
                      <td>{new Date(row.dueDate).toLocaleDateString("zh-CN")}</td>
                      <td>
                        {row.status === "completed" ? (
                          <Link className="button ghost" href={`/teacher/assignments/${row.assignmentId}/reviews/${row.studentId}`}>
                            查看/批改
                          </Link>
                        ) : (
                          <Link className="button ghost" href={`/teacher/assignments/${row.assignmentId}`}>
                            查看作业
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
