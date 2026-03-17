"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAuthError, requestJson } from "@/lib/client-request";
import type {
  AssignmentListItem,
  AssignmentSummary,
  CorrectionSummary,
  CorrectionTask,
  EffectSummary,
  ExecutionSummary,
  FavoriteItem,
  ParentActionItem,
  ReceiptSource,
  ReceiptStatus,
  WeeklyReport
} from "./types";
import {
  getParentAssignmentsRequestMessage,
  getParentCorrectionsRequestMessage,
  getParentFavoritesRequestMessage,
  getParentReceiptSubmitRequestMessage,
  getParentReportRequestMessage,
  isParentMissingActionItemError,
  isParentMissingStudentContextError,
  pruneParentReceiptNotes
} from "./utils";

type ParentAssignmentsPayload = {
  data?: AssignmentListItem[];
  summary?: AssignmentSummary | null;
  execution?: ExecutionSummary | null;
  effect?: EffectSummary | null;
  reminderText?: string;
  actionItems?: ParentActionItem[];
  parentTips?: string[];
  estimatedMinutes?: number;
};

type ParentCorrectionsPayload = {
  data?: CorrectionTask[];
  summary?: CorrectionSummary | null;
};

type ParentFavoritesPayload = {
  data?: FavoriteItem[];
};

type ParentActionReceiptPayload = {
  data?: unknown;
};

