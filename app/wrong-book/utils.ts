import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ReviewQueueData,
  Summary,
  WrongBookItem,
  WrongBookLoadStatus
} from "./types";

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWrongBookDefaultDueDate(baseDate = new Date()) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + 3);
  return toDateInputValue(nextDate);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function getWrongBookRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getWrongBookBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看错题闭环。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getWrongBookHistoryRequestMessage(error: unknown, fallback: string) {
  return getWrongBookBaseRequestMessage(error, fallback);
}

export function getWrongBookCorrectionsRequestMessage(error: unknown, fallback: string) {
  return getWrongBookBaseRequestMessage(error, fallback);
}

export function getWrongBookReviewQueueRequestMessage(error: unknown, fallback: string) {
  return getWrongBookBaseRequestMessage(error, fallback);
}

export function getWrongBookCreateTasksRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getWrongBookRequestMessage(error);

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续创建订正任务。";
  }
  if (requestMessage === "questionids required") {
    return "请先选择要订正的错题。";
  }

  return getWrongBookBaseRequestMessage(error, fallback);
}

export function getWrongBookCompleteTaskRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getWrongBookRequestMessage(error);

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续更新订正任务。";
  }
  if (requestMessage === "status required") {
    return "未找到要更新的订正任务状态，请刷新列表后重试。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "这条订正任务已不存在，列表会在刷新后自动同步。";
  }

  return getWrongBookBaseRequestMessage(error, fallback);
}

export function getWrongBookReviewSubmitRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getWrongBookRequestMessage(error);

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续提交复练结果。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "这道复练题已不可用，复练队列会在刷新后自动同步。";
  }

  return getWrongBookBaseRequestMessage(error, fallback);
}

export function isMissingWrongBookTaskError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getWrongBookRequestMessage(error) === "not found";
}

export function isMissingWrongBookReviewQuestionError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getWrongBookRequestMessage(error) === "not found";
}

export function normalizeWrongBookSkippedReason(reason: string) {
  const normalized = reason.trim().toLowerCase();

  if (normalized === "题目不存在") {
    return "题目已不存在";
  }
  if (normalized === "已有未完成订正任务") {
    return "已有未完成订正任务";
  }

  return reason.trim() || "已跳过";
}

export function getSelectedWrongBookQuestionIds(
  list: Pick<WrongBookItem, "id">[],
  selected: Record<string, boolean>
) {
  return list.filter((item) => selected[item.id]).map((item) => item.id);
}

export function pruneWrongBookSelection(
  list: Pick<WrongBookItem, "id">[],
  selected: Record<string, boolean>
) {
  const allowedIds = new Set(list.map((item) => item.id));

  return Object.fromEntries(
    Object.entries(selected).filter(([id, checked]) => checked && allowedIds.has(id))
  );
}

export function pruneWrongBookReviewState<T>(
  reviewQueue: ReviewQueueData | null,
  state: Record<string, T>
) {
  const allowedIds = new Set((reviewQueue?.today ?? []).map((item) => item.questionId));

  return Object.fromEntries(Object.entries(state).filter(([questionId]) => allowedIds.has(questionId)));
}

type WrongBookContentState = {
  list: WrongBookItem[];
  tasks: { id: string }[];
  reviewQueue: ReviewQueueData | null;
  summary: Summary | null;
};

export function hasWrongBookContent({
  list,
  tasks,
  reviewQueue,
  summary
}: WrongBookContentState) {
  return Boolean(
    list.length ||
      tasks.length ||
      reviewQueue?.today?.length ||
      reviewQueue?.upcoming?.length ||
      summary
  );
}

type WrongBookBusyState = {
  creatingTasks: boolean;
  completingTaskIds: Record<string, boolean>;
  reviewSubmitting: Record<string, boolean>;
};

export function isWrongBookActionBusy({
  creatingTasks,
  completingTaskIds,
  reviewSubmitting
}: WrongBookBusyState) {
  return (
    creatingTasks ||
    Object.keys(completingTaskIds).length > 0 ||
    Object.keys(reviewSubmitting).length > 0
  );
}

function trimWrongBookTerminalStop(message: string) {
  return message.endsWith("。") ? message.slice(0, -1) : message;
}

function getWrongBookRefreshSuffix(status: WrongBookLoadStatus) {
  if (status === "loaded") {
    return "";
  }
  if (status === "stale") {
    return "，系统正在同步最新列表。";
  }
  return "，但部分列表刷新失败，请稍后重试。";
}

export function getWrongBookTaskGenerationFeedback(
  createdCount: number,
  refreshStatus: WrongBookLoadStatus
) {
  const baseMessage = createdCount
    ? `已创建 ${createdCount} 个订正任务。`
    : "所选错题暂未创建新的订正任务。";

  if (refreshStatus === "loaded") {
    return baseMessage;
  }

  if (refreshStatus === "stale") {
    return `${trimWrongBookTerminalStop(baseMessage)} 系统正在同步最新列表。`;
  }

  return `${trimWrongBookTerminalStop(baseMessage)}${getWrongBookRefreshSuffix(refreshStatus)}`;
}

export function getWrongBookTaskCompletionFeedback(refreshStatus: WrongBookLoadStatus) {
  const baseMessage = "订正任务已标记完成。";

  if (refreshStatus === "loaded") {
    return baseMessage;
  }

  return `${trimWrongBookTerminalStop(baseMessage)}${getWrongBookRefreshSuffix(refreshStatus)}`;
}

type WrongBookReviewFeedbackOptions = {
  correct?: boolean;
  intervalLabel?: string | null;
  nextReviewAt?: string | null;
  refreshStatus: WrongBookLoadStatus;
};

export function buildWrongBookReviewFeedbackMessage({
  correct,
  intervalLabel,
  nextReviewAt,
  refreshStatus
}: WrongBookReviewFeedbackOptions) {
  const nextSlot = intervalLabel ? `，下一轮：${intervalLabel}` : "";
  const nextDate = nextReviewAt ? `（${formatDateTime(nextReviewAt)}）` : "";
  const baseMessage = `${correct ? "复练正确" : "复练错误"}${nextSlot}${nextDate}`;

  return `${baseMessage}${getWrongBookRefreshSuffix(refreshStatus)}`;
}
