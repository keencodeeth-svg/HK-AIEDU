import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { ParentActionItem, ReceiptSource } from "./types";

function getParentRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getParentBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  if (status === 401 || status === 403) {
    return "家长登录状态已失效，请重新登录后继续查看家长空间。";
  }
  if (requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可查看孩子的学习动态。";
  }
  if (requestMessage === "student not found" || (status === 404 && requestMessage === "not found")) {
    return "当前绑定的学生信息已失效，请重新绑定后再试。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getParentReportRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  if (status === 401 || status === 403) {
    return "家长登录状态已失效，请重新登录后继续查看家长周报。";
  }
  if (requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可查看家长周报。";
  }
  if (requestMessage === "student not found" || (status === 404 && requestMessage === "not found")) {
    return "当前绑定的学生信息已失效，请重新绑定后再查看家长周报。";
  }

  return getParentBaseRequestMessage(error, fallback);
}

export function getParentCorrectionsRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  if (status === 401 || status === 403) {
    return "家长登录状态已失效，请重新登录后继续查看订正任务。";
  }
  if (requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可查看订正任务。";
  }

  return getParentBaseRequestMessage(error, fallback);
}

export function getParentAssignmentsRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  if (status === 401 || status === 403) {
    return "家长登录状态已失效，请重新登录后继续查看作业提醒。";
  }
  if (requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可查看作业提醒。";
  }
  if (requestMessage === "student not found" || (status === 404 && requestMessage === "not found")) {
    return "当前绑定的学生信息已失效，请重新绑定后再查看作业提醒。";
  }

  return getParentBaseRequestMessage(error, fallback);
}

export function getParentFavoritesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  if (status === 401 || status === 403) {
    return "家长登录状态已失效，请重新登录后继续查看收藏题目。";
  }
  if (requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可查看收藏题目。";
  }

  return getParentBaseRequestMessage(error, fallback);
}

export function getParentReceiptSubmitRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  if (status === 401 || status === 403) {
    return "家长登录状态已失效，请重新登录后继续提交家长回执。";
  }
  if (requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可提交家长回执。";
  }
  if (requestMessage === "skipped status requires note") {
    return "如选择“暂时跳过”，请填写至少 2 个字的原因。";
  }
  if (requestMessage === "invalid actionitemid for source" || requestMessage === "actionitemid required") {
    return "当前行动卡已不可用，页面会在刷新后自动同步。";
  }
  if (requestMessage === "invalid status" || requestMessage === "invalid source") {
    return "当前回执状态无效，请刷新页面后重试。";
  }

  return getParentBaseRequestMessage(error, fallback);
}

export function isParentMissingStudentError(error: unknown) {
  return getParentRequestMessage(error) === "missing student";
}

export function isParentMissingStudentContextError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getParentRequestMessage(error);

  return (
    requestMessage === "missing student" ||
    requestMessage === "student not found" ||
    (status === 404 && requestMessage === "not found")
  );
}

export function isParentMissingActionItemError(error: unknown) {
  const requestMessage = getParentRequestMessage(error);
  return requestMessage === "invalid actionitemid for source" || requestMessage === "actionitemid required";
}

export function pruneParentReceiptNotes(
  receiptNotes: Record<string, string>,
  groups: Array<{ source: ReceiptSource; items: Pick<ParentActionItem, "id">[] }>
) {
  const allowedKeys = new Set(
    groups.flatMap(({ source, items }) => items.map((item) => `${source}:${item.id}`))
  );

  return Object.fromEntries(
    Object.entries(receiptNotes).filter(([key, value]) => allowedKeys.has(key) && value.trim().length > 0)
  );
}
