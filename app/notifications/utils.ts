import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { NotificationItem } from "./types";

const TYPE_LABELS: Record<string, string> = {
  assignment: "作业",
  assignment_reminder: "作业提醒",
  review: "批改反馈",
  class: "班级",
  announcement: "公告",
  teacher_alert_action: "教师动作",
  student_profile_reminder: "资料补充提醒",
  exam_review_pack: "考试复盘",
  exam_review_pack_parent: "家长复盘"
};

export function getNotificationTypeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

export function getNotificationsRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看通知。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getNotificationActionRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续处理通知。";
  }
  if (requestMessage === "missing id") {
    return "未找到要处理的通知，请刷新列表后重试。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "这条通知已不存在，通知列表会在刷新后自动同步。";
  }

  return getNotificationsRequestMessage(error, fallback);
}

export function isMissingNotificationError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function resolveNotificationsTypeFilter(list: NotificationItem[], typeFilter: string) {
  if (typeFilter === "all") {
    return "all";
  }

  const types = new Set(list.map((item) => item.type));
  return types.has(typeFilter) ? typeFilter : "all";
}
