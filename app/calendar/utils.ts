import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import { formatLoadedTime } from "@/lib/client-request";
import type {
  ScheduleApiPayload,
  ScheduleLessonBase,
  ScheduleLessonOccurrence
} from "@/lib/class-schedules";
import type { CalendarItem, CalendarItemType, CalendarRoleAction } from "./types";

export const TYPE_LABELS: Record<CalendarItemType, string> = {
  lesson: "课程",
  assignment: "作业",
  announcement: "公告",
  correction: "订正"
};

export function getTimelineStatusLabel(item: CalendarItem) {
  if (item.type === "lesson") {
    if (item.status === "in_progress") return "进行中";
    if (item.status === "upcoming") return "待上课";
    if (item.status === "finished") return "已结束";
  }
  if (item.status === "completed") return "已完成";
  if (item.status === "pending") return "待完成";
  return item.status || "待处理";
}

export function formatLessonRange(lesson: Pick<ScheduleLessonBase, "startTime" | "endTime">) {
  return `${lesson.startTime}-${lesson.endTime}`;
}

export function formatOccurrenceRange(lesson: Pick<ScheduleLessonOccurrence, "startAt" | "endAt">) {
  return `${new Date(lesson.startAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  })}-${new Date(lesson.endAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function formatCalendarDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric"
  });
}

export function getTeacherComposerKey(sessionId: string, lessonDate: string) {
  return `${sessionId}:${lessonDate}`;
}

type PrestudyMetaLesson = Pick<
  ScheduleLessonBase,
  | "prestudyAssignmentTitle"
  | "prestudyAssignmentDueAt"
  | "prestudyTotalCount"
  | "prestudyCompletedCount"
  | "prestudyAssignmentStatus"
  | "nextAssignmentTitle"
  | "nextAssignmentDueAt"
>;

export function buildPrestudySummary(lesson: PrestudyMetaLesson, isTeacher: boolean) {
  if (lesson.prestudyAssignmentTitle) {
    return `课前预习：${lesson.prestudyAssignmentTitle}${
      lesson.prestudyAssignmentDueAt ? ` · 截止 ${formatLoadedTime(lesson.prestudyAssignmentDueAt)}` : ""
    }${
      isTeacher && typeof lesson.prestudyTotalCount === "number"
        ? ` · 已完成 ${lesson.prestudyCompletedCount ?? 0}/${lesson.prestudyTotalCount}`
        : ""
    }${
      !isTeacher && lesson.prestudyAssignmentStatus
        ? ` · 当前 ${lesson.prestudyAssignmentStatus === "completed" ? "已完成" : "待完成"}`
        : ""
    }`;
  }

  if (lesson.nextAssignmentTitle) {
    return `课前联动：${lesson.nextAssignmentTitle} · ${
      lesson.nextAssignmentDueAt ? `截止 ${formatLoadedTime(lesson.nextAssignmentDueAt)}` : "待完成"
    }`;
  }

  if (isTeacher) {
    return "建议现在补 1 个预习任务，学生首页会把它放到“下一步该做什么”里。";
  }

  return null;
}

export function getCalendarRoleActions(
  role: ScheduleApiPayload["role"] | null | undefined
) {
  const emptyStateAction: CalendarRoleAction =
    role === "teacher"
      ? { href: "/teacher", label: "查看教学执行" }
      : role === "parent"
        ? { href: "/parent", label: "查看家长看板" }
        : { href: "/student/assignments", label: "先看今日任务" };

  const supplementalAction: CalendarRoleAction =
    role === "teacher"
      ? { href: "/teacher/modules", label: "查看课程模块" }
      : role === "parent"
        ? { href: "/course", label: "查看课程主页" }
        : { href: "/student/assignments", label: "查看作业中心" };

  return { emptyStateAction, supplementalAction };
}

function getCalendarRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看课程表与学习日程。";
  }
  if (status === 400 && requestMessage === "missing student") {
    return "当前账号尚未绑定学生信息，绑定后即可查看课程表与学习日程。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getCalendarScheduleRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 400 && requestMessage === "missing student") {
    return "当前账号尚未绑定学生信息，绑定后即可查看课程表。";
  }

  return getCalendarRequestMessage(error, fallback);
}

export function getCalendarTimelineRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 400 && requestMessage === "missing student") {
    return "当前账号尚未绑定学生信息，绑定后即可查看学习时间线。";
  }

  return getCalendarRequestMessage(error, fallback);
}

export function isCalendarMissingStudentError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 400 && getRequestErrorMessage(error, "").trim().toLowerCase() === "missing student";
}
