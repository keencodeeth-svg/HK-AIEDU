import { formatLoadedTime } from "@/lib/client-request";
import type {
  RecoveryFilterStatus,
  RecoveryIssueType,
  RecoveryPriority,
  RecoveryRole,
  RecoverySlaState,
  RecoveryStatus
} from "./types";

export const statusOptions: Array<{ value: RecoveryFilterStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "resolved", label: "已解决" },
  { value: "rejected", label: "无法核验" }
];

export const roleLabels: Record<RecoveryRole, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
  school_admin: "学校管理员"
};

export const issueLabels: Record<RecoveryIssueType, string> = {
  forgot_password: "忘记密码",
  forgot_account: "找回账号",
  account_locked: "账号锁定"
};

export const statusLabels: Record<RecoveryStatus, string> = {
  pending: "待处理",
  in_progress: "处理中",
  resolved: "已解决",
  rejected: "无法核验"
};

export const statusTones: Record<RecoveryStatus, "info" | "success" | "error"> = {
  pending: "info",
  in_progress: "info",
  resolved: "success",
  rejected: "error"
};

export const priorityLabels: Record<RecoveryPriority, string> = {
  urgent: "紧急",
  high: "高优先",
  normal: "常规"
};

export const slaLabels: Record<RecoverySlaState, string> = {
  healthy: "SLA 充足",
  at_risk: "SLA 临近",
  overdue: "SLA 超时",
  closed: "已闭环"
};

export const priorityTones: Record<RecoveryPriority, "error" | "info" | "success"> = {
  urgent: "error",
  high: "info",
  normal: "success"
};

export function formatWaitingHours(value: number) {
  if (value < 1) {
    return `${Math.max(1, Math.round(value * 60))} 分钟`;
  }
  if (value >= 10) {
    return `${Math.round(value)} 小时`;
  }
  return `${value.toFixed(1)} 小时`;
}

export function formatTargetBy(value: string | null) {
  if (!value) return "--";
  return formatLoadedTime(value);
}
