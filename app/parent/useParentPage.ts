"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AssignmentListItem,
  AssignmentSummary,
  CorrectionSummary,
  CorrectionTask,
  EffectSummary,
  ExecutionSummary,
  FavoriteItem,
  ParentActionItem,
  WeeklyReport
} from "./types";
import {
  buildParentCorrectionsReminderText,
  deriveParentTaskBuckets,
  pruneParentReceiptNotes
} from "./utils";
import { useParentPageActions } from "./useParentPageActions";
import { useParentPageLoaders } from "./useParentPageLoaders";

export function useParentPage() {
  const loadRequestIdRef = useRef(0);
  const hasReportSnapshotRef = useRef(false);
  const hasCorrectionsSnapshotRef = useRef(false);
  const hasAssignmentsSnapshotRef = useRef(false);
  const hasFavoritesSnapshotRef = useRef(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [tasks, setTasks] = useState<CorrectionTask[]>([]);
  const [summary, setSummary] = useState<CorrectionSummary | null>(null);
  const [reminderCopied, setReminderCopied] = useState(false);
  const [assignmentList, setAssignmentList] = useState<AssignmentListItem[]>([]);
  const [assignmentSummary, setAssignmentSummary] = useState<AssignmentSummary | null>(null);
  const [assignmentExecution, setAssignmentExecution] = useState<ExecutionSummary | null>(null);
  const [assignmentEffect, setAssignmentEffect] = useState<EffectSummary | null>(null);
  const [assignmentReminder, setAssignmentReminder] = useState("");
  const [assignmentActionItems, setAssignmentActionItems] = useState<ParentActionItem[]>([]);
  const [assignmentParentTips, setAssignmentParentTips] = useState<string[]>([]);
  const [assignmentEstimatedMinutes, setAssignmentEstimatedMinutes] = useState(0);
  const [assignmentCopied, setAssignmentCopied] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [receiptLoadingKey, setReceiptLoadingKey] = useState<string | null>(null);
  const [receiptNotes, setReceiptNotes] = useState<Record<string, string>>({});
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearReportState = useCallback(() => {
    hasReportSnapshotRef.current = false;
    setReport(null);
  }, []);

  const clearCorrectionsState = useCallback(() => {
    hasCorrectionsSnapshotRef.current = false;
    setTasks([]);
    setSummary(null);
  }, []);

  const clearAssignmentsState = useCallback(() => {
    hasAssignmentsSnapshotRef.current = false;
    setAssignmentList([]);
    setAssignmentSummary(null);
    setAssignmentExecution(null);
    setAssignmentEffect(null);
    setAssignmentReminder("");
    setAssignmentActionItems([]);
    setAssignmentParentTips([]);
    setAssignmentEstimatedMinutes(0);
  }, []);

  const clearFavoritesState = useCallback(() => {
    hasFavoritesSnapshotRef.current = false;
    setFavorites([]);
  }, []);

  const clearParentPageState = useCallback(() => {
    clearReportState();
    clearCorrectionsState();
    clearAssignmentsState();
    clearFavoritesState();
    setReminderCopied(false);
    setAssignmentCopied(false);
    setReceiptLoadingKey(null);
    setReceiptNotes({});
    setReceiptError(null);
    setPageError(null);
    setLastLoadedAt(null);
  }, [clearAssignmentsState, clearCorrectionsState, clearFavoritesState, clearReportState]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearParentPageState();
    setLoading(false);
    setRefreshing(false);
    setAuthRequired(true);
  }, [clearParentPageState]);

  const { loadAll } = useParentPageLoaders({
    loadRequestIdRef,
    hasReportSnapshotRef,
    hasCorrectionsSnapshotRef,
    hasAssignmentsSnapshotRef,
    hasFavoritesSnapshotRef,
    clearReportState,
    clearCorrectionsState,
    clearAssignmentsState,
    clearFavoritesState,
    clearParentPageState,
    handleAuthRequired,
    setReport,
    setTasks,
    setSummary,
    setAssignmentList,
    setAssignmentSummary,
    setAssignmentExecution,
    setAssignmentEffect,
    setAssignmentReminder,
    setAssignmentActionItems,
    setAssignmentParentTips,
    setAssignmentEstimatedMinutes,
    setFavorites,
    setLoading,
    setRefreshing,
    setPageError,
    setAuthRequired,
    setLastLoadedAt
  });

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setReceiptNotes((prev) =>
      pruneParentReceiptNotes(prev, [
        { source: "weekly_report", items: report?.actionItems ?? [] },
        { source: "assignment_plan", items: assignmentActionItems }
      ])
    );
  }, [assignmentActionItems, report]);

  const { pendingTasks, dueSoonTasks, overdueTasks } = deriveParentTaskBuckets(tasks);
  const pendingWeeklyActionItems = (report?.actionItems ?? []).filter((item) => item.receipt?.status !== "done");
  const pendingAssignmentActionItems = assignmentActionItems.filter((item) => item.receipt?.status !== "done");
  const reminderText = buildParentCorrectionsReminderText({
    summary,
    pendingTasks,
    dueSoonTasks,
    overdueTasks
  });
  const hasParentData = report !== null;

  const refreshPage = useCallback(async () => {
    await loadAll("refresh");
  }, [loadAll]);

  const {
    submitReceipt,
    copyCorrectionsReminder: handleCopyCorrectionsReminder,
    copyAssignmentsReminder: handleCopyAssignmentsReminder
  } = useParentPageActions({
    receiptNotes,
    loadAll,
    handleAuthRequired,
    clearParentPageState,
    setReceiptLoadingKey,
    setReceiptError,
    setAuthRequired,
    setReminderCopied,
    setAssignmentCopied
  });

  const handleReceiptNoteChange = useCallback((key: string, value: string) => {
    setReceiptNotes((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    report,
    tasks,
    summary,
    reminderCopied,
    assignmentList,
    assignmentSummary,
    assignmentExecution,
    assignmentEffect,
    assignmentReminder,
    assignmentActionItems,
    assignmentParentTips,
    assignmentEstimatedMinutes,
    assignmentCopied,
    favorites,
    receiptLoadingKey,
    receiptNotes,
    receiptError,
    loading,
    refreshing,
    pageError,
    authRequired,
    lastLoadedAt,
    pendingTasks,
    dueSoonTasks,
    overdueTasks,
    pendingWeeklyActionItems,
    pendingAssignmentActionItems,
    reminderText,
    hasParentData,
    refreshPage,
    submitReceipt,
    handleReceiptNoteChange,
    copyCorrectionsReminder: () => handleCopyCorrectionsReminder(reminderText),
    copyAssignmentsReminder: () => handleCopyAssignmentsReminder(assignmentReminder)
  };
}
