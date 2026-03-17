"use client";

import Link from "next/link";
import StatePanel from "@/components/StatePanel";
import StudentAssignmentsKpiGrid from "./_components/StudentAssignmentsKpiGrid";
import StudentAssignmentsListCard from "./_components/StudentAssignmentsListCard";
import { useStudentAssignmentsPageView } from "./useStudentAssignmentsPageView";

export default function StudentAssignmentsPage() {
  const assignmentsPage = useStudentAssignmentsPageView();

  if (assignmentsPage.authRequired) {
    return (
      <StatePanel
        tone="info"
        title="请先登录后查看作业"
        description="登录后即可查看老师布置的作业、截止日期和完成进度。"
        action={
          <Link className="button secondary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (assignmentsPage.loading && assignmentsPage.assignments.length === 0) {
    return (
      <StatePanel
        tone="loading"
        title="作业中心加载中"
        description="正在同步老师布置的作业、截止日期和完成进度。"
      />
    );
  }

  if (assignmentsPage.error && assignmentsPage.assignments.length === 0) {
    return (
      <StatePanel
        tone="error"
        title="作业中心暂时不可用"
        description={assignmentsPage.error ?? undefined}
        action={
          <button className="button secondary" type="button" onClick={assignmentsPage.reload}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>作业中心</h2>
          <div className="section-sub">查看作业进度、优先级与得分反馈，支持精细筛选与快速定位。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{assignmentsPage.priorityAssignmentChipLabel}</span>
          <span className="chip">2 天内到期 {assignmentsPage.dueSoonCount} 份</span>
          {assignmentsPage.lastLoadedAtLabel ? <span className="chip">更新于 {assignmentsPage.lastLoadedAtLabel}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={assignmentsPage.reload}
            disabled={assignmentsPage.loading || assignmentsPage.refreshing}
          >
            {assignmentsPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {assignmentsPage.error ? (
        <StatePanel
          compact
          tone="error"
          title="已展示最近一次成功数据"
          description={`最新刷新失败：${assignmentsPage.error}`}
          action={
            <button className="button secondary" type="button" onClick={assignmentsPage.reload}>
              再试一次
            </button>
          }
        />
      ) : null}

      <div className="workflow-card-meta">
        <span className="chip">总计 {assignmentsPage.assignments.length} 份</span>
        <span className="chip">{assignmentsPage.activeFilterSummary}</span>
      </div>

      <StudentAssignmentsKpiGrid {...assignmentsPage.kpiGridProps} />

      <StudentAssignmentsListCard {...assignmentsPage.listCardProps} />
    </div>
  );
}
