import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export function getChallengeLoadRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看挑战任务。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getChallengeClaimRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续领取奖励。";
  }
  if (requestMessage === "missing taskid") {
    return "未找到要领取的挑战任务，请刷新列表后重试。";
  }

  return getChallengeLoadRequestMessage(error, fallback);
}
