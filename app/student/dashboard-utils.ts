import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export function getStudentDashboardRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看学习控制台。";
  }
  if (lower === "class not found" || (status === 404 && lower === "not found")) {
    return "当前班级信息已失效，课表与任务会在重新加入班级后恢复。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentDashboardJoinRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续加入班级。";
  }
  if (lower === "missing code") {
    return "请输入邀请码后再提交。";
  }
  if (requestMessage === "邀请码无效" || (status === 404 && lower === "not found")) {
    return "邀请码无效，请检查老师提供的邀请码后重试。";
  }
  if (requestMessage === "班级与学生学校不匹配") {
    return "该班级与当前学生账号不属于同一学校，暂时无法加入。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingStudentDashboardClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const lower = getRequestErrorMessage(error, "").trim().toLowerCase();
  return lower === "class not found" || (status === 404 && lower === "not found");
}
