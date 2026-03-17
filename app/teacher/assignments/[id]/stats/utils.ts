import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { AssignmentStatsDistributionItem } from "./types";

export function getDistributionMaxCount(items: AssignmentStatsDistributionItem[]) {
  if (!items.length) return 1;
  return Math.max(...items.map((item) => item.count), 1);
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getDueRelativeLabel(dueDate: string, now: number) {
  const diffMs = new Date(dueDate).getTime() - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `已截止 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  return `${diffDays} 天后截止`;
}

export function getTeacherAssignmentStatsRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看作业统计。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "作业不存在，或当前教师账号无权查看这份作业统计。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherAssignmentStatsError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}
