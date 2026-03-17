import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export const LOCAL_DRAFT_PREFIX = "exam-local-draft:";

export function formatRemain(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getStudentExamDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看考试。";
  }
  if (status === 404 && lower === "not found") {
    return "考试不存在，或你当前账号无权查看这场考试。";
  }
  if (lower === "考试作答时间已结束") {
    return "考试作答时间已结束，当前无法继续保存或提交。";
  }
  if (lower === "考试已提交") {
    return "本场考试已提交，无需重复保存草稿。";
  }
  if (lower === "考试题目为空") {
    return "当前考试题目为空，请联系老师检查考试配置。";
  }
  if (lower === "at least one delta must be positive") {
    return "考试状态同步参数无效，请刷新页面后重试。";
  }
  if (lower === "answers must be an object" || /^answers\.[^.]+ must be a string$/.test(lower)) {
    return "答题内容格式无效，请刷新页面后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentExamReviewPackRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看考试复盘。";
  }
  if (status === 404 && lower === "not found") {
    return "考试复盘暂不可用，请稍后重试。";
  }

  return getStudentExamDetailRequestMessage(error, fallback);
}

export function isMissingStudentExamDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}
