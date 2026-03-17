"use client";

import type { ComponentProps } from "react";
import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspacePage, {
  buildStaleDataNotice,
  buildSuccessNotice,
  type WorkspaceNoticeItem
} from "@/components/WorkspacePage";
import {
  TeacherAssignmentsCard,
  TeacherClassListCard,
  TeacherJoinRequestsCard
} from "./_components/TeacherCollectionPanels";
import {
  TeacherAddStudentCard,
  TeacherAssignmentComposerCard,
  TeacherCreateClassCard
} from "./_components/TeacherFormPanels";
import {
  TeacherInsightsCard,
  TeacherOverviewCard
} from "./_components/TeacherSummaryPanels";
import {
  TeacherExecutionSummaryCard,
  TeacherNextStepCard
} from "./_components/TeacherPrimaryFlowPanels";
import TeacherTeachingLoopCard from "./_components/TeacherTeachingLoopCard";
import { useTeacherDashboardPage } from "./useTeacherDashboardPage";

export function useTeacherDashboardPageView() {
  const page = useTeacherDashboardPage();

  const notices: WorkspaceNoticeItem[] = [];
  if (page.staleDataError) {
    notices.push(
      buildStaleDataNotice(page.staleDataError, (
        <button
          className="button secondary"
          type="button"
          onClick={() => void page.refreshDashboard()}
          disabled={page.loading}
        >
          {page.loading ? "刷新中..." : "再试一次"}
        </button>
      ))
    );
  }
  if (page.knowledgePointsNotice) {
    notices.push({
      id: "teacher-kp-error",
      tone: "error",
      title: "知识点目录同步失败",
      description: page.knowledgePointsNotice
    });
  }
  if (page.error) {
    notices.push({ id: "teacher-error", tone: "error", title: "本次操作存在异常", description: page.error });
  }
  if (page.message) {
    notices.push(buildSuccessNotice(page.message));
  }

  const workspacePageProps: Omit<ComponentProps<typeof WorkspacePage>, "children"> = {
    title: "教师工作台",
    subtitle: "先稳住风险和阻塞，再推进作业与课堂动作，最后回到学情和成绩确认效果。",
    lastLoadedAt: page.lastLoadedAt,
    chips: [
      <span key="teacher-progress" className="chip">
        教学进度跟踪
      </span>,
      page.pendingJoinCount ? <span key="teacher-join" className="chip">待审申请 {page.pendingJoinCount}</span> : null,
      page.activeAlertCount ? <span key="teacher-alert" className="chip">活跃预警 {page.activeAlertCount}</span> : null,
      page.classesMissingAssignmentsCount ? (
        <span key="teacher-gap" className="chip">待补作业班级 {page.classesMissingAssignmentsCount}</span>
      ) : null,
      page.dueSoonAssignmentCount ? (
        <span key="teacher-due" className="chip">48h 截止作业 {page.dueSoonAssignmentCount}</span>
      ) : null
    ].filter(Boolean),
    actions: (
      <>
        <a className="button primary" href="#teacher-action-center">
          去今日第一步
        </a>
        <a className="button ghost" href="#teacher-compose-assignment">
          去发布作业
        </a>
        <button
          className="button secondary"
          type="button"
          onClick={() => void page.refreshDashboard()}
          disabled={page.loading}
        >
          {page.loading ? "刷新中..." : "刷新"}
        </button>
      </>
    ),
    notices
  };

  const nextStepProps: ComponentProps<typeof TeacherNextStepCard> = {
    classes: page.classes,
    assignments: page.assignments,
    joinRequests: page.joinRequests,
    insights: page.insights
  };

  const assignmentComposerProps: ComponentProps<typeof TeacherAssignmentComposerCard> = {
    classes: page.classes,
    modules: page.modules,
    assignmentForm: page.assignmentForm,
    filteredPoints: page.filteredPoints,
    loading: page.loading,
    assignmentError: page.assignmentError ?? page.assignmentLoadError,
    assignmentMessage: page.assignmentMessage,
    onChange: page.updateAssignmentForm,
    onSubmit: page.handleCreateAssignment
  };

  const joinRequestsProps: ComponentProps<typeof TeacherJoinRequestsCard> = {
    joinRequests: page.joinRequests,
    onApprove: page.handleApprove,
    onReject: page.handleReject
  };

  const executionSummaryProps: ComponentProps<typeof TeacherExecutionSummaryCard> = {
    classes: page.classes,
    assignments: page.assignments,
    joinRequests: page.joinRequests,
    insights: page.insights
  };

  const teachingLoopProps: ComponentProps<typeof TeacherTeachingLoopCard> = {
    classes: page.classes,
    assignments: page.assignments,
    joinRequests: page.joinRequests,
    insights: page.insights
  };

  const insightsProps: ComponentProps<typeof TeacherInsightsCard> = {
    insights: page.insights,
    actingAlertKey: page.actingAlertKey,
    acknowledgingAlertId: page.acknowledgingAlertId,
    impactByAlertId: page.impactByAlertId,
    loadingImpactId: page.loadingImpactId,
    onRunAlertAction: page.runAlertAction,
    onAcknowledgeAlert: page.acknowledgeAlert,
    onLoadAlertImpact: page.loadAlertImpact
  };

  const overviewProps: ComponentProps<typeof TeacherOverviewCard> = {
    classes: page.classes,
    assignments: page.assignments,
    message: null,
    error: null
  };

  const createClassProps: ComponentProps<typeof TeacherCreateClassCard> = {
    classForm: page.classForm,
    loading: page.loading,
    onChange: page.updateClassForm,
    onSubmit: page.handleCreateClass
  };

  const addStudentProps: ComponentProps<typeof TeacherAddStudentCard> = {
    studentForm: page.studentForm,
    classes: page.classes,
    loading: page.loading,
    onChange: page.updateStudentForm,
    onSubmit: page.handleAddStudent
  };

  const classListProps: ComponentProps<typeof TeacherClassListCard> = {
    classes: page.classes,
    onRegenerateCode: page.handleRegenerateCode,
    onUpdateJoinMode: page.handleUpdateJoinMode
  };

  const assignmentsProps: ComponentProps<typeof TeacherAssignmentsCard> = {
    assignments: page.assignments
  };

  return {
    loading: page.loading,
    pageError: page.pageError,
    pageReady: page.pageReady,
    unauthorized: page.unauthorized,
    hasDashboardData: page.hasDashboardData,
    refreshDashboard: page.refreshDashboard,
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
    scheduleFocusProps: { variant: "teacher" as ComponentProps<typeof RoleScheduleFocusCard>["variant"] }
  };
}
