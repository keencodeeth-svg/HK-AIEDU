"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime, isAuthError, requestJson } from "@/lib/client-request";
import WrongBookHistoryCard from "./_components/WrongBookHistoryCard";
import WrongBookReviewQueueCard from "./_components/WrongBookReviewQueueCard";
import WrongBookTaskGeneratorCard from "./_components/WrongBookTaskGeneratorCard";
import WrongBookTasksCard from "./_components/WrongBookTasksCard";
import type {
  CorrectionTask,
  CreateCorrectionSkippedItem,
  ReviewQueueData,
  ReviewQueueItem,
  Summary,
  WrongBookItem
} from "./types";
import {
  formatDateTime,
  getWrongBookCompleteTaskRequestMessage,
  getWrongBookCorrectionsRequestMessage,
  getWrongBookCreateTasksRequestMessage,
  getWrongBookHistoryRequestMessage,
  getWrongBookReviewQueueRequestMessage,
  getWrongBookReviewSubmitRequestMessage,
  isMissingWrongBookReviewQuestionError,
  isMissingWrongBookTaskError,
  normalizeWrongBookSkippedReason,
  pruneWrongBookReviewState,
  pruneWrongBookSelection,
  toDateInputValue
} from "./utils";

type WrongBookResponse = {
  data?: WrongBookItem[];
};

type CorrectionsResponse = {
  data?: CorrectionTask[];
  summary?: Summary | null;
};

type ReviewQueueResponse = {
  data?: ReviewQueueData | null;
};

type CreateCorrectionResponse = {
  created?: CorrectionTask[];
  skipped?: CreateCorrectionSkippedItem[];
};

type CorrectionMutationResponse = {
  data?: CorrectionTask;
};

type ReviewResultResponse = {
  correct?: boolean;
  nextReviewAt?: string | null;
  review?: {
    intervalLabel?: string | null;
  } | null;
};

type WrongBookLoadStatus = "loaded" | "partial" | "auth" | "stale" | "error";

