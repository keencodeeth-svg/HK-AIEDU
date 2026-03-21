import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { AnnouncementClassOption, AnnouncementLoadStatus, AppUserRole } from "./types";

function getAnnouncementsRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getAnnouncementsBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getAnnouncementsRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看班级公告。";
  }
  if (status === 400 && requestMessage === "missing student") {
    return "当前家长账号尚未绑定学生信息，绑定后即可查看班级公告。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getAnnouncementsListRequestMessage(error: unknown, fallback: string) {
  return getAnnouncementsBaseRequestMessage(error, fallback);
}

export function getAnnouncementClassListRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续选择发布班级。";
  }

  return getAnnouncementsBaseRequestMessage(error, fallback);
}

export function getAnnouncementSubmitRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getAnnouncementsRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续发布公告。";
  }
  if (requestMessage === "missing fields") {
    return "请先填写班级、公告标题和公告内容。";
  }
  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级不可用，请刷新班级列表后重新选择。";
  }

  return getAnnouncementsBaseRequestMessage(error, fallback);
}

export function isMissingAnnouncementClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getAnnouncementsRequestMessage(error);
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function resolveAnnouncementClassId(classes: AnnouncementClassOption[], classId: string) {
  if (classId && classes.some((item) => item.id === classId)) {
    return classId;
  }
  return classes[0]?.id ?? "";
}

export function getAnnouncementsNoStoreRequestInit(): RequestInit {
  return { cache: "no-store" };
}

export function buildAnnouncementSubmitPayload(classId: string, title: string, content: string) {
  return { classId, title, content };
}

export function getAnnouncementSubmitSuccessMessage(loadStatus: AnnouncementLoadStatus) {
  if (loadStatus === "loaded") {
    return "公告已发布。";
  }
  if (loadStatus === "stale") {
    return "公告已发布，系统正在同步最新公告。";
  }
  return "公告已发布，但公告列表刷新失败，请稍后重试。";
}

export function hasAnnouncementsPageData(
  announcementsCount: number,
  userRole: AppUserRole,
  classesCount: number
) {
  return Boolean(announcementsCount || userRole === "teacher" || classesCount);
}
