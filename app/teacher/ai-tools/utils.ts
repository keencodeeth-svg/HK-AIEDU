import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

type TeacherAiToolsErrorScope =
  | "bootstrap"
  | "paper"
  | "outline"
  | "wrong_review"
  | "review_pack"
  | "review_pack_dispatch"
  | "question_check";

export function aiRiskLabel(level?: string) {
  if (level === "high") return "高";
  if (level === "medium") return "中";
  return "低";
}

export function resolveTeacherAiToolsClassId(currentClassId: string, classes: Array<{ id: string }>) {
  if (currentClassId && classes.some((item) => item.id === currentClassId)) {
    return currentClassId;
  }
  return classes[0]?.id ?? "";
}

export function isMissingTeacherAiToolsClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function isMissingTeacherAiToolsQuestionError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function getTeacherAiToolsRequestMessage(
  error: unknown,
  fallback: string,
  scope: TeacherAiToolsErrorScope = "bootstrap"
) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续使用 AI 工具。";
  }
  if (scope === "question_check" && isMissingTeacherAiToolsQuestionError(error)) {
    return "当前题目不存在，请刷新题库后重试。";
  }
  if (isMissingTeacherAiToolsClassError(error)) {
    return "当前班级不存在，或你已失去该班级的操作权限。";
  }
  if (lower === "missing fields") {
    return "请先补全题干、选项和答案后再做纠错检查。";
  }
  if (lower === "body.items must contain at least 1 items") {
    return "请至少选择 1 条复练单后再下发。";
  }
  if (requestMessage === "当前班级题库为空，无法布置复练单") {
    return "当前班级题库为空，暂时无法布置复练单。";
  }
  if (requestMessage === "组卷失败：未生成到可用题目") {
    return "当前条件下未生成到可用题目，请放宽筛选或切换模式后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}
