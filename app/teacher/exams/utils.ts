import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  TeacherExamClassOption,
  TeacherExamItem,
  TeacherExamStatusFilter
} from "./types";

export const STATUS_LABELS: Record<TeacherExamStatusFilter, string> = {
  all: "全部",
  published: "进行中",
  closed: "已关闭"
};

export function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getTeacherExamsRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看考试列表。";
  }
  return getRequestErrorMessage(error, fallback);
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

export function getSubmissionRate(exam: TeacherExamItem) {
  if (!exam.assignedCount) return 0;
  return Math.round((exam.submittedCount / exam.assignedCount) * 100);
}

export function getDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  return `${Math.ceil(diffHours / 24)} 天后结束`;
}

export function getAttentionScore(exam: TeacherExamItem, now: number) {
  if (exam.status !== "published") {
    return -new Date(exam.endAt).getTime();
  }

  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  const endAtTs = new Date(exam.endAt).getTime();
  const hoursUntilEnd = Math.max(0, Math.ceil((endAtTs - now) / (60 * 60 * 1000)));
  const dueSoonBoost = hoursUntilEnd <= 24 ? 240 - hoursUntilEnd : 0;

  return pendingCount * 100 + (100 - getSubmissionRate(exam)) * 10 + dueSoonBoost;
}

export function getPublishModeLabel(value: TeacherExamItem["publishMode"]) {
  return value === "teacher_assigned" ? "班级统一发布" : "定向发布";
}

export function getPriorityLabel(exam: TeacherExamItem, now: number) {
  if (exam.status !== "published") return "已收口";
  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  const diffMs = new Date(exam.endAt).getTime() - now;
  if (pendingCount > 0 && diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) return "优先催交";
  if (getSubmissionRate(exam) < 60) return "低完成率";
  return "进行中";
}

export function getRecommendedAction(exam: TeacherExamItem, now: number) {
  const pendingCount = Math.max(0, exam.assignedCount - exam.submittedCount);
  if (exam.status === "published") {
    if (pendingCount > 0 && new Date(exam.endAt).getTime() - now <= 24 * 60 * 60 * 1000) {
      return `还剩 ${pendingCount} 人未提交，先在详情页确认学生名单和催交节奏。`;
    }
    if (getSubmissionRate(exam) < 60) {
      return `当前完成率只有 ${getSubmissionRate(exam)}%，优先确认这场考试是否需要补提醒或调整结束时间。`;
    }
    return "当前节奏稳定，可以转到详情页检查风险学生和复盘包。";
  }
  if (exam.avgScore < 70) {
    return `这场考试已结束，但平均分只有 ${exam.avgScore}%，适合回详情页确认题目讲评重点。`;
  }
  return "这场考试已收口，可以作为下一轮考试的参考基线。";
}

export function buildClassOptions(list: TeacherExamItem[]): TeacherExamClassOption[] {
  return Array.from(
    new Map(
      list.map((item) => [
        `${item.className}::${item.classSubject}::${item.classGrade}`,
        {
          id: `${item.className}::${item.classSubject}::${item.classGrade}`,
          name: item.className,
          subject: item.classSubject,
          grade: item.classGrade
        }
      ])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

export function resolveTeacherExamsClassFilter(
  currentClassFilter: string,
  classOptions: TeacherExamClassOption[]
) {
  if (!currentClassFilter) {
    return "";
  }
  return classOptions.some((item) => item.id === currentClassFilter) ? currentClassFilter : "";
}