type ParentLoadResult = {
  errorMessage: string | null;
  hasSuccess: boolean;
  status: "auth" | "error" | "loaded" | "stale";
};

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

  const loadAll = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<ParentLoadResult> => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const [reportResult, correctionsResult, assignmentsResult, favoritesResult] = await Promise.allSettled([
          requestJson<WeeklyReport>("/api/report/weekly"),
          requestJson<ParentCorrectionsPayload>("/api/corrections"),
          requestJson<ParentAssignmentsPayload>("/api/parent/assignments"),
          requestJson<ParentFavoritesPayload>("/api/parent/favorites")
        ]);

        if (loadRequestIdRef.current !== requestId) {
          return { status: "stale", errorMessage: null, hasSuccess: false };
        }

        const results = [reportResult, correctionsResult, assignmentsResult, favoritesResult];
        const parentContextFailure = results.some(
          (result) => result.status === "rejected" && isParentMissingStudentContextError(result.reason)
        );
        const authFailure = results.some(
          (result) => result.status === "rejected" && isAuthError(result.reason)
        );

        if (parentContextFailure) {
          clearParentPageState();
          setAuthRequired(false);
          const nextPageError = [
            reportResult.status === "rejected"
              ? `家长周报加载失败：${getParentReportRequestMessage(reportResult.reason, "加载家长周报失败")}`
              : null,
            correctionsResult.status === "rejected"
              ? `订正任务加载失败：${getParentCorrectionsRequestMessage(correctionsResult.reason, "加载订正任务失败")}`
              : null,
            assignmentsResult.status === "rejected"
              ? `作业提醒加载失败：${getParentAssignmentsRequestMessage(assignmentsResult.reason, "加载作业提醒失败")}`
              : null,
            favoritesResult.status === "rejected"
              ? `收藏题目加载失败：${getParentFavoritesRequestMessage(favoritesResult.reason, "加载收藏题目失败")}`
              : null
          ]
            .filter(Boolean)
            .join("；");
          setPageError(nextPageError || "当前家长账号尚未绑定学生信息，绑定后即可查看孩子的学习动态。");
          return { status: "error", errorMessage: nextPageError, hasSuccess: false };
        }

        if (authFailure) {
          handleAuthRequired();
          return { status: "auth", errorMessage: null, hasSuccess: false };
        }

        let hasSuccess = false;
        const nextErrors: string[] = [];

        if (reportResult.status === "fulfilled") {
          hasReportSnapshotRef.current = true;
          setReport(reportResult.value);
          hasSuccess = true;
        } else {
          if (!hasReportSnapshotRef.current) {
            clearReportState();
          }
          nextErrors.push(`家长周报加载失败：${getParentReportRequestMessage(reportResult.reason, "加载家长周报失败")}`);
        }

        if (correctionsResult.status === "fulfilled") {
          hasCorrectionsSnapshotRef.current = true;
          setTasks(correctionsResult.value.data ?? []);
          setSummary(correctionsResult.value.summary ?? null);
          hasSuccess = true;
        } else {
          if (!hasCorrectionsSnapshotRef.current) {
            clearCorrectionsState();
          }
          nextErrors.push(
            `订正任务加载失败：${getParentCorrectionsRequestMessage(correctionsResult.reason, "加载订正任务失败")}`
          );
        }

        if (assignmentsResult.status === "fulfilled") {
          hasAssignmentsSnapshotRef.current = true;
          setAssignmentList(assignmentsResult.value.data ?? []);
          setAssignmentSummary(assignmentsResult.value.summary ?? null);
          setAssignmentExecution(assignmentsResult.value.execution ?? null);
          setAssignmentEffect(assignmentsResult.value.effect ?? null);
          setAssignmentReminder(assignmentsResult.value.reminderText ?? "");
          setAssignmentActionItems(assignmentsResult.value.actionItems ?? []);
          setAssignmentParentTips(assignmentsResult.value.parentTips ?? []);
          setAssignmentEstimatedMinutes(assignmentsResult.value.estimatedMinutes ?? 0);
          hasSuccess = true;
        } else {
          if (!hasAssignmentsSnapshotRef.current) {
            clearAssignmentsState();
          }
          nextErrors.push(
            `作业提醒加载失败：${getParentAssignmentsRequestMessage(assignmentsResult.reason, "加载作业提醒失败")}`
          );
        }

        if (favoritesResult.status === "fulfilled") {
          hasFavoritesSnapshotRef.current = true;
          setFavorites(favoritesResult.value.data ?? []);
          hasSuccess = true;
        } else {
          if (!hasFavoritesSnapshotRef.current) {
            clearFavoritesState();
          }
          nextErrors.push(
            `收藏题目加载失败：${getParentFavoritesRequestMessage(favoritesResult.reason, "加载收藏题目失败")}`
          );
        }

        setAuthRequired(false);
        if (hasSuccess) {
          setLastLoadedAt(new Date().toISOString());
        }
        if (nextErrors.length) {
          setPageError(nextErrors.join("；"));
        }

        return {
          status: nextErrors.length ? "error" : "loaded",
          errorMessage: nextErrors.length ? nextErrors.join("；") : null,
          hasSuccess
        };
      } catch (nextError) {
        if (loadRequestIdRef.current !== requestId) {
          return { status: "stale", errorMessage: null, hasSuccess: false };
        }
        if (isParentMissingStudentContextError(nextError)) {
          clearParentPageState();
          setAuthRequired(false);
          const nextPageError = getParentAssignmentsRequestMessage(nextError, "加载家长空间失败");
          setPageError(nextPageError);
          return { status: "error", errorMessage: nextPageError, hasSuccess: false };
        }
        if (isAuthError(nextError)) {
          handleAuthRequired();
          return { status: "auth", errorMessage: null, hasSuccess: false };
        }

        if (!hasReportSnapshotRef.current) {
          clearReportState();
        }
        if (!hasCorrectionsSnapshotRef.current) {
          clearCorrectionsState();
        }
        if (!hasAssignmentsSnapshotRef.current) {
          clearAssignmentsState();
        }
        if (!hasFavoritesSnapshotRef.current) {
          clearFavoritesState();
        }

        const nextPageError = getParentReportRequestMessage(nextError, "加载家长空间失败");
        setAuthRequired(false);
        setPageError(nextPageError);
        return { status: "error", errorMessage: nextPageError, hasSuccess: false };
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      clearAssignmentsState,
      clearCorrectionsState,
      clearFavoritesState,
      clearParentPageState,
      clearReportState,
      handleAuthRequired
    ]
  );

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

  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const dueSoonTasks = pendingTasks.filter((task) => {
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff >= 0 && diff <= 2 * 24 * 60 * 60 * 1000;
  });
  const overdueTasks = pendingTasks.filter((task) => new Date(task.dueDate).getTime() < Date.now());
  const pendingWeeklyActionItems = (report?.actionItems ?? []).filter((item) => item.receipt?.status !== "done");
  const pendingAssignmentActionItems = assignmentActionItems.filter((item) => item.receipt?.status !== "done");
  const reminderText = [
    `本周订正任务：待完成 ${summary?.pending ?? pendingTasks.length} 题。`,
    overdueTasks.length ? `已逾期 ${overdueTasks.length} 题，请尽快完成。` : "",
    dueSoonTasks.length ? `近 2 天到期 ${dueSoonTasks.length} 题。` : "",
    ...dueSoonTasks
      .slice(0, 3)
      .map((task) => `- ${task.question?.stem ?? "题目"}（截止 ${new Date(task.dueDate).toLocaleDateString("zh-CN")}）`)
  ]
    .filter(Boolean)
    .join("\n");
  const hasParentData = report !== null;

  const refreshPage = useCallback(async () => {
    await loadAll("refresh");
  }, [loadAll]);

  async function submitReceipt(source: ReceiptSource, item: ParentActionItem, status: ReceiptStatus) {
    const key = `${source}:${item.id}`;
    const note = (receiptNotes[key] ?? "").trim();
    if (status === "skipped" && note.length < 2) {
      setReceiptError("如选择“暂时跳过”，请填写至少 2 个字的原因。");
      return;
    }

    setReceiptError(null);
    setReceiptLoadingKey(key);
    try {
      await requestJson<ParentActionReceiptPayload>("/api/parent/action-items/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          actionItemId: item.id,
          status,
          note: note || undefined,
          estimatedMinutes: item.estimatedMinutes ?? 0
        })
      });
      await loadAll("refresh");
    } catch (nextError) {
      if (isParentMissingStudentContextError(nextError)) {
        clearParentPageState();
        setAuthRequired(false);
        setReceiptError(getParentReceiptSubmitRequestMessage(nextError, "回执提交失败"));
        return;
      }
      if (isAuthError(nextError)) {
        handleAuthRequired();
        return;
      }
      const nextReceiptError = getParentReceiptSubmitRequestMessage(nextError, "回执提交失败");
      setReceiptError(nextReceiptError);
      if (isParentMissingActionItemError(nextError)) {
        await loadAll("refresh");
      }
    } finally {
      setReceiptLoadingKey(null);
    }
  }

  async function copyText(text: string, setCopied: (value: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
    copyCorrectionsReminder: () => copyText(reminderText, setReminderCopied),
    copyAssignmentsReminder: () => copyText(assignmentReminder, setAssignmentCopied)
  };
}
