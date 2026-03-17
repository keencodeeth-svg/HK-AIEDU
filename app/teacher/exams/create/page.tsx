"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import ExamCreateCommitCard from "./_components/ExamCreateCommitCard";
import ExamCreateGuardrailsCard from "./_components/ExamCreateGuardrailsCard";
import ExamCreateLoopCard from "./_components/ExamCreateLoopCard";
import ExamCreateOverviewCard from "./_components/ExamCreateOverviewCard";
import ExamCreatePoolCard from "./_components/ExamCreatePoolCard";
import ExamCreatePublishCard from "./_components/ExamCreatePublishCard";
import ExamCreateScheduleCard from "./_components/ExamCreateScheduleCard";
import ExamCreateScopeCard from "./_components/ExamCreateScopeCard";
import { useTeacherExamCreatePageView } from "./useTeacherExamCreatePageView";

export default function CreateTeacherExamPage() {
  const createPage = useTeacherExamCreatePageView();

  if (createPage.authRequired) {
    return (
      <Card title="发布在线考试">
        <StatePanel
          compact
          tone="info"
          title="请先登录后创建在线考试"
          description="登录教师账号后即可配置班级范围、组卷规则和发布对象。"
          action={
            <Link className="button secondary" href="/login">
              前往登录
            </Link>
          }
        />
      </Card>
    );
  }

  if (createPage.loading && !createPage.hasConfigData) {
    return (
      <Card title="发布在线考试">
        <StatePanel compact tone="loading" title="考试创建页加载中" description="正在同步班级、知识点和学生范围。" />
      </Card>
    );
  }

  if (createPage.pageError && !createPage.hasClasses) {
    return (
      <Card title="发布在线考试">
        <StatePanel
          compact
          tone="error"
          title="考试创建页加载失败"
          description={createPage.pageError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={createPage.reload}>
                重试
              </button>
              <Link className="button ghost" href="/teacher/exams">
                返回考试列表
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  if (!createPage.hasClasses) {
    return (
      <Card title="发布在线考试">
        <StatePanel
          compact
          tone="empty"
          title="当前没有可发布考试的班级"
          description="先确认教师账号下已经有班级，再回来创建在线考试。"
          action={
            <Link className="button secondary" href="/teacher">
              返回教师端
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>发布在线考试</h2>
          <div className="section-sub">把班级范围、题库策略、发布时间和目标学生一次配清楚，再进入考试详情继续收口。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{createPage.classLabel}</span>
          <span className="chip">{createPage.publishModeLabel}</span>
          <span className="chip">{createPage.difficultyLabel}</span>
          <span className="chip">{createPage.questionCount} 题</span>
          <span className="chip">对象 {createPage.targetLabel}</span>
          {createPage.lastLoadedAtLabel ? <span className="chip">更新于 {createPage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={createPage.refresh} disabled={createPage.refreshDisabled}>
            {createPage.refreshing ? "刷新中..." : "刷新配置"}
          </button>
        </div>
      </div>

      <ExamCreateLoopCard {...createPage.loopCardProps} />

      <div className="teacher-exam-create-top-grid">
        <ExamCreateOverviewCard {...createPage.overviewCardProps} />
        <ExamCreateGuardrailsCard {...createPage.guardrailsCardProps} />
      </div>

      <form className="teacher-exam-create-form" onSubmit={createPage.handleSubmit}>
        <ExamCreateScopeCard {...createPage.scopeCardProps} />
        <ExamCreatePoolCard {...createPage.poolCardProps} />
        <ExamCreateScheduleCard {...createPage.scheduleCardProps} />
        <ExamCreatePublishCard {...createPage.publishCardProps} />
        <ExamCreateCommitCard {...createPage.commitCardProps} />
      </form>
    </div>
  );
}
