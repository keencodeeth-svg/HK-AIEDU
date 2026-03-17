import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AssignmentStudentFilter,
  RubricItem,
  RubricPayloadItem,
  TeacherAssignmentStudent
} from "./types";

export const STUDENT_FILTER_LABELS: Record<AssignmentStudentFilter, string> = {
  all: "全部学生",
  pending: "未完成",
  review: "待批改",
  low_score: "低于 60%",
  completed: "已完成"
};

export function normalizeRubricItems(items: RubricPayloadItem[] = []): RubricItem[] {
  return items.map((item) => ({
    title: item.title ?? "",
    description: item.description ?? "",
    maxScore: Number(item.maxScore ?? 5),
    weight: Number(item.weight ?? 1),
    levels: Array.isArray(item.levels)
      ? item.levels.map((level) => ({
          label: level.label ?? "",
          score: Number(level.score ?? 0),
          description: level.description ?? ""
        }))
      : []
  }));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function getDueRelativeLabel(dueDate: string, now: number) {
  const diffMs = new Date(dueDate).getTime() - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `已逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  return `${diffDays} 天后截止`;
}

export function getTeacherAssignmentDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看作业。";
  }
  if (status === 404 && lower === "not found") {
    return "作业不存在，或当前教师账号无权查看该作业。";
  }
  if (lower === "missing items" || lower === "body.items must contain at least 1 items") {
    return "请至少保留一个评分维度后再保存评分细则。";
  }
  if (/^body\.items\[\d+\]\.title /.test(lower)) {
    return "评分维度标题不能为空。";
  }
  if (/^body\.items\[\d+\]\.description /.test(lower)) {
    return "评分维度说明不能为空。";
  }
  if (/^body\.items\[\d+\]\.maxscore /.test(lower)) {
    return "评分维度满分至少为 1 分。";
  }
  if (/^body\.items\[\d+\]\.weight /.test(lower)) {
    return "评分维度权重至少为 1。";
  }
  if (/^body\.items\[\d+\]\.levels\[\d+\]\.label /.test(lower)) {
    return "评分档位名称不能为空。";
  }
  if (/^body\.items\[\d+\]\.levels\[\d+\]\.description /.test(lower)) {
    return "评分档位说明不能为空。";
  }
  if (/^body\.items\[\d+\]\.levels\[\d+\]\.score /.test(lower)) {
    return "评分档位分值格式不正确，请重新填写。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherAssignmentDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function getStudentStatusLabel(status: string, assignmentOverdue: boolean) {
  if (status === "completed") return "已完成";
  return assignmentOverdue ? "已逾期未交" : "待提交";
}

export function getStudentStatusPillClassName(status: string, assignmentOverdue: boolean) {
  if (status === "completed") return "gradebook-pill done";
  return assignmentOverdue ? "gradebook-pill overdue" : "gradebook-pill pending";
}

export function getStudentPriority(student: TeacherAssignmentStudent, assignmentOverdue: boolean) {
  if (student.status !== "completed") {
    return {
      label: assignmentOverdue ? "优先催交" : "待提交",
      detail: assignmentOverdue ? "截止已过，应该先发提醒或线下跟进" : "截止前仍未提交，需要尽快确认"
    };
  }

  if (student.score === null || student.total === null) {
    return {
      label: "待批改",
      detail: "学生已提交，但当前还没有可回看的评分结果"
    };
  }

  if (student.total > 0 && student.score / student.total < 0.6) {
    return {
      label: "需要复盘",
      detail: `当前得分 ${Math.round((student.score / student.total) * 100)}%，建议先回看错因`
    };
  }

  return {
    label: "已稳定",
    detail: "当前已完成且没有明显风险，可以放到后续抽查"
  };
}
