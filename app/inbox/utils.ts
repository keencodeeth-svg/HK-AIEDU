import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ClassItem,
  InboxDerivedState,
  InboxLoadStatus,
  ThreadDetail,
  ThreadSummary,
  UserSession
} from "./types";

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

export function getInboxNoStoreRequestInit(): RequestInit {
  return { cache: "no-store" };
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

export function filterInboxThreads(threads: ThreadSummary[], keyword: string, unreadOnly: boolean) {
  const keywordLower = keyword.trim().toLowerCase();
  return threads.filter((thread) => {
    if (unreadOnly && !thread.unreadCount) return false;
    if (!keywordLower) return true;
    return [thread.subject, thread.lastMessage?.content ?? "", ...thread.participants.map((item) => item.name)]
      .join(" ")
      .toLowerCase()
      .includes(keywordLower);
  });
}

type InboxDerivedStateInput = {
  user: UserSession | null;
  classes: ClassItem[];
  classId: string;
  threads: ThreadSummary[];
  activeThreadId: string;
  threadDetail: ThreadDetail | null;
  keyword: string;
  unreadOnly: boolean;
  requestedThreadId: string;
};

export function getInboxDerivedState({
  user,
  classes,
  classId,
  threads,
  activeThreadId,
  threadDetail,
  keyword,
  unreadOnly,
  requestedThreadId
}: InboxDerivedStateInput): InboxDerivedState {
  return {
    activeThread: threads.find((thread) => thread.id === activeThreadId) ?? null,
    currentClass: classes.find((item) => item.id === classId) ?? null,
    unreadCount: threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0),
    filteredThreads: filterInboxThreads(threads, keyword, unreadOnly),
    hasInboxData: Boolean(user || classes.length || threads.length || threadDetail),
    requestedThreadMatched: Boolean(requestedThreadId && activeThreadId === requestedThreadId)
  };
}

export function getInboxCreateSuccessMessage(status: InboxLoadStatus) {
  if (status === "error") {
    return "消息已发送，但会话列表刷新失败，请稍后重试。";
  }
  if (status === "stale") {
    return "消息已发送，收件箱正在同步最新内容。";
  }
  return "消息已发送";
}

export function getInboxReplySuccessMessage(status: InboxLoadStatus) {
  if (status === "error") {
    return "回复已发送，但会话刷新失败，请稍后重试。";
  }
  if (status === "stale") {
    return "回复已发送，收件箱正在同步最新内容。";
  }
  return "回复已发送";
}
