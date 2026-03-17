"use client";

import WorkspacePage, { WorkspaceAuthState, WorkspaceErrorState, WorkspaceLoadingState } from "@/components/WorkspacePage";
import StudentDashboardSectionHeader from "./_components/StudentDashboardSectionHeader";
import StudentDashboardGuideCard from "./_components/StudentDashboardGuideCard";
import StudentEntryCollection from "./_components/StudentEntryCollection";
import StudentExecutionSummaryCard from "./_components/StudentExecutionSummaryCard";
import StudentLearningLoopCard from "./_components/StudentLearningLoopCard";
import StudentMotivationCard from "./_components/StudentMotivationCard";
import StudentNextActionCard from "./_components/StudentNextActionCard";
import StudentPriorityTasksCard from "./_components/StudentPriorityTasksCard";
import StudentQuickTutorCard from "./_components/StudentQuickTutorCard";
import StudentScheduleCard from "./_components/StudentScheduleCard";
import StudentTaskOverviewCard from "./_components/StudentTaskOverviewCard";
import StudentUnifiedTaskQueueCard from "./_components/StudentUnifiedTaskQueueCard";
import { CATEGORY_META } from "./utils";
import { useStudentDashboardPageView } from "./useStudentDashboardPageView";

export default function StudentPage() {
  const dashboardPage = useStudentDashboardPageView();

  if (dashboardPage.loading && !dashboardPage.hasDashboardData && !dashboardPage.authRequired) {
    return <WorkspaceLoadingState title="学习控制台加载中" description="正在汇总课表、学习计划、今日任务和成长激励。" />;
  }

  if (dashboardPage.authRequired) {
    return <WorkspaceAuthState title="需要学生账号登录" description="请先登录学生账号，再查看学习控制台和今日任务。" />;
  }

  if (dashboardPage.pageError && !dashboardPage.hasDashboardData) {
    return <WorkspaceErrorState title="学习控制台加载失败" description={dashboardPage.pageError} onRetry={dashboardPage.retryDashboard} />;
  }

  return (
    <WorkspacePage {...dashboardPage.workspacePageProps}>
      <StudentDashboardSectionHeader
        title="现在直接开始"
        description="先看第一项和时间风险，不再在首页自己重排一遍优先级。"
        chip="Action-first"
      />

      <div id="student-action-center">
        <StudentNextActionCard {...dashboardPage.nextActionCardProps} />
      </div>

      {dashboardPage.radarError ? <div className="status-note info">{dashboardPage.radarError}。首页仍会展示任务与课表，但画像相关建议可能不是最新。</div> : null}

      <StudentDashboardSectionHeader
        title="卡住时别停"
        description="首屏只保留两个兜底入口：快问快答和高优先任务。"
        chip="Keep Moving"
      />

      <div id="student-next-action" className="student-context-grid">
        <StudentQuickTutorCard {...dashboardPage.quickTutorCardProps} />

        <div className="grid" style={{ gap: 10 }}>
          <div id="student-priority-tasks">
            <StudentPriorityTasksCard {...dashboardPage.priorityTasksCardProps} />
          </div>
          <StudentTaskOverviewCard {...dashboardPage.taskOverviewCardProps} />
        </div>
      </div>

      <StudentDashboardSectionHeader
        title="时间与上下文"
        description="先明确第一步和兜底动作，再看时间预算、课表联动和完整任务上下文。"
        chip="Context"
      />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <StudentExecutionSummaryCard {...dashboardPage.executionSummaryCardProps} />

        <StudentScheduleCard {...dashboardPage.scheduleCardProps} />
      </div>

      <StudentDashboardSectionHeader
        title="完整任务队列"
        description="当你需要看全部任务来源和完整顺序时，再展开完整队列。"
        chip="Queue"
      />

      <div id="student-task-queue">
        <StudentUnifiedTaskQueueCard {...dashboardPage.unifiedTaskQueueCardProps} />
      </div>

      <StudentDashboardSectionHeader
        title="做完后再回看"
        description="这里放学习闭环说明、激励和新手引导，不抢你开工前的注意力。"
        chip="After Start"
      />

      <StudentLearningLoopCard {...dashboardPage.learningLoopCardProps} />

      <div className="student-overview-grid">
        <StudentMotivationCard {...dashboardPage.motivationCardProps} />
        <StudentDashboardGuideCard {...dashboardPage.dashboardGuideCardProps} />
      </div>

      <StudentDashboardSectionHeader
        title="学习入口"
        description={CATEGORY_META[dashboardPage.entryCollectionProps.activeCategory].description}
        chip={CATEGORY_META[dashboardPage.entryCollectionProps.activeCategory].label}
      />

      <StudentEntryCollection {...dashboardPage.entryCollectionProps} />
    </WorkspacePage>
  );
}
