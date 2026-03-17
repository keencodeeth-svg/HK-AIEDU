import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

function getFocusRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getFocusBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续使用专注计时。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getFocusSummaryRequestMessage(error: unknown, fallback: string) {
  return getFocusBaseRequestMessage(error, fallback);
}

export function getFocusSessionSaveRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getFocusRequestMessage(error);

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续记录专注时长。";
  }
  if (requestMessage === "invalid duration") {
    return "专注时长无效，请重新选择时长后再试。";
  }

  return getFocusBaseRequestMessage(error, fallback);
}
