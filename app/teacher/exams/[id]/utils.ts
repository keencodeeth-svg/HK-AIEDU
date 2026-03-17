import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { ExamRiskLevel } from "./types";

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
