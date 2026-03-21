import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { Syllabus } from "./types";
import type { CourseClass } from "./types";

export const COURSE_FIELD_STYLE = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)"
} as const;

export function createBlankSyllabus(): Syllabus {
  return {
    summary: "",
    objectives: "",
    gradingPolicy: "",
    scheduleText: ""
  };
}

export function normalizeSyllabus(payload?: Syllabus | null): Syllabus {
  return {
    summary: payload?.summary ?? "",
    objectives: payload?.objectives ?? "",
    gradingPolicy: payload?.gradingPolicy ?? "",
    scheduleText: payload?.scheduleText ?? "",
    updatedAt: payload?.updatedAt
  };
}

function getCourseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看课程主页。";
  }
  if (requestMessage === "missing student") {
    return "当前账号尚未绑定学生信息，绑定后即可查看课程主页。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getCourseClassesRequestMessage(error: unknown, fallback: string) {
  return getCourseRequestMessage(error, fallback);
}

export function getCourseSyllabusRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 404 && requestMessage === "not found") {
    return "当前班级课程大纲不可用，可能已被移除或你已失去访问权限。";
  }

  return getCourseRequestMessage(error, fallback);
}

export function getCourseSummaryRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 404 && requestMessage === "not found") {
    return "当前班级课程概览不可用，可能已被移除或你已失去访问权限。";
  }

  return getCourseRequestMessage(error, fallback);
}

export function getCourseSaveRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续保存课程大纲。";
  }
  if (requestMessage === "missing classid") {
    return "请先选择班级后再保存课程大纲。";
  }
  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级不可用，请刷新班级列表后重新选择。";
  }

  return getCourseRequestMessage(error, fallback);
}

export function isMissingCourseClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function resolveCourseClassId(classes: CourseClass[], classId: string) {
  if (classId && classes.some((item) => item.id === classId)) {
    return classId;
  }
  return classes[0]?.id ?? "";
}

export function resolveCourseStateAfterMissingClass(classes: CourseClass[], missingClassId: string, currentClassId: string) {
  const nextClasses = classes.filter((item) => item.id !== missingClassId);
  const nextPreferredClassId = currentClassId === missingClassId ? "" : currentClassId;

  return {
    nextClasses,
    nextClassId: resolveCourseClassId(nextClasses, nextPreferredClassId)
  };
}

export function getCourseNoStoreRequestInit(): RequestInit {
  return { cache: "no-store" };
}

export function formatSubmissionType(submissionType: string) {
  if (submissionType === "essay") {
    return "作文";
  }
  if (submissionType === "upload") {
    return "上传";
  }
  return "在线作业";
}
