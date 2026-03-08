"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, getRequestErrorMessage, isAuthError, requestJson } from "@/lib/client-request";
import { ASSIGNMENT_TYPE_LABELS, getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { StudentModuleAssignment, StudentModuleDetailData, StudentModuleDetailResponse, StudentModuleResource } from "./types";

function formatFileSize(size?: number) {
  if (!size || size <= 0) return "文件";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAssignmentStatusMeta(item: StudentModuleAssignment) {
  const isCompleted = item.status === "completed";
  const isOverdue = !isCompleted && new Date(item.dueDate).getTime() < Date.now();
  if (isCompleted) {
    return { label: "已完成", tone: "done" };
  }
  if (isOverdue) {
    return { label: "待补交", tone: "overdue" };
  }
  return { label: "待完成", tone: "pending" };
}

function getResourceTypeLabel(item: StudentModuleResource) {
  return item.resourceType === "link" ? "链接资料" : "文件资料";
}

export default function StudentModuleDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<StudentModuleDetailData | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadModule = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setPageError(null);

    try {
      const payload = await requestJson<StudentModuleDetailResponse>(`/api/student/modules/${params.id}`);
      if (!payload.data) {
        throw new Error("模块数据缺失");
      }
      setData(payload.data);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      if (isAuthError(error)) {
        setAuthRequired(true);
        setData(null);
      } else {
        setPageError(getRequestErrorMessage(error, "加载模块详情失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadModule("initial");
  }, [loadModule]);

  const resourceCount = data?.resources.length ?? 0;
  const assignmentCount = data?.assignments.length ?? 0;
  const completedCount = useMemo(() => data?.assignments.filter((item) => item.status === "completed").length ?? 0, [data]);
  const pendingCount = Math.max(assignmentCount - completedCount, 0);
  const progressPercent = assignmentCount ? Math.round((completedCount / assignmentCount) * 100) : 0;
  const fileResourceCount = useMemo(() => data?.resources.filter((item) => item.resourceType === "file").length ?? 0, [data]);
  const linkResourceCount = Math.max(resourceCount - fileResourceCount, 0);

  const stageCopy = (() => {
    if (loading) {
      return {
        title: "正在加载模块详情",
        description: "系统正在同步该模块的资料、作业和学习进度，请稍等。"
      };
    }

    if (!data) {
      return {
        title: "模块信息暂不可用",
        description: "稍后刷新即可重新尝试拉取模块详情。"
      };
    }

    if (!resourceCount && !assignmentCount) {
      return {
        title: "这个模块还在准备中",
        description: "老师暂未上传资料或作业，后续内容补齐后，这里会自动更新。"
      };
    }

    if (pendingCount > 0) {
      return {
        title: `当前模块还有 ${pendingCount} 项任务待完成`,
        description: "建议先看资料再完成作业，模块内的学习资源和任务已经按同一上下文收拢。"
      };
    }

    return {
      title: "当前模块任务已完成",
      description: "你可以回顾资料、复习关键内容，或者返回模块列表进入下一单元。"
    };
  })();

  if (loading && !authRequired) {
    return (
      <StatePanel
        tone="loading"
        title="正在加载模块详情"
        description="正在同步模块资料、任务和进度信息，请稍等。"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录再查看模块详情"
        description="登录学生账号后，才能进入对应模块查看资料与作业。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (pageError && !data) {
    return (
      <StatePanel
        tone="error"
        title="模块详情加载失败"
        description={pageError}
        action={
          <button className="button secondary" type="button" onClick={() => void loadModule("refresh")}>
            重新加载
          </button>
        }
      />
    );
  }

  if (!data) {
    return (
      <StatePanel
        tone="empty"
        title="模块详情暂不可用"
        description="当前没有可展示的模块数据。"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.module.title}</h2>
          <div className="section-sub">{data.module.description || "模块详情"}</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">模块学习</span>
          <span className="chip">{data.classroom.name}</span>
          <span className="chip">进度 {progressPercent}%</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void loadModule("refresh")} disabled={refreshing}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新操作失败：${pageError}`}
          action={
            <button className="button secondary" type="button" onClick={() => void loadModule("refresh")}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="student-module-stage-banner">
        <div className="student-module-stage-kicker">当前阶段</div>
        <div className="student-module-stage-title">{stageCopy.title}</div>
        <p className="student-module-stage-description">{stageCopy.description}</p>
        <div className="pill-list">
          <span className="pill">{SUBJECT_LABELS[data.classroom.subject] ?? data.classroom.subject}</span>
          <span className="pill">{getGradeLabel(data.classroom.grade)}</span>
          <span className="pill">资料 {resourceCount}</span>
          <span className="pill">任务 {assignmentCount}</span>
          <span className="pill">已完成 {completedCount}</span>
        </div>
      </div>

      <Card title="模块概览" tag="概览">
        <div id="student-module-overview" className="grid grid-2">
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">所属班级</div>
            <div className="workflow-summary-value">1</div>
            <div className="workflow-summary-helper">
              {data.classroom.name} · {SUBJECT_LABELS[data.classroom.subject] ?? data.classroom.subject} · {getGradeLabel(data.classroom.grade)}
            </div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">模块资料</div>
            <div className="workflow-summary-value">{resourceCount}</div>
            <div className="workflow-summary-helper">文件 {fileResourceCount} 份 · 链接 {linkResourceCount} 条</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">模块作业</div>
            <div className="workflow-summary-value">{assignmentCount}</div>
            <div className="workflow-summary-helper">已完成 {completedCount} · 待完成 {pendingCount}</div>
          </div>
          <div className="workflow-summary-card">
            <div className="workflow-summary-label">模块进度</div>
            <div className="workflow-summary-value">{progressPercent}%</div>
            <div className="workflow-summary-helper">按模块内作业完成情况自动计算</div>
          </div>
        </div>

        <div className="cta-row student-module-next-actions" style={{ marginTop: 12 }}>
          <a className="button ghost" href="#student-module-resources">看资料</a>
          <a className="button ghost" href="#student-module-assignments">看任务</a>
          <Link className="button secondary" href="/student/modules">返回模块列表</Link>
        </div>
      </Card>

      <Card title="资源列表" tag="课件">
        <div id="student-module-resources" className="feature-card">
          <EduIcon name="board" />
          <p>这里集中放当前模块的课件、参考资料和拓展链接，适合先看资料再完成作业。</p>
        </div>

        {resourceCount ? (
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            {data.resources.map((item) => (
              <div className="card student-module-resource-card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <div className="workflow-card-meta">
                  <span className="pill">{getResourceTypeLabel(item)}</span>
                  {item.fileName ? <span className="pill">{item.fileName}</span> : null}
                  <span className="pill">{formatFileSize(item.size)}</span>
                  <span className="pill">上传于 {formatLoadedTime(item.createdAt)}</span>
                </div>
                <div className="student-module-resource-meta">
                  {item.resourceType === "link"
                    ? "推荐先打开原始资料链接查看，再回到当前页继续完成模块任务。"
                    : "可直接下载老师上传的资料文件，离线复习也更方便。"}
                </div>
                <div className="cta-row student-module-next-actions">
                  {item.resourceType === "link" && item.linkUrl ? (
                    <a className="button secondary" href={item.linkUrl} target="_blank" rel="noreferrer">
                      打开链接
                    </a>
                  ) : item.contentBase64 ? (
                    <a className="button secondary" href={`data:${item.mimeType};base64,${item.contentBase64}`} download={item.fileName}>
                      下载资料
                    </a>
                  ) : (
                    <span className="status-note info">当前资料暂不支持直接下载</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <StatePanel
              compact
              tone="empty"
              title="当前模块还没有学习资料"
              description="老师补充资料后，这里会自动更新；你也可以先去查看模块作业。"
              action={
                <a className="button secondary" href="#student-module-assignments">
                  去看模块作业
                </a>
              }
            />
          </div>
        )}
      </Card>

      <Card title="模块作业" tag="作业">
        <div id="student-module-assignments" className="feature-card">
          <EduIcon name="book" />
          <p>模块作业会沿着当前单元的学习内容组织，建议按资料 → 作业 → 回顾的顺序推进。</p>
        </div>

        {assignmentCount ? (
          <div className="grid" style={{ gap: 10, marginTop: 12 }}>
            {data.assignments.map((assignment) => {
              const statusMeta = getAssignmentStatusMeta(assignment);
              return (
                <div className="card student-module-assignment-card" key={assignment.id}>
                  <div className="section-title">{assignment.title}</div>
                  <div className="workflow-card-meta">
                    <span className={`gradebook-pill ${statusMeta.tone}`}>{statusMeta.label}</span>
                    <span className="pill">截止 {new Date(assignment.dueDate).toLocaleDateString("zh-CN")}</span>
                    <span className="pill">{ASSIGNMENT_TYPE_LABELS[assignment.submissionType ?? "quiz"]}</span>
                    {assignment.gradingFocus ? <span className="pill">关注：{assignment.gradingFocus}</span> : null}
                  </div>
                  <div className="student-module-resource-meta">
                    {assignment.description?.trim() || "进入作业后可查看完整题目、提交要求和当前完成情况。"}
                  </div>
                  <div className="cta-row student-module-next-actions">
                    <Link className="button secondary" href={`/student/assignments/${assignment.id}`}>
                      {assignment.status === "completed" ? "查看作业结果" : "进入作业"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <StatePanel
              compact
              tone="empty"
              title="当前模块还没有作业任务"
              description="可以先看资料和课件，等老师布置模块作业后，这里会自动同步。"
              action={
                <Link className="button secondary" href="/student/modules">
                  返回模块列表
                </Link>
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
