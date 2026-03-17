import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export function getDiagnosticStartRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续开始诊断。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getDiagnosticSubmitRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续提交诊断。";
  }
  if (status === 400 && requestMessage === "missing fields") {
    return "请至少完成 1 题后再提交诊断。";
  }

  return getDiagnosticStartRequestMessage(error, fallback);
}
