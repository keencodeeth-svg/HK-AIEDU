import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export function getStudentGrowthRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看成长档案。";
  }

  return getRequestErrorMessage(error, fallback);
}