export default function WrongBookPage() {
  const loadRequestIdRef = useRef(0);
  const hasHistorySnapshotRef = useRef(false);
  const hasCorrectionsSnapshotRef = useRef(false);
  const hasReviewQueueSnapshotRef = useRef(false);
  const [list, setList] = useState<WrongBookItem[]>([]);
  const [tasks, setTasks] = useState<CorrectionTask[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueData | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [reviewSubmitting, setReviewSubmitting] = useState<Record<string, boolean>>({});
  const [reviewMessages, setReviewMessages] = useState<Record<string, string>>({});
  const [taskGeneratorMessage, setTaskGeneratorMessage] = useState<string | null>(null);
  const [taskGeneratorErrors, setTaskGeneratorErrors] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [completingTaskIds, setCompletingTaskIds] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const defaultDueDate = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + 3);
    return toDateInputValue(base);
  }, []);

  const [dueDate, setDueDate] = useState(defaultDueDate);

  const clearTaskGeneratorFeedback = useCallback(() => {
    setTaskGeneratorMessage(null);
    setTaskGeneratorErrors([]);
  }, []);

  const clearActionNotice = useCallback(() => {
    setActionMessage(null);
    setActionError(null);
  }, []);

  const clearHistoryState = useCallback(() => {
    hasHistorySnapshotRef.current = false;
    setList([]);
    setSelected({});
  }, []);

  const clearCorrectionsState = useCallback(() => {
    hasCorrectionsSnapshotRef.current = false;
    setTasks([]);
    setSummary(null);
    setCompletingTaskIds({});
  }, []);

  const clearReviewQueueState = useCallback(() => {
    hasReviewQueueSnapshotRef.current = false;
    setReviewQueue(null);
    setReviewAnswers({});
    setReviewSubmitting({});
    setReviewMessages({});
  }, []);

  const clearWrongBookState = useCallback(() => {
    clearHistoryState();
    clearCorrectionsState();
    clearReviewQueueState();
    clearTaskGeneratorFeedback();
    clearActionNotice();
    setPageError(null);
    setLastLoadedAt(null);
  }, [
    clearActionNotice,
    clearCorrectionsState,
    clearHistoryState,
    clearReviewQueueState,
    clearTaskGeneratorFeedback
  ]);

  const handleAuthRequired = useCallback(() => {
    loadRequestIdRef.current += 1;
    clearWrongBookState();
    setLoading(false);
    setRefreshing(false);
    setCreatingTasks(false);
    setAuthRequired(true);
  }, [clearWrongBookState]);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<WrongBookLoadStatus> => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setPageError(null);

      try {
        const [wrongResult, taskResult, queueResult] = await Promise.allSettled([
          requestJson<WrongBookResponse>("/api/wrong-book"),
          requestJson<CorrectionsResponse>("/api/corrections"),
          requestJson<ReviewQueueResponse>("/api/wrong-book/review-queue")
        ]);

        if (loadRequestIdRef.current !== requestId) {
          return "stale";
        }

        const hasAuthError = [wrongResult, taskResult, queueResult].some(
          (result) => result.status === "rejected" && isAuthError(result.reason)
        );
        if (hasAuthError) {
          handleAuthRequired();
          return "auth";
        }

        const nextErrors: string[] = [];
        let hasSuccess = false;

        if (wrongResult.status === "fulfilled") {
          const nextList = wrongResult.value.data ?? [];
          hasHistorySnapshotRef.current = true;
          setList(nextList);
          setSelected((prev) => pruneWrongBookSelection(nextList, prev));
          hasSuccess = true;
        } else {
          if (!hasHistorySnapshotRef.current) {
            clearHistoryState();
          }
          nextErrors.push(`错题本加载失败：${getWrongBookHistoryRequestMessage(wrongResult.reason, "加载错题本失败")}`);
        }

        if (taskResult.status === "fulfilled") {
          hasCorrectionsSnapshotRef.current = true;
          setTasks(taskResult.value.data ?? []);
          setSummary(taskResult.value.summary ?? null);
          hasSuccess = true;
        } else {
          if (!hasCorrectionsSnapshotRef.current) {
            clearCorrectionsState();
          }
          nextErrors.push(`订正任务加载失败：${getWrongBookCorrectionsRequestMessage(taskResult.reason, "加载订正任务失败")}`);
        }

        if (queueResult.status === "fulfilled") {
          const nextReviewQueue = queueResult.value.data ?? null;
          hasReviewQueueSnapshotRef.current = true;
          setReviewQueue(nextReviewQueue);
          setReviewAnswers((prev) => pruneWrongBookReviewState(nextReviewQueue, prev));
          setReviewSubmitting((prev) => pruneWrongBookReviewState(nextReviewQueue, prev));
          setReviewMessages((prev) => pruneWrongBookReviewState(nextReviewQueue, prev));
          hasSuccess = true;
        } else {
          if (!hasReviewQueueSnapshotRef.current) {
            clearReviewQueueState();
          }
          nextErrors.push(`复练队列加载失败：${getWrongBookReviewQueueRequestMessage(queueResult.reason, "加载复练队列失败")}`);
        }

        setAuthRequired(false);
        if (hasSuccess) {
          setLastLoadedAt(new Date().toISOString());
        }
        setPageError(nextErrors.length ? nextErrors.join("；") : null);
        if (!nextErrors.length) {
          return "loaded";
        }
        return hasSuccess ? "partial" : "error";
      } catch (error) {
        if (loadRequestIdRef.current !== requestId) {
          return "stale";
        }

        if (isAuthError(error)) {
          handleAuthRequired();
          return "auth";
        }

        if (
          !hasHistorySnapshotRef.current &&
          !hasCorrectionsSnapshotRef.current &&
          !hasReviewQueueSnapshotRef.current
        ) {
          clearWrongBookState();
        }
        setAuthRequired(false);
        setPageError(getWrongBookHistoryRequestMessage(error, "加载错题闭环失败"));
        return "error";
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      clearCorrectionsState,
      clearHistoryState,
      clearReviewQueueState,
      clearWrongBookState,
      handleAuthRequired
    ]
  );

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSelect(id: string) {
    clearTaskGeneratorFeedback();
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleReviewAnswerChange(questionId: string, value: string) {
    setReviewAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
    setReviewMessages((prev) => ({ ...prev, [questionId]: "" }));
    clearActionNotice();
  }

  async function handleCreateTasks() {
    clearTaskGeneratorFeedback();
    clearActionNotice();

    const ids = list.filter((item) => selected[item.id]).map((item) => item.id);
    if (!ids.length) {
      setTaskGeneratorErrors(["请先选择要订正的错题。"]);
      return;
    }

    setCreatingTasks(true);

    try {
      const payload = await requestJson<CreateCorrectionResponse>("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: ids, dueDate })
      });
      const failed = payload.skipped ?? [];
      const createdCount = payload.created?.length ?? 0;
      const summaryMessage = createdCount
        ? `已创建 ${createdCount} 个订正任务。`
        : "所选错题暂未创建新的订正任务。";

      setTaskGeneratorErrors(
        failed.map((item) => `${item.questionId}：${normalizeWrongBookSkippedReason(item.reason)}`)
      );
      setSelected({});

      const refreshStatus = await load("refresh");
      if (refreshStatus === "auth") {
        return;
      }

      if (refreshStatus === "loaded") {
        setTaskGeneratorMessage(summaryMessage);
      } else if (refreshStatus === "stale") {
        setTaskGeneratorMessage(`${summaryMessage.slice(0, -1)} 系统正在同步最新列表。`);
      } else {
        setTaskGeneratorMessage(`${summaryMessage.slice(0, -1)}，但部分列表刷新失败，请稍后重试。`);
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        setAuthRequired(false);
        setTaskGeneratorErrors([getWrongBookCreateTasksRequestMessage(error, "创建任务失败")]);
      }
    } finally {
      setCreatingTasks(false);
    }
  }

  async function handleComplete(id: string) {
    clearActionNotice();
    setCompletingTaskIds((prev) => ({ ...prev, [id]: true }));

    try {
      await requestJson<CorrectionMutationResponse>(`/api/corrections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });

      const refreshStatus = await load("refresh");
      if (refreshStatus === "auth") {
        return;
      }

      if (refreshStatus === "loaded") {
        setActionMessage("订正任务已标记完成。");
      } else if (refreshStatus === "stale") {
        setActionMessage("订正任务已标记完成，系统正在同步最新列表。");
      } else {
        setActionMessage("订正任务已标记完成，但部分列表刷新失败，请稍后重试。");
      }
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        const nextErrorMessage = getWrongBookCompleteTaskRequestMessage(error, "更新订正任务失败");
        if (isMissingWrongBookTaskError(error)) {
          const refreshStatus = await load("refresh");
          if (refreshStatus === "auth") {
            return;
          }
        }
        setAuthRequired(false);
        setActionError(nextErrorMessage);
      }
    } finally {
      setCompletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function submitReview(item: ReviewQueueItem) {
    const answer = reviewAnswers[item.questionId];
    if (!answer) {
      setReviewMessages((prev) => ({ ...prev, [item.questionId]: "请先选择答案。" }));
      return;
    }

    clearActionNotice();
    setReviewSubmitting((prev) => ({ ...prev, [item.questionId]: true }));
    setReviewMessages((prev) => ({ ...prev, [item.questionId]: "" }));

    try {
      const payload = await requestJson<ReviewResultResponse>("/api/wrong-book/review-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: item.questionId, answer })
      });
      const nextSlot = payload.review?.intervalLabel ? `，下一轮：${payload.review.intervalLabel}` : "";
      const nextDate = payload.nextReviewAt ? `（${formatDateTime(payload.nextReviewAt)}）` : "";
      const refreshStatus = await load("refresh");
      if (refreshStatus === "auth") {
        return;
      }

      const refreshSuffix =
        refreshStatus === "loaded"
          ? ""
          : refreshStatus === "stale"
            ? "，系统正在同步最新列表。"
            : "，但部分列表刷新失败，请稍后重试。";
      setReviewMessages((prev) => ({
        ...prev,
        [item.questionId]: `${payload.correct ? "复练正确" : "复练错误"}${nextSlot}${nextDate}${refreshSuffix}`
      }));
      setReviewAnswers((prev) => {
        const next = { ...prev };
        delete next[item.questionId];
        return next;
      });
    } catch (error) {
      if (isAuthError(error)) {
        handleAuthRequired();
      } else {
        const nextErrorMessage = getWrongBookReviewSubmitRequestMessage(error, "提交失败");

        if (isMissingWrongBookReviewQuestionError(error)) {
          const refreshStatus = await load("refresh");
          if (refreshStatus === "auth") {
            return;
          }
          setActionError(nextErrorMessage);
        } else {
          setReviewMessages((prev) => ({ ...prev, [item.questionId]: nextErrorMessage }));
        }
        setAuthRequired(false);
      }
    } finally {
      setReviewSubmitting((prev) => {
        const next = { ...prev };
        delete next[item.questionId];
        return next;
      });
    }
  }

  const hasContent = Boolean(list.length || tasks.length || reviewQueue?.today?.length || reviewQueue?.upcoming?.length || summary);
  const actionBusy =
    creatingTasks ||
    Object.keys(completingTaskIds).length > 0 ||
    Object.keys(reviewSubmitting).length > 0;

  if (loading && !hasContent && !authRequired) {
    return <StatePanel title="错题闭环加载中" description="正在同步错题本、订正任务和今日复练队列。" tone="loading" />;
  }

  if (authRequired) {
    return (
      <StatePanel
        title="请先登录学生账号"
        description="登录后即可查看错题本、订正任务与统一复练队列。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (pageError && !hasContent) {
    return (
      <StatePanel
        title="错题闭环加载失败"
        description={pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void load()}>
            重新加载
          </button>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>错题与订正</h2>
          <div className="section-sub">错题复盘 + 间隔复练 + 订正计划。</div>
        </div>
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">错题闭环</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button className="button secondary" type="button" onClick={() => void load("refresh")} disabled={loading || refreshing || actionBusy}>
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {pageError ? (
        <StatePanel
          title="已展示最近一次成功数据"
          description={`最新同步失败：${pageError}`}
          tone="error"
          compact
        />
      ) : null}

      {actionError ? <div className="status-note error">{actionError}</div> : null}
      {actionMessage ? <div className="status-note success">{actionMessage}</div> : null}

      <WrongBookReviewQueueCard
        reviewQueue={reviewQueue}
        reviewAnswers={reviewAnswers}
        reviewSubmitting={reviewSubmitting}
        reviewMessages={reviewMessages}
        onReviewAnswerChange={handleReviewAnswerChange}
        onSubmitReview={submitReview}
      />

      <WrongBookTasksCard summary={summary} tasks={tasks} completingTaskIds={completingTaskIds} onCompleteTask={handleComplete} />

      <WrongBookTaskGeneratorCard
        dueDate={dueDate}
        list={list}
        selected={selected}
        message={taskGeneratorMessage}
        errors={taskGeneratorErrors}
        submitting={creatingTasks}
        onDueDateChange={setDueDate}
        onToggleSelect={toggleSelect}
        onCreateTasks={handleCreateTasks}
      />

      <WrongBookHistoryCard list={list} />
    </div>
  );
}
