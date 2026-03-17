import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { SubmissionClassItem, SubmissionStatusFilter } from "./types";

export const STATUS_LABELS: Record<SubmissionStatusFilter, string> = {
  all: "全部",
  completed: "已提交",
  pending: "待提交",
  overdue: "已逾期"
};

export function getTeacherSubmissionsRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看提交箱。";
  }
  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级不存在，或你没有查看这批提交的权限。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function resolveTeacherSubmissionsClassId(classes: SubmissionClassItem[], requestedClassId: string) {
  if (!requestedClassId) return "";
  return classes.some((item) => item.id === requestedClassId) ? requestedClassId : "";
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

export function getSubmissionStatusLabel(status: string) {
  return status === "completed" ? "已提交" : status === "overdue" ? "已逾期" : "待提交";
}

export function getSubmissionStatusPillClassName(status: string) {
  if (status === "completed") return "gradebook-pill done";
  if (status === "overdue") return "gradebook-pill overdue";
  return "gradebook-pill pending";
}
