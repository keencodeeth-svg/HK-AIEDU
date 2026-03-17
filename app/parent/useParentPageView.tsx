"use client";

import type { ComponentProps } from "react";
import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspacePage, { buildStaleDataNotice } from "@/components/WorkspacePage";
import ParentAssignmentsCard from "./_components/ParentAssignmentsCard";
import {
  ParentExecutionSummaryCard,
  ParentNextStepCard
} from "./_components/ParentActionCenterPanels";
import ParentCorrectionsCard from "./_components/ParentCorrectionsCard";
import ParentFavoritesCard from "./_components/ParentFavoritesCard";
import ParentWeakPointsCard from "./_components/ParentWeakPointsCard";
import ParentWeeklyReportCard from "./_components/ParentWeeklyReportCard";
import { useParentPage } from "./useParentPage";

export function useParentPageView() {
  const page = useParentPage();

  const workspacePageProps: Omit<ComponentProps<typeof WorkspacePage>, "children"> = {
    title: "家长空间",
    subtitle: "把“看报告”改成“今晚先做什么”，帮助家长真正完成陪伴闭环。",
    lastLoadedAt: page.lastLoadedAt,
    chips: [
      <span key="parent-collab" className="chip">
        家校协作
      </span>,
      <span key="parent-pending" className="chip">
        待回执动作 {page.pendingWeeklyActionItems.length + page.pendingAssignmentActionItems.length} 项
      </span>,
      <span key="parent-must" className="chip">
        今晚必跟进 {(page.summary?.overdue ?? page.overdueTasks.length) + (page.assignmentSummary?.overdue ?? 0)} 项
      </span>,
      <span key="parent-favorites" className="chip">
        收藏 {page.favorites.length} 题
      </span>
    ],
    actions: (
      <>
        <a className="button primary" href="#parent-action-center">
          去今晚第一步
        </a>
        <a className="button ghost" href="#parent-assignments">
          去作业回执
        </a>
        <button
          className="button secondary"
          type="button"
          onClick={() => void page.refreshPage()}
          disabled={page.loading || page.refreshing || page.receiptLoadingKey !== null}
        >
          {page.refreshing ? "刷新中..." : "刷新"}
        </button>
      </>
    ),
    notices: page.pageError
      ? [
          buildStaleDataNotice(
            page.pageError,
            <button className="button secondary" type="button" onClick={() => void page.refreshPage()}>
              再试一次
            </button>
          )
        ]
      : undefined
  };

  const nextStepProps: ComponentProps<typeof ParentNextStepCard> = {
    report: page.report!,
    correctionSummary: page.summary,
    assignmentSummary: page.assignmentSummary,
    assignmentActionItems: page.assignmentActionItems,
    assignmentExecution: page.assignmentExecution,
    pendingCorrectionCount: page.pendingTasks.length,
    overdueCorrectionCount: page.overdueTasks.length,
    dueSoonCorrectionCount: page.dueSoonTasks.length,
    favoritesCount: page.favorites.length
  };

  const correctionsProps: ComponentProps<typeof ParentCorrectionsCard> = {
    summary: page.summary,
    pendingCount: page.pendingTasks.length,
    overdueCount: page.overdueTasks.length,
    dueSoonCount: page.dueSoonTasks.length,
    reminderText: page.reminderText,
    reminderCopied: page.reminderCopied,
    onCopyReminder: () => {
      void page.copyCorrectionsReminder();
    }
  };

  const assignmentsProps: ComponentProps<typeof ParentAssignmentsCard> = {
    assignmentSummary: page.assignmentSummary,
    assignmentEstimatedMinutes: page.assignmentEstimatedMinutes,
    assignmentActionItems: page.assignmentActionItems,
    assignmentExecution: page.assignmentExecution,
    assignmentEffect: page.assignmentEffect,
    assignmentList: page.assignmentList,
    assignmentReminder: page.assignmentReminder,
    assignmentParentTips: page.assignmentParentTips,
    assignmentCopied: page.assignmentCopied,
    receiptError: page.receiptError,
    receiptNotes: page.receiptNotes,
    receiptLoadingKey: page.receiptLoadingKey,
    onNoteChange: page.handleReceiptNoteChange,
    onSubmitReceipt: page.submitReceipt,
    onCopyReminder: () => {
      void page.copyAssignmentsReminder();
    }
  };

  const executionSummaryProps: ComponentProps<typeof ParentExecutionSummaryCard> = {
    report: page.report!,
    correctionSummary: page.summary,
    assignmentSummary: page.assignmentSummary,
    assignmentActionItems: page.assignmentActionItems,
    assignmentExecution: page.assignmentExecution,
    pendingCorrectionCount: page.pendingTasks.length,
    overdueCorrectionCount: page.overdueTasks.length,
    dueSoonCorrectionCount: page.dueSoonTasks.length,
    favoritesCount: page.favorites.length
  };

  const weeklyReportProps: ComponentProps<typeof ParentWeeklyReportCard> = {
    report: page.report!,
    receiptError: page.receiptError,
    receiptNotes: page.receiptNotes,
    receiptLoadingKey: page.receiptLoadingKey,
    onNoteChange: page.handleReceiptNoteChange,
    onSubmitReceipt: page.submitReceipt
  };

  const weakPointsProps: ComponentProps<typeof ParentWeakPointsCard> = {
    report: page.report!
  };

  const favoritesProps: ComponentProps<typeof ParentFavoritesCard> = {
    favorites: page.favorites
  };

  return {
    loading: page.loading,
    authRequired: page.authRequired,
    pageError: page.pageError,
    hasParentData: page.hasParentData,
    refreshPage: () => {
      void page.refreshPage();
    },
    workspacePageProps,
    nextStepProps,
    correctionsProps,
    assignmentsProps,
    executionSummaryProps,
    weeklyReportProps,
    weakPointsProps,
    favoritesProps,
    scheduleFocusProps: { variant: "parent" as ComponentProps<typeof RoleScheduleFocusCard>["variant"] }
  };
}
