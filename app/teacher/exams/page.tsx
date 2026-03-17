"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import ExamManagementLoopCard from "./_components/ExamManagementLoopCard";
import TeacherExamsFiltersCard from "./_components/TeacherExamsFiltersCard";
import TeacherExamsOpsCard from "./_components/TeacherExamsOpsCard";
import TeacherExamsQueueCard from "./_components/TeacherExamsQueueCard";
import { useTeacherExamsPageView } from "./useTeacherExamsPageView";

export default function TeacherExamsPage() {
  const examsPage = useTeacherExamsPageView();

  if (examsPage.authRequired) {
    return (
      <Card title="在线考试">
        <StatePanel
          compact
          tone="info"
          title="请先登录后查看考试列表"
          description="登录教师账号后即可查看进行中考试、收口状态和优先队列。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (examsPage.loading && !examsPage.hasExams) {
    return (
      <Card title="在线考试">
        <StatePanel compact tone="loading" title="考试列表加载中" description="正在同步进行中考试、最近收口记录和班级范围。" />
      </Card>
    );
  }

  if (examsPage.pageError && !examsPage.hasExams) {
    return (
      <Card title="在线考试">
        <StatePanel
          compact
          tone="error"
          title="考试列表加载失败"
          description={examsPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={examsPage.reload}>
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
          <span className="chip">总计 {examsPage.totalCount} 场</span>
          <span className="chip">进行中 {examsPage.publishedCount}</span>
          {examsPage.dueSoonCount ? <span className="chip">24h 内截止 {examsPage.dueSoonCount}</span> : null}
          <span className="chip">筛选后 {examsPage.filteredCount} 场</span>
          {examsPage.selectedClassChipLabel ? <span className="chip">{examsPage.selectedClassChipLabel}</span> : null}
          {examsPage.lastLoadedAtLabel ? <span className="chip">更新于 {examsPage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={examsPage.refresh} disabled={examsPage.refreshDisabled}>
            {examsPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <ExamManagementLoopCard exams={examsPage.queueCardProps.list} now={examsPage.queueCardProps.now} />

      <div className="teacher-exams-top-grid">
        <TeacherExamsFiltersCard {...examsPage.filtersCardProps} />
        <TeacherExamsOpsCard {...examsPage.opsCardProps} />
      </div>

      <TeacherExamsQueueCard {...examsPage.queueCardProps} />
    </div>
  );
}
