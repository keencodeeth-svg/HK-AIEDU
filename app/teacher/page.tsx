"use client";

import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspacePage, {
  WorkspaceAuthState,
  WorkspaceErrorState,
  WorkspaceLoadingState
} from "@/components/WorkspacePage";
import TeacherDashboardSectionHeader from "./_components/TeacherDashboardSectionHeader";
import { TeacherAssignmentsCard, TeacherClassListCard, TeacherJoinRequestsCard } from "./_components/TeacherCollectionPanels";
import { TeacherAddStudentCard, TeacherAssignmentComposerCard, TeacherCreateClassCard } from "./_components/TeacherFormPanels";
import { TeacherExamModuleCard, TeacherInsightsCard, TeacherOverviewCard, TeacherQuickAccessCards } from "./_components/TeacherSummaryPanels";
import { TeacherExecutionSummaryCard, TeacherNextStepCard } from "./_components/TeacherPrimaryFlowPanels";
import TeacherTeachingLoopCard from "./_components/TeacherTeachingLoopCard";
import { useTeacherDashboardPageView } from "./useTeacherDashboardPageView";

export default function TeacherPage() {
  const {
    loading,
    pageError,
    pageReady,
    unauthorized,
    refreshDashboard,
    workspacePageProps,
    nextStepProps,
    assignmentComposerProps,
    joinRequestsProps,
    executionSummaryProps,
    teachingLoopProps,
    insightsProps,
    overviewProps,
    createClassProps,
    addStudentProps,
    classListProps,
    assignmentsProps,
    scheduleFocusProps
  } = useTeacherDashboardPageView();

  if (loading && !pageReady && !unauthorized) {
    return <WorkspaceLoadingState title="教师工作台加载中" description="正在同步班级、作业、预警和教学执行数据。" />;
  }

  if (unauthorized) {
    return <WorkspaceAuthState title="需要教师账号登录" description="请先使用教师账号登录后，再查看教学工作台和班级执行动作。" />;
  }

  if (pageError && !pageReady) {
    return (
      <WorkspaceErrorState
        title="教师工作台加载失败"
        description={pageError}
        onRetry={() => void refreshDashboard()}
      />
    );
  }

  return (
    <WorkspacePage {...workspacePageProps}>
      <TeacherDashboardSectionHeader
        title="现在先开工"
        description="首屏先只看阻塞项、风险和今天第一步，不在首页重新排一次教学优先级。"
        chip="Action-first"
      />

      <div id="teacher-action-center">
        <TeacherNextStepCard {...nextStepProps} />
      </div>

      <TeacherDashboardSectionHeader
        title="今天要执行的动作"
        description="先把最常见的教学执行入口放在前面，再回头看盘面说明和课表上下文。"
        chip="Execution"
      />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="teacher-compose-assignment">
          <TeacherAssignmentComposerCard {...assignmentComposerProps} />
        </div>

        <div id="teacher-join-requests">
          <TeacherJoinRequestsCard {...joinRequestsProps} />
        </div>
      </div>

      <TeacherDashboardSectionHeader
        title="盘面与上下文"
        description="执行入口明确后，再看风险覆盖、教学闭环和课表背景，避免首屏并列太多总览卡片。"
        chip="Context"
      />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <TeacherExecutionSummaryCard {...executionSummaryProps} />
        <RoleScheduleFocusCard {...scheduleFocusProps} />
      </div>

      <TeacherTeachingLoopCard {...teachingLoopProps} />

      <TeacherInsightsCard {...insightsProps} />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <TeacherOverviewCard {...overviewProps} />
        <TeacherExamModuleCard />
      </div>

      <TeacherQuickAccessCards />

      <div className="grid grid-2">
        <div id="teacher-create-class">
          <TeacherCreateClassCard {...createClassProps} />
        </div>
        <div id="teacher-add-student">
          <TeacherAddStudentCard {...addStudentProps} />
        </div>
      </div>

      <div id="teacher-class-list">
        <TeacherClassListCard {...classListProps} />
      </div>

      <div id="teacher-assignment-list">
        <TeacherAssignmentsCard {...assignmentsProps} />
      </div>
    </WorkspacePage>
  );
}
