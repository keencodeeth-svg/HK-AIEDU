"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RoleScheduleFocusCard from "@/components/RoleScheduleFocusCard";
import WorkspacePage, { WorkspaceAuthState, WorkspaceEmptyState, WorkspaceErrorState, WorkspaceLoadingState, buildStaleDataNotice } from "@/components/WorkspacePage";
import { requestJson, type RequestError } from "@/lib/client-request";
import ParentAssignmentsCard from "./_components/ParentAssignmentsCard";
import ParentCorrectionsCard from "./_components/ParentCorrectionsCard";
import ParentFavoritesCard from "./_components/ParentFavoritesCard";
import { ParentExecutionSummaryCard, ParentNextStepCard } from "./_components/ParentActionCenterPanels";
import ParentWeakPointsCard from "./_components/ParentWeakPointsCard";
import ParentWeeklyReportCard from "./_components/ParentWeeklyReportCard";
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

export default function ParentPage() {
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

  const loadAll = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);

    try {
      const [weeklyData, correctionsData, assignmentsData, favoritesData] = await Promise.all([
        requestJson<WeeklyReport>("/api/report/weekly"),
        requestJson<ParentCorrectionsPayload>("/api/corrections"),
        requestJson<ParentAssignmentsPayload>("/api/parent/assignments"),
        requestJson<ParentFavoritesPayload>("/api/parent/favorites")
      ]);

      setAuthRequired(false);
      setReport(weeklyData);
      setTasks(correctionsData.data ?? []);
      setSummary(correctionsData.summary ?? null);
      setAssignmentList(assignmentsData.data ?? []);
      setAssignmentSummary(assignmentsData.summary ?? null);
      setAssignmentExecution(assignmentsData.execution ?? null);
      setAssignmentEffect(assignmentsData.effect ?? null);
      setAssignmentReminder(assignmentsData.reminderText ?? "");
      setAssignmentActionItems(assignmentsData.actionItems ?? []);
      setAssignmentParentTips(assignmentsData.parentTips ?? []);
      setAssignmentEstimatedMinutes(assignmentsData.estimatedMinutes ?? 0);
      setFavorites(favoritesData.data ?? []);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 401) {
        setAuthRequired(true);
        setReport(null);
        setTasks([]);
        setSummary(null);
        setAssignmentList([]);
        setAssignmentSummary(null);
        setAssignmentExecution(null);
        setAssignmentEffect(null);
        setAssignmentReminder("");
        setAssignmentActionItems([]);
        setAssignmentParentTips([]);
        setAssignmentEstimatedMinutes(0);
        setFavorites([]);
        setReceiptError(null);
      } else {
        setPageError(requestError.message || "加载失败");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
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
      const res = await fetch("/api/parent/action-items/receipt", {
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
      const data = await res.json();
      if (!res.ok) {
        setReceiptError(data?.error ?? "回执提交失败");
        return;
      }

      await loadAll("refresh");
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

  function handleReceiptNoteChange(key: string, value: string) {
    setReceiptNotes((prev) => ({ ...prev, [key]: value }));
  }

  if (loading && !report && !authRequired) {
    return <WorkspaceLoadingState title="家长空间加载中" description="正在同步学情周报、作业提醒、订正任务和收藏题目。" />;
  }

  if (authRequired) {
    return <WorkspaceAuthState title="请先使用家长账号登录" description="登录后即可查看孩子的周报、作业提醒、订正任务和监督建议。" />;
  }

  if (pageError && !report) {
    return <WorkspaceErrorState title="家长空间暂时不可用" description={pageError} onRetry={() => void loadAll("refresh")} retryLabel="重新加载" />;
  }

  if (!report) {
    return (
      <WorkspaceEmptyState
        title="暂时还没有可查看的家长周报"
        description="当前未生成本周学情数据，可稍后刷新，或等待孩子产生新的学习记录。"
        action={
          <button className="button secondary" type="button" onClick={() => void loadAll("refresh")}>
            刷新重试
          </button>
        }
      />
    );
  }

  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const dueSoonTasks = pendingTasks.filter((task) => {
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff >= 0 && diff <= 2 * 24 * 60 * 60 * 1000;
  });
  const overdueTasks = pendingTasks.filter((task) => new Date(task.dueDate).getTime() < Date.now());
  const pendingWeeklyActionItems = (report.actionItems ?? []).filter((item) => item.receipt?.status !== "done");
  const pendingAssignmentActionItems = assignmentActionItems.filter((item) => item.receipt?.status !== "done");
  const reminderText = [
    `本周订正任务：待完成 ${summary?.pending ?? pendingTasks.length} 题。`,
    overdueTasks.length ? `已逾期 ${overdueTasks.length} 题，请尽快完成。` : "",
    dueSoonTasks.length ? `近 2 天到期 ${dueSoonTasks.length} 题。` : "",
    ...dueSoonTasks.slice(0, 3).map((task) => `- ${task.question?.stem ?? "题目"}（截止 ${new Date(task.dueDate).toLocaleDateString("zh-CN")}）`)
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <WorkspacePage
      title="家长空间"
      subtitle="把“看报告”改成“今晚先做什么”，帮助家长真正完成陪伴闭环。"
      lastLoadedAt={lastLoadedAt}
      chips={[
        <span key="parent-collab" className="chip">家校协作</span>,
        <span key="parent-pending" className="chip">待回执动作 {pendingWeeklyActionItems.length + pendingAssignmentActionItems.length} 项</span>,
        <span key="parent-must" className="chip">今晚必跟进 {(summary?.overdue ?? overdueTasks.length) + (assignmentSummary?.overdue ?? 0)} 项</span>,
        <span key="parent-favorites" className="chip">收藏 {favorites.length} 题</span>
      ]}
      actions={
        <button
          className="button secondary"
          type="button"
          onClick={() => void loadAll("refresh")}
          disabled={loading || refreshing || receiptLoadingKey !== null}
        >
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      }
      notices={
        pageError
          ? [
              buildStaleDataNotice(
                pageError,
                <button className="button secondary" type="button" onClick={() => void loadAll("refresh")}>
                  再试一次
                </button>
              )
            ]
          : undefined
      }
    >

      <RoleScheduleFocusCard variant="parent" />

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <ParentNextStepCard
          report={report}
          correctionSummary={summary}
          assignmentSummary={assignmentSummary}
          assignmentActionItems={assignmentActionItems}
          assignmentExecution={assignmentExecution}
          pendingCorrectionCount={pendingTasks.length}
          overdueCorrectionCount={overdueTasks.length}
          dueSoonCorrectionCount={dueSoonTasks.length}
          favoritesCount={favorites.length}
        />
        <ParentExecutionSummaryCard
          report={report}
          correctionSummary={summary}
          assignmentSummary={assignmentSummary}
          assignmentActionItems={assignmentActionItems}
          assignmentExecution={assignmentExecution}
          pendingCorrectionCount={pendingTasks.length}
          overdueCorrectionCount={overdueTasks.length}
          dueSoonCorrectionCount={dueSoonTasks.length}
          favoritesCount={favorites.length}
        />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="parent-corrections">
          <ParentCorrectionsCard
            summary={summary}
            pendingCount={pendingTasks.length}
            overdueCount={overdueTasks.length}
            dueSoonCount={dueSoonTasks.length}
            reminderText={reminderText}
            reminderCopied={reminderCopied}
            onCopyReminder={() => copyText(reminderText, setReminderCopied)}
          />
        </div>
        <div id="parent-assignments">
          <ParentAssignmentsCard
            assignmentSummary={assignmentSummary}
            assignmentEstimatedMinutes={assignmentEstimatedMinutes}
            assignmentActionItems={assignmentActionItems}
            assignmentExecution={assignmentExecution}
            assignmentEffect={assignmentEffect}
            assignmentList={assignmentList}
            assignmentReminder={assignmentReminder}
            assignmentParentTips={assignmentParentTips}
            assignmentCopied={assignmentCopied}
            receiptError={receiptError}
            receiptNotes={receiptNotes}
            receiptLoadingKey={receiptLoadingKey}
            onNoteChange={handleReceiptNoteChange}
            onSubmitReceipt={submitReceipt}
            onCopyReminder={() => copyText(assignmentReminder, setAssignmentCopied)}
          />
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div id="parent-weekly-report">
          <ParentWeeklyReportCard
            report={report}
            receiptError={receiptError}
            receiptNotes={receiptNotes}
            receiptLoadingKey={receiptLoadingKey}
            onNoteChange={handleReceiptNoteChange}
            onSubmitReceipt={submitReceipt}
          />
        </div>
        <div id="parent-weak-points">
          <ParentWeakPointsCard report={report} />
        </div>
      </div>

      <div id="parent-favorites">
        <ParentFavoritesCard favorites={favorites} />
      </div>
    </WorkspacePage>
  );
}
