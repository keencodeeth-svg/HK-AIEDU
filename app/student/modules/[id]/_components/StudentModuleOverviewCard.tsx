"use client";

import Link from "next/link";
import Card from "@/components/Card";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import type { StudentModuleClassSummary } from "../types";

type Props = {
  classroom: StudentModuleClassSummary;
  resourceCount: number;
  fileResourceCount: number;
  linkResourceCount: number;
  assignmentCount: number;
  completedCount: number;
  pendingCount: number;
  progressPercent: number;
};

export default function StudentModuleOverviewCard({
  classroom,
  resourceCount,
  fileResourceCount,
  linkResourceCount,
  assignmentCount,
  completedCount,
  pendingCount,
  progressPercent
}: Props) {
  return (
    <Card title="模块概览" tag="概览">
      <div id="student-module-overview" className="grid grid-2">
        <div className="workflow-summary-card">
          <div className="workflow-summary-label">所属班级</div>
          <div className="workflow-summary-value">1</div>
          <div className="workflow-summary-helper">
            {classroom.name} · {SUBJECT_LABELS[classroom.subject] ?? classroom.subject} · {getGradeLabel(classroom.grade)}
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
        <a className="button ghost" href="#student-module-resources">
          看资料
        </a>
        <a className="button ghost" href="#student-module-assignments">
          看任务
        </a>
        <Link className="button secondary" href="/student/modules">
          返回模块列表
        </Link>
      </div>
    </Card>
  );
}
