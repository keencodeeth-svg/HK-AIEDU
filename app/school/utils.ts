import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { SchoolActionTone } from "@/lib/school-admin-types";

export const SCHOOL_ACTION_TONE_META: Record<SchoolActionTone, { label: string; color: string; background: string }> = {
  critical: { label: "立即处理", color: "#b42318", background: "rgba(180, 35, 24, 0.12)" },
  warning: { label: "优先跟进", color: "#b54708", background: "rgba(245, 158, 11, 0.16)" },
  info: { label: "建议补齐", color: "#175cd3", background: "rgba(23, 92, 211, 0.12)" },
  success: { label: "运行稳定", color: "#027a48", background: "rgba(2, 122, 72, 0.12)" }
};

export function getSchoolAdminRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const normalizedMessage = requestMessage.toLowerCase();

  if (status === 401) {
    return "登录状态已失效，请重新登录后继续查看学校数据。";
  }
  if (normalizedMessage === "school not bound") {
    return "当前账号尚未绑定学校，暂时无法查看学校数据。";
  }
  if (normalizedMessage === "cross school access denied") {
    return "当前账号不能访问这所学校的数据，请切换到有权限的学校后再试。";
  }
  if (normalizedMessage === "schoolid required for platform admin") {
    return "当前页面需要明确学校上下文；请选择学校后再查看。";
  }
  if (status === 403 || normalizedMessage === "unauthorized" || normalizedMessage === "forbidden") {
    return "当前账号没有学校管理权限，请使用学校管理员或平台主管账号登录。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function isSchoolAdminContextError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return (
    requestMessage === "school not bound" ||
    requestMessage === "cross school access denied" ||
    requestMessage === "schoolid required for platform admin" ||
    (status === 400 && requestMessage === "schoolid required for platform admin")
  );
}

export function isSchoolAdminAuthRequiredError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  if (status === 401) return true;
  if (status !== 403) return false;
  return !isSchoolAdminContextError(error);
}
