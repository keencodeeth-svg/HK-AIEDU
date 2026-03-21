import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { ExamDetail, ExamRiskLevel, ExamStudent } from "./types";

export function getRiskTone(level: ExamRiskLevel) {
  if (level === "high") {
    return { label: "高风险", color: "#b42318", bg: "#fee4e2" };
  }
  if (level === "medium") {
    return { label: "中风险", color: "#b54708", bg: "#fffaeb" };
  }
  return { label: "低风险", color: "#027a48", bg: "#ecfdf3" };
}

export function getTeacherExamDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看考试详情。";
  }
  if (status === 404 && lower === "not found") {
    return "考试不存在，或当前教师账号无权查看该考试。";
  }
  if (requestMessage === "考试已关闭") {
    return "考试已经处于关闭状态，无需重复操作。";
  }
  if (requestMessage === "考试已开放") {
    return "考试已经处于开放状态，无需重复操作。";
  }
  if (requestMessage === "考试题目为空") {
    return "当前考试没有题目，暂时无法发布复盘任务。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherExamDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function formatTeacherExamDetailLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getTeacherExamDetailDueRelativeLabel(endAt: string, now: number) {
  const diffMs = new Date(endAt).getTime() - now;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 0) return `已结束 ${Math.abs(diffHours)} 小时`;
  if (diffHours <= 1) return "1 小时内结束";
  if (diffHours < 24) return `${diffHours} 小时后结束`;
  return `${Math.ceil(diffHours / 24)} 天后结束`;
}

export function rankTeacherExamStudents(students: ExamStudent[]) {
  return [...students].sort((a, b) => {
    if (b.riskScore !== a.riskScore) {
      return b.riskScore - a.riskScore;
    }
    if ((a.status === "submitted") !== (b.status === "submitted")) {
      return a.status === "submitted" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export function getTeacherExamDetailDerivedState(options: {
  data: ExamDetail | null;
  lastLoadedAt: string | null;
  now: number;
}) {
  const rankedStudents = options.data?.students?.length
    ? rankTeacherExamStudents(options.data.students)
    : [];
  const submittedRate = options.data?.summary.assigned
    ? Math.round((options.data.summary.submitted / options.data.summary.assigned) * 100)
    : 0;
  const totalQuestionScore =
    options.data?.questions.reduce((sum, question) => sum + question.score, 0) ?? 0;

  return {
    rankedStudents,
    submittedRate,
    topRiskStudent: rankedStudents[0] ?? null,
    totalQuestionScore,
    dueRelativeLabel: options.data
      ? getTeacherExamDetailDueRelativeLabel(options.data.exam.endAt, options.now)
      : "",
    lastLoadedAtLabel: formatTeacherExamDetailLoadedTime(options.lastLoadedAt)
  };
}

export function updateTeacherExamDetailStatus(
  detail: ExamDetail | null,
  nextStatus?: ExamDetail["exam"]["status"]
) {
  if (!detail) {
    return detail;
  }

  return {
    ...detail,
    exam: {
      ...detail.exam,
      status: nextStatus ?? detail.exam.status
    }
  };
}

export function buildTeacherExamReviewPackMessage(
  result:
    | {
        message?: string;
        publishedStudents?: number;
        targetedStudents?: number;
        skippedLowRisk?: number;
        skippedNoSubmission?: number;
      }
    | undefined,
  dryRun: boolean
) {
  const summary =
    result?.message ??
    (dryRun
      ? `预览完成：计划通知学生 ${result?.publishedStudents ?? 0} 人`
      : `发布完成：已通知学生 ${result?.publishedStudents ?? 0} 人`);
  const detail = `覆盖 ${result?.targetedStudents ?? 0} 人，跳过低风险 ${result?.skippedLowRisk ?? 0} 人，缺少提交 ${result?.skippedNoSubmission ?? 0} 人。`;
  return `${summary} ${detail}`;
}
