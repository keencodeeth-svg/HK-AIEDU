import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { ClassItem, ThreadDetail, ThreadSummary } from "./types";

function getInboxRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

export function getComposeHint(role: string | null) {
  if (role === "teacher") {
    return "支持按班级发送给学生，并可选择同步给家长。";
  }
  if (role === "parent") {
    return "按班级发送给任课老师，适合家校沟通与反馈。";
  }
  return "按班级发送给任课老师，适合提问、反馈和沟通学习安排。";
}

function getInboxBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getInboxRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看收件箱。";
  }
  if (requestMessage === "class not found") {
    return "当前班级不可用，请刷新后重新选择。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "该会话不存在，或你当前无权查看这条沟通记录。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getInboxLoadRequestMessage(error: unknown, fallback: string) {
  return getInboxBaseRequestMessage(error, fallback);
}

export function getInboxCreateRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getInboxRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续发送消息。";
  }
  if (requestMessage === "missing fields") {
    return "请先填写主题和消息内容。";
  }
  if (requestMessage === "class not found") {
    return "当前班级不可用，请刷新班级列表后重新选择。";
  }
  if (requestMessage === "class has no teacher") {
    return "当前班级还没有绑定教师，暂时无法发起沟通。";
  }
  if (requestMessage === "missing recipients") {
    return "当前没有可发送的对象，请先选择有效班级。";
  }
  if (requestMessage === "invalid recipients") {
    return "当前会话接收人无效，请刷新班级信息后重试。";
  }

  return getInboxBaseRequestMessage(error, fallback);
}

export function getInboxReplyRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getInboxRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续回复会话。";
  }
  if (requestMessage === "missing content") {
    return "请输入回复内容后再发送。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "该会话已不存在，或你当前无权继续回复。";
  }

  return getInboxBaseRequestMessage(error, fallback);
}

export function isMissingInboxThreadError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getInboxRequestMessage(error) === "not found";
}

export function isMissingInboxClassError(error: unknown) {
  return getInboxRequestMessage(error) === "class not found";
}

export function resolveInboxClassId(classes: ClassItem[], classId: string) {
  if (classId && classes.some((item) => item.id === classId)) {
    return classId;
  }
  return classes[0]?.id ?? "";
}

export function resolveInboxActiveThreadId(
  threads: ThreadSummary[],
  ...candidates: Array<string | null | undefined>
) {
  for (const candidate of candidates) {
    if (candidate && threads.some((thread) => thread.id === candidate)) {
      return candidate;
    }
  }
  return threads[0]?.id ?? "";
}

export function isInboxThreadDetailCurrent(threadDetail: ThreadDetail | null, threadId: string) {
  return threadDetail?.thread.id === threadId;
}
