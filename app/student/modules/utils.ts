import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

type StudentClassModulesLike = {
  subject: string;
};

export function getStudentModulesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看课程模块。";
  }
  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级不存在，模块列表已按最新状态刷新。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function resolveStudentModulesSubjectFilter<T extends StudentClassModulesLike>(
  data: T[],
  currentFilter: string
) {
  if (currentFilter === "all") {
    return "all";
  }

  return data.some((klass) => klass.subject === currentFilter) ? currentFilter : "all";
}
